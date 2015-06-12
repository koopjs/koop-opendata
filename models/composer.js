// used to send http requests
var request = require('request')
// used to manage control flow
var async = require('async')
// used to create hashes that fingerprint a given request
var hash = require('object-hash')
var _ = require('underscore')
var bboxPolygon = require('turf-bbox-polygon')

var Composer = function (koop) {
  var composer = koop.BaseModel(koop)
  var type = 'composer'
  var token_expiration
  var locations = {}
  var token

  // adds a service to the koop.Cache.db
  // needs a host, generates an id
  composer.register = function (id, host, callback) {
    var type = 'composer:services'
    koop.Cache.db.serviceCount(type, function (error, count) {
      if (error) {
        return callback(error, null)
      }
      id = id || count++
      koop.Cache.db.serviceRegister(type, {'id': id, 'host': host}, function (err, success) {
        callback(err, id)
      })
    })
  }

  composer.remove = function (id, callback) {
    koop.Cache.db.serviceRemove('composer:services', parseInt(id, 0) || id, callback)
  }

  // get service by id, no id == return all
  composer.find = function (id, callback) {
    koop.Cache.db.serviceGet('composer:services', parseInt(id, 0) || id, function (err, res) {
      if (err) {
        callback('No datastores have been registered with this provider yet. Try POSTing {"host":"url", "id":"yourId"} to /composer', null)
      } else {
        callback(null, res)
      }
    })
  }

  composer.getResource = function (host, hostId, params, options, cb) {
    // delete these two keys or else we get inconsistent hash keys depending on the request
    params.layer = 0
    var key = hostId + hash.MD5(_.omit(params, 'method'))
    // check the cache for data with this type & id
    // if no prior requests exist then trigger this waterfall
    koop.Cache.get(type, key, options, function (err, entry) {
      if (err) {
        async.waterfall([
          function (callback) {
            if (!token || Date.now() >= token_expiration) {
              composer.getToken(function (err, res) {
                if (err) {
                  koop.log.error(err)
                } else {
                  token = res.body.access_token
                  callback(null)
                }
              })
            } else {
              callback(null)
            }
          },
          function (callback) {
            if (params.place) {
              composer.getBbox(params.place, function (bbox) {
                params.bbox = bbox
                callback(null)
              })
            } else {
              callback(null)
            }
          },
          function (callback) {
            var query = composer.buildOptions(params)
            callback(null, query)
          },
          function (query, callback) {
            composer.getDatasets(host, query, function (err, json) {
              if (err) {
                koop.log.error(err)
              } else {
                var count = json.metadata.stats.count
                if (count > 100) {
                  var pages = composer.buildPages(host, query, count)
                  composer.createQueue(key, pages)
                }
                callback(null, json)
              }
            })
          },
          function (json, callback) {
            callback(null, composer.translate(json))
          }
        ], function (err, geojson) {
          if (err) {
            koop.log.error(err)
          } else {
            composer.insert(key, geojson, cb)
          }
        })
      } else {
        cb(null, entry)
      }
    })
  }

  composer.insert = function (key, geojson, callback) {
    // take translated geojson and huck it into Koop
    koop.Cache.insert(type, key, geojson, 0, function (err, success) {
      if (err) {
        callback(err)
      } else {
        callback(null, success)
      }
    })
  }

  composer.insertPartial = function (key, geojson, callback) {
    koop.Cache.insertPartial(type, key, geojson, 0, function (err, success) {
      if (err) {
        callback(err)
      } else {
        callback(null, success)
      }
    })
  }

  composer.getDatasets = function (host, query, callback) {
    // simple wrapper around requests to the desired API
    var url = host + '/datasets.json?' + query
    request.get(url, function (err, res, body) {
      callback(err, JSON.parse(body))
    })
  }

  composer.getToken = function (callback) {
    request.post({
      url: 'https://www.arcgis.com/sharing/rest/oauth2/token/',
      json: true,
      form: {
        'f': 'json',
        'client_id': koop.config.esri.id,
        'client_secret': koop.config.esri.secret,
        'grant_type': 'client_credentials',
        'expiration': '60'
      }
    }, function (err, res) {
      callback(err, res)
    })
  }

  composer.getBbox = function (place, callback) {
    // takes in a location string and returns a bbox in the format composer understands
    var bbox
    if (locations[place]) {
      bbox = locations.place
      callback(null, bbox)
    } else {
      var root = 'http://geocode.arcgis.com'
      var gc_request = '/arcgis/rest/services/World/GeocodeServer/find?f=json&forStorage=true&maxlocations=1&outSR=4326'
      gc_request = root + gc_request + '&text=' + encodeURI(place) + '&token=' + token
      request.get(gc_request, function (err, res) {
        // handle the geocoder result
        if (err) {
          callback(err)
        } else {
          var response = JSON.parse(res.body)
          var extent = response.locations[0].extent
          bbox = extent.xmin + ',' + extent.ymin + ',' + extent.xmax + ',' + extent.ymax
          locations.place = bbox
          callback(null, bbox)
        }
      })
    }
  }

  composer.buildPages = function (host, query, count) {
    var pageCount = Math.ceil(count / 100) - 1
    var pages = []
    for (var p = 0; p < pageCount; p++) {
      var page = host + query + '&page=' + p + 2
      pages.push(page)
    }
    return pages
  }

  composer.createQueue = function (key, pages) {
    var pageQueue = async.queue(function (page, callback) {
      composer.getDatasets(page, function (err, json) {
        if (err) {
          return callback(err)
        }
        var geojson = composer.translate(json)
        composer.insertPartial(key, geojson, function (err, success) {
          if (err) {
            return callback(err)
          }
          callback(null, success)
        })
      })
    }, 4)

    pageQueue.drain = function () {
      koop.log.info('Finished paging: ' + key)
    }

    pageQueue.push(pages, function () {
      koop.log.info('Sucessfully processed a page of ' + key)
    })

    return koop.log.info('Paging kicked off for ' + key)
  }

  composer.buildOptions = function (params) {
    // create a a default set of parameters for the API call
    // fill in passed in parameters where available
    var options = {
      q: '*' || params.query,
      sort_by: 'relevance' || params.sort_by,
      per_page: 100
    }
    if (params.keyword) {
      options.keyword = params.keyword
    }
    if (params.bbox) {
      options.bbox = params.bbox
      options.filter_by_extent = true
    }

    // concatenate all the parameters into one big string
    var parameters = ''
    for (var key in options) {
      parameters = parameters + key + '=' + options[key] + '&'
    }
    return parameters.slice(0, -1)
  }

  composer.translate = function (json) {
    // translate the composer API response into geojson
    // create the shell that will hold all the properties
    var geojson = {
      type: 'FeatureCollection',
      features: []
    }
    json.data.forEach(function (dataset) {
    // loop through each dataset returned from the API call and push it into the geojson shell
      var coordinates = bboxPolygon(dataset.extent[0].concat(dataset.extent[1]))
      geojson.features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        properties: {
          name: dataset.name,
          owner: dataset.owner,
          updatedAt: dataset.updated_at,
          quality: dataset.quality,
          coverage: dataset.coverage,
          description: dataset.description,
          tags: dataset.tags.join(', '),
          server: dataset.url,
          serverVersion: dataset.current_version,
          license: dataset.license,
          records: dataset.record_count,
          thumbnail: dataset.thumbnail_url,
          arcGisUrl: dataset.arcgis_online_item_url
        }
      })
    })
    return geojson
  }

  composer.drop = function (key, options, callback) {
  // drops the item from the cache
    var dir = ['composer', key, 0].join(':')
    koop.Cache.remove('composer', key, options, function (err, res) {
      koop.files.removeDir('files/' + dir, function (err, res) {
        koop.files.removeDir('tiles/' + dir, function (err, res) {
          koop.files.removeDir('thumbs/' + dir, function (err, res) {
            callback(err, true)
          })
        })
      })
    })
  }

  return composer

}

module.exports = Composer
