// Defines the routes and params name that will be passed in req.params 
// routes tell Koop what controller method should handle what request route

var Combinatorics = require('js-combinatorics').Combinatorics;

var actions = {
    'drop': 'drop',
    'FeatureServer': 'featureserver',
    'FeatureServer/:layer': 'featureserver',
    'FeatureServer/:layer/:method': 'featureserver'
};
var base = '/zillow/:place';
var parameters = [
'price',
'bedrooms',
'bathrooms',
'sqft'
];

var combinations = Combinatorics.permutationCombination(parameters).toArray();

var endpoints = [];
endpoints.push('');

combinations.forEach(function(params){
    if (params.length > 1){
        var stub = '/';
        params.forEach(function(param){
            stub += param + '/:' + param + '/';
        });
        endpoints.push(stub.slice(0,-1));
    } else {
        endpoints.push('/' + params[0] + '/:' + params[0]);
    }
});

var routes = {
    'get /zillow': 'index'
};

endpoints.forEach(function(endpoint){
    routes['get ' + base + endpoint] = 'get';
    Object.keys(actions).forEach(function(action){
        routes['get ' + base + endpoint + '/' + action] = actions[action];
    });
});


module.exports = routes;

