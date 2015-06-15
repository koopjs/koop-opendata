var pjson = require('./package.json')

exports.name = 'OpenData'
exports.hosts = true
exports.controller = require('./controller')
exports.routes = require('./routes')
exports.model = require('./models/OpenData.js')
exports.status = { version: pjson.version}
