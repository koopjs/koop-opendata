// used to send http requests
var crypto = require('crypto')
var request = require('request')
// used to manage control flow
var async = require('async')
// used to create hashes that fingerprints a given request
var hash = require('object-hash')
var _ = require('underscore')
var bboxPolygon = require('turf-bbox-polygon')

var OpenData = function (koop) {
  var openData = koop.BaseModel(koop)
  var type = 'OpenData'
  var tokenExpiration
  var locations = {}
  var token

  // adds a service to the koop.Cache.db
  // needs a host, generates an id
  openData.register = function (id, host, callback) {
    var type = 'openData:services'
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

  openData.remove = function (id, callback) {
    koop.Cache.db.serviceRemove('openData:services', parseInt(id, 0) || id, callback)
  }

  // get service by id, no id == return all
  openData.find = function (id, callback) {
    koop.Cache.db.serviceGet('openData:services', parseInt(id, 0) || id, function (err, res) {
      if (err) {
        callback('No datastores have been registered with this provider yet. Try POSTing {"host":"url", "id":"yourId"} to /openData', null)
      } else {
        callback(null, res)
      }
    })
  }

  openData.getResource = function (host, hostId, params, options, callback) {
    params.layer = 0
    // delete the mehod param or else we get inconsistent hash keys depending on the request
    var key = hostId + ':' + hash.MD5(_.omit(params, 'method'))
    // check the cache for data with this type & id
    koop.Cache.get(type, key, options || {layer: 0}, function (err, entry) {
      if (err) {
        openData.buildQuery(params, function (err, query) {
          if (err) return koop.log.error(err)
          openData.search(key, host, query, function (err, geojson) {
            if (err) return callback(err)
            callback(null, [geojson])
          })
        })
      } else {
        callback(null, entry)
      }
    })
  }

  openData.search = function (key, host, query, callback) {
    var queryString = host + '/datasets?' + query
    // get the first page and figure out the count
    openData.getPage(host, query, function (err, results) {
      if (err) return callback(err)
      var count = results.metadata.stats.total_count
      koop.log.info(queryString + ' has ' + count + 'results')
      openData.translate(host, results, function (err, geojson) {
        if (err) return callback(err)
        geojson.name = queryString
        geojson.totalCount = count
        // insert the first page then create a queue to handle the rest if we need to
        openData.insert(key, geojson, function (err, success) {
          if (err) return callback(err)
          // return results as soon as there is anything cached
          // but let the client know data is still being retreived.
          if (count > 100) geojson.processing = true
          callback(null, geojson)
          var pages = openData.buildPages(query, count)
          // if more than 1 page, gather in the background
          if (count > 100) {
            openData.createQueue(key, host, pages, function (err, info) {
              if (err) return koop.log.error(err)
              koop.log.info(info)
            })
          }
        })
      })
    })
  }

  openData.insert = function (key, geojson, callback) {
    // take translated geojson and huck it into Koop
    koop.Cache.insert(type, key, geojson, 0, function (err, success) {
      if (err) {
        callback(err)
      } else {
        callback(null, success)
      }
    })
  }

  openData.insertPartial = function (key, geojson, callback) {
    koop.Cache.insertPartial(type, key, geojson, 0, function (err, success) {
      if (err) {
        callback(err)
      } else {
        callback(null, success)
      }
    })
  }

  openData.getPage = function (host, query, callback) {
    // simple wrapper around requests to ArcGIS Open Data API
    var url = host + '/datasets.json?' + query
    var options = {
      url: url,
      gzip: true
    }
    request.get(options, function (err, res, body) {
      if (err) return callback(err)
      try {
        callback(null, JSON.parse(body))
      } catch (e) {
        callback(url + '::' + e)
      }
    })
  }

  openData.buildPages = function (query, count) {
    var pageCount = Math.ceil(count / 100) + 1
    var pages = []
    for (var p = 2; p < pageCount; p++) {
      var page = query + '&page=' + p
      pages.push(page)
    }
    return pages
  }

  openData.createQueue = function (key, host, pages, callback) {
    var pageQueue = async.queue(function (page, cb) {
      openData.getPage(host, page, function (err, results) {
        if (err) return cb(err)
        openData.translate(host, results, function (err, geojson) {
          if (err) return cb(err)
          openData.insertPartial(key, geojson, function (err, success) {
            if (err) return cb(err)
            cb()
          })
        })
      })
    }, 4)

    pageQueue.drain = function () {
      callback(null, 'Finished paging: ' + key)
    }
    pageQueue.push(pages, function (err) {
      if (err) return callback(err)
      koop.log.info('Sucessfully processed a page of ' + key)
    })

    callback(null, 'Paging kicked off for ' + key)
  }

  openData.buildQuery = function (params, callback) {
    // create a a default set of parameters for the API call
    // fill in passed in parameters where available
    var options = {
      q: params.q || '*',
      sort_by: params.sort_by || 'relevance',
      per_page: 100
    }
    if (params.keyword) {
      options.keyword = params.keyword
    }
    // accept bbox parameter or geocode a place parameter
    openData.getBbox(params, function (err, bbox) {
      if (err) return callback(err)
      if (bbox) {
        options.bbox = bbox
        options.filter_by_extent = true
      }
      // concatenate all the parameters into one query string
      var query = ''
      for (var key in options) {
        query += key + '=' + options[key] + '&'
      }
      callback(null, query.slice(0, -1))
    })
  }

  openData.getBbox = function (params, callback) {
    var bbox
    // there is no bbox or place parameter
    if (!params.bbox && !params.place) {
      callback(null, null)
    // already have a bbox don't need to geocode
    } else if (params.bbox) {
      callback(null, bbox)
    // already geocoded this place parameter
    } else if (locations[params.place]) {
      callback(null, locations[params.place])
    // new place parameter, get the bounding box
    } else {
      openData.getToken(function (err, token) {
        if (err) {
          koop.log.error('Error getting Esri Geocoding token, disregarding place parameter')
          return callback(null, null)
        }
        var root = 'http://geocode.arcgis.com'
        var gc_request = '/arcgis/rest/services/World/GeocodeServer/find?f=json&forStorage=true&maxlocations=1&outSR=4326'
        gc_request = root + gc_request + '&text=' + encodeURI(params.place) + '&token=' + token
        request.get(gc_request, function (err, res) {
          if (err) return callback(err)
          var response = JSON.parse(res.body)
          var extent = response.locations[0].extent
          bbox = extent.xmin + ',' + extent.ymin + ',' + extent.xmax + ',' + extent.ymax
          // save the result to an in-memory object to avoid repeat requests
          locations[params.place] = bbox
          callback(null, bbox)
        })
      })
    }
  }

  openData.getToken = function (callback) {
    if (token && new Date() < tokenExpiration) {
      callback(null, token)
    } else {
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
        if (err) return callback(err)
        token = res.body.access_token
        tokenExpiration = new Date(res.body.expires + (1000 * 60 * 60))
        callback(null, token)
      })
    }
  }

  openData.translate = function (host, results, callback) {
    // translate the openData API response into geojson
    // create the shell that will hold all the properties
    var geojson = {
      type: 'FeatureCollection',
      features: []
    }
    results.data.forEach(function (dataset) {
    // loop through each dataset returned from the API call and push it into the geojson shell
      // console.log(dataset)
      try {
        var bbox = dataset.extent.coordinates
        if (bbox) {
          var coordinates = bboxPolygon(bbox[0].concat(bbox[1])).geometry.coordinates
          geojson.features.push({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: coordinates
            },
            properties: {
              name: dataset.name,
              owner: dataset.owner,
              description: dataset.description,
              updatedAt: dataset.updated_at,
              quality: dataset.quality,
              coverage: dataset.coverage,
              tags: dataset.tags.join(', '),
              openDataUrl: host + '/datasets/' + dataset.id,
              server: dataset.url,
              serverVersion: dataset.current_version,
              license: dataset.license,
              records: dataset.record_count,
              thumbnail: dataset.thumbnail_url,
              arcGisUrl: dataset.arcgis_online_item_url,
              group: dataset.main_group_title
            }
          })
        }
      } catch (e) {
        // todo should I just continue here?
        callback(e)
      }
    })
    callback(null, geojson)
  }

  openData.exportToFormat = function (format, dir, key, geojson, options, callback) {
    koop.Exporter.exportToFormat(format, dir, key, geojson, options, callback)
  }

  openData.drop = function (hostId, params, options, callback) {
  // drops the item from the cache
    delete params.method
    params.layer = 0
    var stringedParams = JSON.stringify(params)
    var dir = 'OpenData' + '/' + params.id + crypto.createHash('md5').update(stringedParams).digest('hex')
    var key = hostId + ':' + hash.MD5(_.omit(params, 'method'))
    koop.Cache.remove(type, key, {}, function (err, res) {
      if (err) return callback(err)
      koop.files.removeDir('files/' + dir, function (err, res) {
        if (err) return callback(err)
        koop.files.removeDir('tiles/' + dir, function (err, res) {
          if (err) return callback(err)
          koop.files.removeDir('thumbs/' + dir, function (err, res) {
            if (err) return callback(err)
            callback(err, true)
          })
        })
      })
    })
  }

  openData.getCount = function (key, options, callback) {
    koop.Cache.getCount(key, options, callback)
  }

  return openData

}

module.exports = OpenData
