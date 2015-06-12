// the name of provider is used by koop to help build default routes for FeatureService and a preview
exports.name = 'zillow';

// the "pattern" is used to build routes and is optional 
// a pattern is essentially the default route pattern for the provider 
exports.pattern = '/:place';

// attached the controller to the provider 
exports.controller = require('./controller');

// attaches the routes file to the provider 
exports.routes = require('./routes');

// attaches the model to the provider to be passed into the controller at start up time 
exports.model = require('./models/zillow.js');
