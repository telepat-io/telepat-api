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

process.title = 'telepat-api';

var envVariables = {
	TP_MSG_QUE: process.env.TP_MSG_QUE,
	TP_REDIS_HOST: process.env.TP_REDIS_HOST,
	TP_REDIS_PORT: process.env.TP_REDIS_PORT,
	TP_MAIN_DB: process.env.TP_MAIN_DB,
	TP_PW_SALT: process.env.TP_PW_SALT,
};

var validEnvVariables = true;

var mainConfiguration = {
	main_database: envVariables.TP_MAIN_DB,
	message_queue: envVariables.TP_MSG_QUE,
	logger: process.env.TP_LOGGER,
	redis: {
		host: envVariables.TP_REDIS_HOST,
		port: envVariables.TP_REDIS_PORT
	},
	password_salt: envVariables.TP_PW_SALT,
	login_providers: {
		facebook: {
			client_id: process.env.TP_FB_CLIENT_ID,
			client_secret: process.env.TP_FB_CLIENT_SECRET
		},
		twitter: {
			consumer_key: process.env.TP_TW_CLIENT_KEY,
			consumer_secret: process.env.TP_TW_CLIENT_SECRET
		}
	}
};

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

var messagingClient = mainConfiguration.message_queue;
var mainDatabase = mainConfiguration.main_database;

if (validEnvVariables) {
	//is null just so the adapter constructor will try to check envVariables
	mainConfiguration[mainDatabase] = null;
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

if(mainConfiguration.password_salt === undefined || mainConfiguration.password_salt === ""
	|| mainConfiguration.password_salt === null) {
	Models.Application.logger.emergency('Please add salt configuration via TP_PW_SALT or config.json');
	process.exit(-1);
}
//app.set('password_salt', mainConfiguration.password_salt);

app.use(function(req, res, next) {
	if (dbConnected) {
		req._startAt = process.hrtime();
		res.on('finish', function() {
			res._startAt = process.hrtime();
		});

		return next();
	}
	res.type('application/json');
	next(new Models.TelepatError(Models.TelepatError.errors.ServerNotAvailable));
});

var loadApplications = function(callback) {
	Models.Application.loadAllApplications(null, null, function(err) {
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
			res.on('finish', function() {
				var copyBody = JSON.parse(body);
				var requestLogMessage = req.method +' '+ req.baseUrl+req.url +' '+res.statusCode;

				if (res._header && req._startAt && res._startAt) {
					var ms = (res._startAt[0] - req._startAt[0]) * 1e3
						+ (res._startAt[1] - req._startAt[1]) * 1e-6;

					requestLogMessage += ' ' + ms.toFixed(3) + ' ms';
				}

				if (res.statusCode >= 400)	{
					requestLogMessage += ' (['+copyBody.code+']: '+copyBody.message+')';
					if (res.statusCode >= 500 && res._telepatError)
						requestLogMessage += "\n"+res._telepatError.stack;
				}

				requestLogMessage += ' ('+req.ip+')';

				Models.Application.logger.info(requestLogMessage);
			});
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
		res._telepatError = err;
		res.json(responseBody);
	});
	callback();
};

var OnServicesConnect = function() {
	async.series([
		loadApplications,
		linkMiddlewaresAndRoutes,
		linkErrorHandlingMiddlewares
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

		Models.Application.redisClient = redis.createClient(mainConfiguration.redis.port, mainConfiguration.redis.host);
		Models.Application.redisClient.on('error', function(err) {
			Models.Application.logger.error('Failed connecting to Redis "'+mainConfiguration.redis.host+'": '+
				err.message+'. Retrying...');
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
