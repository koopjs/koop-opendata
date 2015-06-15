// Defines the routes and params name that will be passed in req.params
// routes tell Koop what controller method should handle what request route

var Combinatorics = require('js-combinatorics').Combinatorics

var actions = {
  'drop': 'drop',
  'FeatureServer': 'featureserver',
  'FeatureServer/:layer': 'featureserver',
  'FeatureServer/:layer/:method': 'featureserver'
}
var base = '/openData/:id'
var parameters = [
  'q',
  'keyword',
  'bbox',
  'sort_by',
  'place'
]

var combinations = Combinatorics.permutationCombination(parameters).toArray()

var endpoints = ['']

combinations.forEach(function (params) {
  if (params.length > 1) {
    var stub = '/'
    params.forEach(function (param) {
      stub += param + '/:' + param + '/'
    })
    endpoints.push(stub.slice(0, -1))
  } else {
    endpoints.push('/' + params[0] + '/:' + params[0])
  }
})

var routes = {
  'post /openData': 'register',
  'get /openData': 'list',
  // put this here so it's not captured by the request below
  'get /openData/:id.:format': 'findResource',
  'get /openData/:id': 'find',
  'delete /openData/:id': 'del'
}

endpoints.forEach(function (endpoint) {
  // file type requests need be be first or else the request will be captured by other endpoints
  routes['get ' + base + endpoint + '.:format'] = 'findResource'
  routes['get ' + base + endpoint] = 'findResource'
  routes['post ' + base + endpoint] = 'findResource'
  Object.keys(actions).forEach(function (action) {
    routes['get ' + base + endpoint + '/' + action] = actions[action]
  })
})

module.exports = routes
