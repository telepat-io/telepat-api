var express = require('express');
var bodyParser = require('body-parser');
colors = require('colors');

async = require('async');
Models = require('telepat-models');
redis = require('redis');

var security = require('./controllers/security');
var adminRoute = require('./controllers/admin');
var objectRoute = require('./controllers/object');
var userRoute = require('./controllers/user');
var contextRoute = require('./controllers/context');
var deviceRoute = require('./controllers/device');

var dbConnected = false;
app = express();

app.set('port', process.env.PORT || 3000);

app.disable('x-powered-by');
app.enable('trust proxy');

app.use('/documentation', express.static(__dirname+'/documentation'));

process.title = 'octopus-api';

var envVariables = {
	TP_MSG_QUE: process.env.TP_MSG_QUE,
	TP_REDIS_HOST: process.env.TP_REDIS_HOST,
	TP_REDIS_PORT: process.env.TP_REDIS_PORT,
	TP_MAIN_DB: process.env.TP_MAIN_DB,
	TP_PW_SALT: process.env.TP_PW_SALT,
	TP_FB_CLIENT_ID: process.env.TP_FB_CLIENT_ID,
	TP_FB_CLIENT_SECRET: process.env.TP_FB_CLIENT_SECRET,
	TP_TW_CLIENT_KEY: process.env.TP_TW_CLIENT_KEY,
	TP_TW_CLIENT_SECRET: process.env.TP_TW_CLIENT_SECRET
};

var validEnvVariables = true;
var mainConfiguration = {};
var redisConfig = {};
var mainDatabase = null;
var messagingClient = null;

for(var varName in envVariables) {
	if (envVariables[varName] === undefined) {
		console.log('Missing'.yellow+' environment variable "'+varName+'". Trying configuration file.');
		try {
			mainConfiguration = require('./config.json');
		} catch (e) {
			if (e.code === 'MODULE_NOT_FOUND') {
				console.log('Fatal error:'.red+' configuration file is missing or not accessible. ' +
					'Please add a configuration file from the example.');
				process.exit(-1);
			} else
				throw e;
		}

		validEnvVariables = false;
		break;
	}
}

if (validEnvVariables) {
	messagingClient = envVariables.TP_MSG_QUE;
	redisConfig = {
		host: envVariables.TP_REDIS_HOST,
		port: envVariables.TP_REDIS_PORT
	};
	mainDatabase = envVariables.TP_MAIN_DB;
	//is null just so the adapter constructor will try to check envVariables
	mainConfiguration[mainDatabase] = null;
	mainConfiguration.passwordSalt = envVariables.TP_PW_SALT;
} else {
	app.kafkaConfig = mainConfiguration.kafka;
	//backwards compatiblity for config.json files.
	if(mainConfiguration['password_salt'] !== undefined)
		mainConfiguration.passwordSalt = mainConfiguration['password_salt'];
	redisConfig = mainConfiguration.redis;
	if(mainConfiguration['main_database'] !== undefined)
		mainConfiguration.mainDatabase = mainConfiguration['main_database'];
	mainDatabase = mainConfiguration.mainDatabase;
	messagingClient = mainConfiguration.message_queue;
}

app.telepatConfig = mainConfiguration;

if (Models[mainConfiguration.logger]) {
	Models.Application.logger = new Models[mainConfiguration.logger]('TelepatAPI', mainConfiguration[mainConfiguration.logger]);
} else {
	Models.Application.logger = new Models['console_logger']('TelepatAPI');
}

app.getFailedRequestMessage = function(req, res, err) {
	return req.method +' '+ req.baseUrl+req.url +' '+res.statusCode+' ('+err.toString()+')';
};

if (!Models[mainDatabase]) {
	Models.Application.logger.emergency('Unable to load "'+mainDatabase+'" main database: not found. Aborting...');
	process.exit(-1);
}

Models.Application.datasource = new Models.Datasource();
Models.Application.datasource.setMainDatabase(new Models[mainDatabase](mainConfiguration[mainDatabase]));

if(mainConfiguration.passwordSalt === undefined || mainConfiguration.passwordSalt === ""
	|| mainConfiguration.passwordSalt === null) {
	Models.Application.logger.emergency('Please add salt configuration via TP_PW_SALT or config.json');
	process.exit(-1);
}
app.set('password_salt', mainConfiguration.passwordSalt);

app.use(function(req, res, next) {
	if (dbConnected)
		return next();
	res.type('application/json');
	next(new Models.TelepatError(Models.TelepatError.errors.ServerNotAvailable));
});

var loadApplications = function(callback) {
	Models.Application.loadAllApplications(function(err) {
		if (err) {
			Models.Application.logger.emergency('Fatal error: in retrieving all aplications', err);
			process.exit(-1);
		}

		callback();
	});
};

var linkMiddlewaresAndRoutes = function(callback) {
	app.use(bodyParser.json());
	app.use(function(req, res, next) {
		var send = res.send;

		res.send = function (string) {
			var body = string instanceof Buffer ? string.toString() : string;
			send.call(this, body);
			var copyBody = JSON.parse(body);
			var requestLogMessage = req.method +' '+ req.baseUrl+req.url +' '+res.statusCode;

			if (res._header && req._startAt) {
				var diff = process.hrtime(req._startAt);
				var ms = diff[0] * 1e3 + diff[1] * 1e-6;

				requestLogMessage += ms.toFixed(3) + 'ms';
			}

			if (res.statusCode >= 400)
				requestLogMessage += ' (['+copyBody.code+']: '+copyBody.message+')';

			requestLogMessage += ' ('+req.ip+')';

			Models.Application.logger.info(requestLogMessage);
		};
		next();
	});
	app.use(security.corsValidation);
	app.use(security.contentTypeValidation);
	/*Automatically parses request body from json string to object*/
	app.use('/admin', adminRoute);
	app.use('/object', objectRoute);
	app.use('/user', userRoute);
	app.use('/context', contextRoute);
	app.use('/device', deviceRoute);
	callback();
};

var linkErrorHandlingMiddlewares = function(callback) {
	// error handlers
	// catch 404 and forward to error handler
	app.use(function(req, res, next) {
		next(new Models.TelepatError(Models.TelepatError.errors.NoRouteAvailable));
	});

	app.use(function(err, req, res, next) {
		var responseBody = {};

		if (!(err instanceof Models.TelepatError)) {
			err = new Models.TelepatError(Models.TelepatError.errors.ServerFailure, [err.message]);
		}

		res.status(err.status);
		responseBody.code = err.code;
		responseBody.message = err.message;
		responseBody.status = err.status;

		if (err.stack && app.get('env') === 'development')
			responseBody.stack = err.stack;

		res.json(responseBody);
	});
	callback();
};

var monitorUsrSignals = function(callback) {
	//signal sent by nodemon when restarting the server
	process.on('SIGUSR2', function() {
		app.kafkaClient.close();
	});
	callback();
};

var OnServicesConnect = function() {
	async.series([
		loadApplications,
		linkMiddlewaresAndRoutes,
		linkErrorHandlingMiddlewares,
		monitorUsrSignals
	], function() {
		dbConnected = true;
	});
};

async.waterfall([
	function(callback) {
		Models.Application.datasource.dataStorage.onReady(function() {
			callback();
		});
	},
	function(callback) {
		if (Models.Application.redisClient)
			Models.Application.redisClient = null;

		Models.Application.redisClient = redis.createClient(redisConfig.port, redisConfig.host);
		Models.Application.redisClient.on('error', function(err) {
			Models.Application.logger.error('Failed connecting to Redis "'+redisConfig.host+'": '+err.message+'.' +
			'Retrying...');
		});
		Models.Application.redisClient.on('ready', function() {
			Models.Application.logger.info('Client connected to Redis.');
			callback();
		});
	},
	function(callback) {
		var clientConfiguration = mainConfiguration[messagingClient];

		if (!Models[messagingClient]) {
			Models.Application.logger.error('Unable to load "'+messagingClient+'" messaging queue: not found. ' +
			'Aborting...');
			process.exit(-1);
		}

		clientConfiguration = clientConfiguration || {broadcast: false};
		/**
		 * @type {MessagingClient}
		 */
		app.messagingClient = new Models[messagingClient](clientConfiguration, 'telepat-api');
		app.messagingClient.onReady(callback);
	}
], OnServicesConnect);

module.exports = app;
