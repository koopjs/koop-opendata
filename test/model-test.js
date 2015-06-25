/* global before, describe, it */

var should = require('should')
var config = require('config')
var kooplib = require('koop-server/lib')
var Sample = require('../models/Sample.js')
var model

before(function (done) {
  kooplib.Cache.db = kooplib.PostGIS.connect(config.db.postgis.conn)
  model = new Sample(kooplib)
  done()
})

describe('Sample Model', function () {
  describe('when getting data', function () {
    it('should find and return geojson', function (done) {
      model.find(1, {}, function (err, data) {
        // there should not be any errors
        should.not.exist(err)
        // should always return the data as geojson
        should.exist(data)
        // data should be an array (support multi layer responses)
        data.length.should.equal(1)
        // make sure we have a feature collection
        data[0].type.should.equal('FeatureCollection')
        done()
      })
    })

  })

})
