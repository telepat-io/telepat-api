var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var https = require('https');
var urlParser = require('url');
var mandrill = require('mandrill-api');
var async = require('async');
var redis = require('redis');
var tlib = require('telepat-models');
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
		next(new tlib.TelepatError(tlib.TelepatError.errors.ServerNotAvailable));
	} else {
		next();
	}
});

app.use(function RequestLogging(req, res, next) {
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

			tlib.services.logger.info(requestLogMessage);
		});
	};
	next();
});

function NotFoundMiddleware(req, res, next) {
	next(new tlib.TelepatError(tlib.TelepatError.errors.NoRouteAvailable));
}

function FinalRouteMiddleware(err, req, res, next) {
	var responseBody = {};
	console.log("err is ", err);
	 if (!(err instanceof tlib.TelepatError)) {
	 	err = new tlib.TelepatError(tlib.TelepatError.errors.ServerFailure, [err.message]);
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
			return next(new tlib.TelepatError(tlib.TelepatError.errors.InvalidFieldValue,
				['method must be one of '+['POST', 'GET', 'PUT', 'DELETE'].join(' ')]));
		if (!url)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['url']));
		if (!headers || typeof headers != 'object')
			return next(new tlib.TelepatError(tlib.TelepatError.errors.InvalidFieldValue,
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
			next(new tlib.TelepatError(tlib.TelepatError.errors.UnspecifiedError, [e.message]));
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
			return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['recipients']));
		if (!from)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['from']));
		if (!body)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['body']));

		var mandrillClient = new mandrill.Mandrill(tlib.mandrill.api_key);

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
		linkMiddlewaresAndRoutes
	], function(err) {
		if (err) {
			console.log(err);

			return process.exit(1);
		}
		
		app.use(NotFoundMiddleware);
		app.use(FinalRouteMiddleware);
		dbConnected = true;
	});
};

tlib.init(null, 'telepat-api', OnServicesConnect);


module.exports = app;
