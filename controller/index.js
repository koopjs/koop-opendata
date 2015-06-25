var crypto = require('crypto')
var Path = require('path')

// a function that is given an instance of Koop at init
var Controller = function (OpenData, BaseController) {
  var controller = BaseController()

  // register a OpenData instance
  controller.register = function (req, res) {
    if (!req.body.host) {
      res.send('Must provide a host to register:', 500)
    } else {
      OpenData.register(req.body.id, req.body.host, function (err, id) {
        if (err) {
          res.send(err, 500)
        } else {
          res.json({ 'serviceId': id })
        }
      })
    }
  }

  controller.list = function (req, res) {
    OpenData.find(null, function (err, data) {
      if (err) {
        res.send(err, 500)
      } else {
        res.json(data)
      }
    })
  }

  controller.find = function (req, res) {
    OpenData.find(req.params.id, function (err, data) {
      if (err) {
        res.send(err, 404)
      } else {
        res.json(data)
      }
    })
  }

  // drops the cache for an item
  controller.drop = function (req, res) {
    OpenData.find(req.params.id, function (err, data) {
      if (err) {
        res.send(err, 500)
      } else {
        // Get the item
        OpenData.drop(data.id, req.params, req.query, function (error, itemJson) {
          if (error) {
            res.send(error, 500)
          } else {
            res.json(itemJson)
          }
        })
      }
    })
  }

  controller.findResource = function (req, res) {
    OpenData.find(req.params.id, function (err, data) {
      if (err) {
        res.status(500).send(err)
      } else {
        // Get the item
        OpenData.getResource(data.host, data.id, req.params, req.query, function (error, itemJson) {
          if (error) {
            return res.status(500).send(error)
          } else if (req.params.format) {
            // change geojson to json
            req.params.format = req.params.format.replace('geojson', 'json')
            var dir = 'OpenData' + '/' + req.params.id
            console.log(dir)
            // build the file key as an MD5 hash that's a join on the paams and look for the file
            var toHash = JSON.stringify(req.params) + JSON.stringify(req.query)
            var key = crypto.createHash('md5').update(toHash).digest('hex')
            var filePath = ['files', dir, key].join('/')
            console.log(filePath)
            var fileName = key + '.' + req.params.format
            OpenData.files.exists(filePath, fileName, function (exists, path) {
              if (exists) {
                if (path.substr(0, 4) === 'http') {
                  res.redirect(path)
                } else {
                  res.sendFile(path)
                }
              } else {
                OpenData.exportToFormat(req.params.format, dir, key, itemJson[0], {rootDir: OpenData.files.localDir}, function (err, file) {
                  if (err) return res.status(500).send(err)
                  res.status(200).sendFile(Path.resolve(process.cwd(), file.file))
                })
              }
            })
          } else {
            var geojson = itemJson
            if (geojson && geojson.features && geojson.features.length) {
              geojson.features = geojson.features.slice(0, req.query.limit || 100)
            }
            res.status(200).json(geojson[0])
          }
        })
      }
    })
  }

  controller.del = function (req, res) {
    if (!req.params.id) {
      res.send('Must specify a service id', 500)
    } else {
      OpenData.remove(req.params.id, function (err, data) {
        if (err) {
          res.status(500).send(err)
        } else {
          res.json(data)
        }
      })
    }
  }
  // shared dispath for feature service responses
  controller.featureserver = function (req, res) {
    var callback = req.query.callback
    delete req.query.callback
    for (var k in req.body) {
      req.query[k] = req.body[k]
    }
    OpenData.find(req.params.id, function (err, data) {
      if (err) {
        res.status(500).send(err)
      } else {
        var host = data.host
        // if this is a count request then go straight to the db
        if (req.query.returnCountOnly) {
          controller.featureserviceCount(req, res, host)
        } else {
          // else send this down for further processing
          controller.featureservice(req, res, host, callback)
        }
      }
    })
  }

  controller.featureserviceCount = function (req, res, host) {
    // first check if the dataset is new, in the cache, or processing
    // ask for a single feature becasue we just want to know if the data is there
    req.query.limit = 1
    OpenData.getResource(host, req.params.id, req.params.item, req.query, function (err, geojson) {
      if (err) {
        res.status(500).send(err)
      } else if (geojson[0] && geojson[0].status === 'processing') {
        res.status(202).json(geojson)
      } else {
        // it's not processing so send for the count
        OpenData.getCount(['OpenData', req.params.item, (req.query.layer || 0)].join(':'), req.query, function (err, count) {
          if (err) {
            console.log('Could not get feature count', req.params.item)
            res.status(500).send(err)
          } else {
            var response = {count: count}
            res.status(200).json(response)
          }
        })
      }
    })
  }

  controller.featureservice = function (req, res, host, callback) {
    var err
    req.query.limit = req.query.limit || req.query.resultRecordCount || 1000000000
    req.query.offset = req.query.resultOffset || null
    // Get the item
    OpenData.getResource(host, req.params.id, req.params, req.query, function (error, geojson) {
      if (error) {
        res.status(500).send(error)
      } else if (geojson[0] && geojson[0].status === 'processing') {
        res.status(202).json(geojson)
      } else {
        // pass to the shared logic for FeatureService routing
        delete req.query.geometry
        delete req.query.where
        controller.processFeatureServer(req, res, err, geojson, callback)
      }
    })
  }

  controller.preview = function (req, res) {
    res.render(__dirname + '/../views/demo', {
      locals: {
        host: req.params.id,
        item: req.params.item
      }
    })
  }

  return controller
}

module.exports = Controller
