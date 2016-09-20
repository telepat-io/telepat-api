var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var https = require('https');
var urlParser = require('url');
var mandrill = require('mandrill-api');
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
var tilRoute = require('./controllers/til');

var dbConnected = false;
app = express();

app.disable('x-powered-by');
app.enable('trust proxy');

app.use('/documentation', express.static(__dirname+'/documentation'));

process.title = 'telepat-api';

var envVariables = {
	TP_MSG_QUE: process.env.TP_MSG_QUE,
	TP_REDIS_HOST: process.env.TP_REDIS_HOST,
	TP_REDIS_PORT: process.env.TP_REDIS_PORT,
	TP_REDISCACHE_HOST: process.env.TP_REDISCACHE_HOST || process.env.TP_REDIS_HOST ,
	TP_REDISCACHE_PORT: process.env.TP_REDISCACHE_PORT || process.env.TP_REDIS_PORT,
	TP_MAIN_DB: process.env.TP_MAIN_DB,
	TP_PW_SALT: process.env.TP_PW_SALT
};

var validEnvVariables = true;

var mainConfiguration = {
	main_database: envVariables.TP_MAIN_DB,
	message_queue: envVariables.TP_MSG_QUE,
	logger: {
		type: process.env.TP_LOGGER,
		settings: {
			level: process.env.TP_LOG_LEVEL
		}
	},
	redis: {
		host: envVariables.TP_REDIS_HOST,
		port: envVariables.TP_REDIS_PORT
	},
	redisCache: {
		host: envVariables.TP_REDISCACHE_HOST,
		port: envVariables.TP_REDISCACHE_PORT
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
				process.exit(1);
			} else
				throw e;
		}

		validEnvVariables = false;
		break;
	}
}

var messagingClient = mainConfiguration.message_queue;
var mainDatabase = mainConfiguration.main_database;

if (!Models[mainDatabase]) {
	Models.Application.logger.emergency('Unable to load "'+mainDatabase+'" main database: not found. Aborting...');
	process.exit(2);
}

if (validEnvVariables) {
	//is null just so the adapter constructor will try to check envVariables
	mainConfiguration[mainDatabase] = null;
}

app.telepatConfig = mainConfiguration;

if (mainConfiguration.logger) {
	mainConfiguration.logger.name = 'telepat-api:'+(process.env.PORT || 3000);
	Models.Application.logger = new Models.TelepatLogger(mainConfiguration.logger);
} else {
	Models.Application.logger = new Models.TelepatLogger({
		type: 'Console',
		name: 'telepat-api:'+(process.env.PORT || 3000),
		settings: {level: 'info'}
	});
}

app.getFailedRequestMessage = function(req, res, err) {
	return req.method +' '+ req.baseUrl+req.url +' '+res.statusCode+' ('+err.toString()+')';
};

Models.Application.datasource = new Models.Datasource();
Models.Application.datasource.setMainDatabase(new Models[mainDatabase](mainConfiguration[mainDatabase]));

if(mainConfiguration.password_salt === undefined || mainConfiguration.password_salt === ""
	|| mainConfiguration.password_salt === null) {
	Models.Application.logger.emergency('Please add salt configuration via TP_PW_SALT or config.json');
	process.exit(3);
}

//used for timing request time
app.use(function TimeKeeping(req, res, next) {
	req._startAt = process.hrtime();
	res.on('finish', function() {
		res._startAt = process.hrtime();
	});

	next();
});

app.use(bodyParser.json());
app.use(security.corsValidation);
app.use(security.contentTypeValidation);

app.use(function ServerNotAvailable(req, res, next) {
	if (!dbConnected) {
		next(new Models.TelepatError(Models.TelepatError.errors.ServerNotAvailable));
	} else {
		next();
	}
});

app.use(function RequestLogging(err, req, res, next) {
	var send = res.send;

	res.send = function (string) {
		var body = string instanceof Buffer ? string.toString() : string;
		send.call(this, body);
		res.on('finish', function() {
			var requestLogMessage = req.method +' '+ req.baseUrl+req.url +' '+res.statusCode;

			if (res._header && req._startAt && res._startAt) {
				var ms = (res._startAt[0] - req._startAt[0]) * 1e3
					+ (res._startAt[1] - req._startAt[1]) * 1e-6;

				requestLogMessage += ' ' + ms.toFixed(3) + ' ms';
			}

			try {
				var copyBody = JSON.parse(body);

				if (res.statusCode >= 400)	{
					requestLogMessage += ' (['+copyBody.code+']: '+copyBody.message+')';
					if (res.statusCode >= 500 && res._telepatError)
						requestLogMessage += "\n"+res._telepatError.stack;
				}
			} catch (e) {}

			requestLogMessage += ' ('+req.ip+')';

			Models.Application.logger.info(requestLogMessage);
		});
	};
	next(err);
});

function NotFoundMiddleware(req, res, next) {
	next(new Models.TelepatError(Models.TelepatError.errors.NoRouteAvailable));
}

function FinalRouteMiddleware(err, req, res, next) {
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
}

app.use(NotFoundMiddleware);
app.use(FinalRouteMiddleware);

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
	app.use('/proxy', security.applicationIdValidation);
	app.use('/proxy', security.apiKeyValidation);

	/**
	 * @api {post} /proxy Proxy
	 * @apiDescription Proxies a request to a specified URL
	 * @apiName Proxy
	 * @apiGroup Context
	 * @apiVersion 0.4.0
	 *
	 * @apiHeader {String} Content-type application/json
	 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
	 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
	 *
	 * @apiParam {string} method HTTP method (<b>GET</b>, <b>POST</b>, <b>PUT</b>, <b>DELETE</b>)
	 * @apiParam {string} url The URL where the request is made
	 * @apiParam {Object} headers A hashmap with  the headers of the request
	 * @apiParam {string} queryString A string represing a http query string
	 * @apiParam {string} body A string representing the request body
	 *
	 * @apiExample {json} Client Request
	 * 	{
 	 * 		"method": "GET",
 	 * 		"url": "http://www.example.com/",
 	 * 		"headers": {
 	 *			"accept": "text/html,application/xhtml+xml,application/xml;",
	 *			"accept-language": "en-US,en;q=0.8,ro;q=0.6",
	 *			"cache-control": "max-age=0",
	 *			"if-modified-since": "Fri, 18 Mar 2016 17:14:57 GMT",
	 *			"upgrade-insecure-requests": "1",
	 *			"user-agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.87 Safari/537.36"
 	 * 		}
 	 * 	}
	 *
	 *
	 */
	app.post('/proxy', function(req, res, next) {
		var method = req.body.method ? req.body.method.toUpperCase() : null;
		var url = req.body.url;
		var headers = req.body.headers;
		var queryString = req.body.queryString;
		var requestBody = req.body.body;

		if (['POST', 'GET', 'PUT', 'DELETE'].indexOf(method) === -1)
			return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
				['method must be one of '+['POST', 'GET', 'PUT', 'DELETE'].join(' ')]));
		if (!url)
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['url']));
		if (!headers || typeof headers != 'object')
			return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
				['headers must be object (or is missing)']));

		var parsedUrl = urlParser.parse(url);
		var urlProtocol = parsedUrl['protocol'];
		var requestObject = {
			host: parsedUrl['hostname'],
			port: parsedUrl['port'],
			path: parsedUrl['pathname'],
			method: method,
			headers: headers
		};
		var request = null;

		var responseCallback = function(response) {
			//response.setEncoding('utf8');
			var data = new Buffer('');

			response.on('data', function(payload) {
				if (payload instanceof Buffer)
					data = Buffer.concat([data, payload]);
			});

			response.on('end', function() {
				res.status(response.statusCode);
				res.set(response.headers);
				res.send(data);
			});
		};

		if (queryString)
			requestObject.path += queryString;

		if (urlProtocol == 'http:') {
			request = http.request(requestObject, responseCallback);
		} else if (urlProtocol == 'https:') {
			request = https.request(requestObject, responseCallback);
		}

		if (method == 'POST' && requestBody)
			request.write(requestBody.toString());

		request.on('error', function(e) {
			next(new Models.TelepatError(Models.TelepatError.errors.UnspecifiedError, [e.message]));
		});

		request.end();
	});


	/**
	 * @api {post} /email Email
	 * @apiDescription Sends an email address to multiple recipients
	 * @apiName Email
	 * @apiGroup Email
	 * @apiVersion 0.4.0
	 *
	 * @apiHeader {String} Content-type application/json
	 *
	 * @apiParam {string[]} recipients Array containing the email addresses of the recipients
	 * @apiParam {string} from Email address of the sender
	 * @apiParam {string} from_name (Optional) Name of the sender
	 * @apiParam {string} subject (Optional) Subject line
	 * @apiParam {string} body Body of the email. Can be plain text or html formatted
	 *
	 * @apiExample {json} Client Request
	 *	{
	 *		"recipients": ["user@example.com"],
	 *		"from": "admin@admin.com",
	 *		"from_name": "Admin",
	 *		"subject": "Testing",
	 *		"body": "Email body goes here"
	 *	}
	 *
	 */
	app.post('/email', function(req, res, next) {
		var recipients = req.body.recipients,
			from = req.body.from,
			from_name = req.body.from_name || null,
			subject = req.body.subject || '[No subject]',
			body = req.body.body;

		if (!recipients || !Array.isArray(recipients))
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['recipients']));
		if (!from)
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['from']));
		if (!body)
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['body']));

		var mandrillClient = new mandrill.Mandrill(app.telepatConfig.mandrill.api_key);

		recipients = recipients.map(function(r) {
			return {email: r, type: 'to'};
		});

		var message = {
			html: body,
			subject: subject,
			from_email: from,
			from_name: from_name,
			to: recipients
		};
		mandrillClient.messages.send({message: message, async: "async"}, function() {
			res.status(200).json({status: 200, content: "Email sent successfully"});
		}, function(err) {
			res.status(500).json({status: 500, message: "Failed to send email: "+err.message});
		});
	});

	app.use('/admin', adminRoute);
	app.use('/object', objectRoute);
	app.use('/user', userRoute);
	app.use('/context', contextRoute);
	app.use('/device', deviceRoute);
	app.use('/til', tilRoute);
	callback();
};

var OnServicesConnect = function() {
	//NotFoundMiddleware & FinalRouteMiddleware must always be the last ones so we need to remove & add them AFTER
	//mounting the other routes
	app._router.stack.splice(-2);

	async.series([
		loadApplications,
		linkMiddlewaresAndRoutes
	], function() {
		app.use(NotFoundMiddleware);
		app.use(FinalRouteMiddleware);
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

		var retry_strategy = function(options) {
			if (options.error && (options.error.code === 'ETIMEDOUT' || options.error.code === 'ECONNREFUSED'))
				return 1000;

			Models.Application.logger.error('Redis server connection lost "'+mainConfiguration.redis.host+'". Retrying...');
			// reconnect after
			return 3000;
		};

		Models.Application.redisClient = redis.createClient({
			port: mainConfiguration.redis.port,
			host: mainConfiguration.redis.host,
			retry_strategy: retry_strategy
		});
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
		if (Models.Application.redisCacheClient)
			Models.Application.redisCacheClient = null;

		var retry_strategy = function(options) {
			if (options.error && (options.error.code === 'ETIMEDOUT' || options.error.code === 'ECONNREFUSED'))
				return 1000;

			Models.Application.logger.error('Redis cache server connection lost "'+mainConfiguration.redisCache.host+'". Retrying...');

			// reconnect after
			return 3000;
		};

		Models.Application.redisCacheClient = redis.createClient({
			port: mainConfiguration.redisCache.port,
			host: mainConfiguration.redisCache.host,
			retry_strategy: retry_strategy
		});
		Models.Application.redisCacheClient.on('error', function(err) {
			Models.Application.logger.error('Failed connecting to Redis Cache "'+mainConfiguration.redisCache.host+'": '+
				err.message+'. Retrying...');
		});
		Models.Application.redisCacheClient.on('ready', function() {
			Models.Application.logger.info('Client connected to Redis Cache.');
			callback();
		});
	},
	function(callback) {
		var clientConfiguration = mainConfiguration[messagingClient];

		if (!Models[messagingClient]) {
			Models.Application.logger.error('Unable to load "'+messagingClient+'" messaging queue: not found. ' +
			'Aborting...');
			process.exit(5);
		}

		clientConfiguration = clientConfiguration || {broadcast: false};
		/**
		 * @type {MessagingClient}
		 */
		app.messagingClient = new Models[messagingClient](clientConfiguration, 'telepat-api', 'api');
		app.messagingClient.onReady(function() {

			app.messagingClient.onMessage(function(message) {
				var parsedMessage = JSON.parse(message);
				Models.SystemMessageProcessor.identity = 'api';
				if (parsedMessage._systemMessage) {
					Models.Application.logger.debug('Got system message: "'+message+'"');
					Models.SystemMessageProcessor.process(parsedMessage);
				}
			});
			callback();
		});

	}
], OnServicesConnect);

module.exports = app;
