var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var https = require('https');
var urlParser = require('url');
var mandrill = require('mandrill-api');
var async = require('async');
var Models = require('telepat-models');
var redis = require('redis');
colors = require('colors');

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

app.getFailedRequestMessage = function(req, res, err) {
	return req.method +' '+ req.baseUrl+req.url +' '+res.statusCode+' ('+err.toString()+')';
};

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
		next();
	});
	app.use(security.corsValidation);
	app.use(security.contentTypeValidation);

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
	], function(err) {
		if (err) {
			console.log(err);

			return process.exit(1);
		}
		dbConnected = true;
	});
};

async.waterfall([
	function(callback) {
		app.telepatConfig = new Models.ConfigurationManager('./config.spec.json', './config.json');
		app.telepatConfig.load(function(err) {
			if (err) return callback(err);

			var testResult = app.telepatConfig.test();
			callback(testResult !== true ? testResult : undefined);
		});
	},
	function(callback) {
		if (app.telepatConfig.config.logger) {
			app.telepatConfig.config.logger.name = 'telepat-api:'+(process.env.PORT || 3000);
			Models.Application.logger = new Models.TelepatLogger(app.telepatConfig.config.logger);
		} else {
			Models.Application.logger = new Models.TelepatLogger({
				type: 'Console',
				name: 'telepat-api:'+(process.env.PORT || 3000),
				settings: {level: 'info'}
			});
		}
		var mainDatabase = app.telepatConfig.config.main_database;

		if (!Models[mainDatabase]) {
			Models.Application.logger.emergency('Unable to load "' + mainDatabase + '" main database: not found. Aborting...');
			process.exit(2);
		}

		Models.Application.datasource = new Models.Datasource();
		Models.Application.datasource.setMainDatabase(new Models[mainDatabase](app.telepatConfig.config[mainDatabase]));

		callback();
	},
	function(callback) {
		Models.Application.datasource.dataStorage.onReady(function() {
			callback();
		});
	},
	function(callback) {
		if (Models.Application.redisClient)
			Models.Application.redisClient = null;

		var redisConf = app.telepatConfig.config.redis;

		Models.Application.redisClient = redis.createClient(redisConf.port, redisConf.host);
		Models.Application.redisClient.on('error', function(err) {
			Models.Application.logger.error('Failed connecting to Redis "' + redisConf.host + '": ' +
				err.message + '. Retrying...');
		});
		Models.Application.redisClient.on('ready', function() {
			Models.Application.logger.info('Client connected to Redis.');
			callback();
		});
	},
	function(callback) {
		if (Models.Application.redisCacheClient)
			Models.Application.redisCacheClient = null;

		var redisCacheConf = app.telepatConfig.config.redisCache;

		Models.Application.redisCacheClient = redis.createClient(redisCacheConf.port, redisCacheConf.host);
		Models.Application.redisCacheClient.on('error', function(err) {
			Models.Application.logger.error('Failed connecting to Redis Cache "' + redisCacheConf.host + '": ' +
				err.message + '. Retrying...');
		});
		Models.Application.redisCacheClient.on('ready', function() {
			Models.Application.logger.info('Client connected to Redis Cache.');
			callback();
		});
	},
	function(callback) {
		var messagingClient = app.telepatConfig.config.message_queue;
		var clientConfiguration = app.telepatConfig.config[messagingClient];

		if (!Models[messagingClient]) {
			Models.Application.logger.error('Unable to load "'+messagingClient+'" messaging queue: not found. ' +
			'Aborting...');
			process.exit(5);
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
