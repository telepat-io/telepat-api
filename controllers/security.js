var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var Models = require('telepat-models');
var expressJwt = require('express-jwt');

ACL_UNAUTHENTICATED = 1;
ACL_AUTHENTICATED = 2;
ACL_ADMIN = 4;

var security = {};

security.authSecret = '835hoyubg#@$#2wfsda';

security.createToken = function (data) {
	return jwt.sign(data, this.authSecret, { expiresInMinutes: 60 });
};

security.deviceIDExists = function(req, res, next) {
	var deviceId = req._telepat.device_id;

	if (!deviceId) {
		var error = new Error('Missing device id in headers');
		error.status = 400;

		return next(error);
	}

	next();
};

security.contentTypeValidation = function(req, res, next) {
	if (req.get('Content-Type').substring(0, 16) !== 'application/json')
		res.status(415).json({status: 415, message: "Request content type must pe application/json."}).end();
	else next();
};

security.apiKeyValidation = function(req, res, next) {
	if (req.get('X-BLGREQ-SIGN') === undefined)
		res.status(401).json({status: 401, message: "Unauthorized. Required authorization header not present."}).end();
	else next();
};

security.deviceIdValidation = function(req, res, next) {
	if (req.get('X-BLGREQ-UDID') === undefined)
		res.status(401).json({status: 401, message: "Unauthorized. Device identifier header not present."}).end();
	else {
		if (req._telepat)
			req._telepat.device_id = req.get('X-BLGREQ-UDID');
		else
			req._telepat = {device_id: req.get('X-BLGREQ-UDID')};
		next();
	}
};

security.applicationIdValidation = function(req, res, next) {
	if (!req.get('X-BLGREQ-APPID'))
		res.status(400).json({status: 400, message: "Requested App ID not found."}).end();
	else {
		if (!app.applications[req.get('X-BLGREQ-APPID')]) {
			var error = new Error('Application with ID "'+req.get('X-BLGREQ-APPID')+'" doest not exist.');
			error.status = 404;

			return next(error);
		}

		var clientHash = req.get('X-BLGREQ-SIGN').toLowerCase();
		var serverHash = null;
		var apiKeys = app.applications[req.get('X-BLGREQ-APPID')].keys;

		async.detect(apiKeys, function(item ,cb) {
			serverHash = crypto.createHash('sha256').update(item).digest('hex').toLowerCase();
			cb(serverHash === clientHash);
		}, function(result) {
			if (result) {
				if (req._telepat)
					req._telepat.application_id = req.get('X-BLGREQ-APPID');
				else
					req._telepat = {application_id: req.get('X-BLGREQ-APPID')};
				console.log(req._telepat);
				next();
			}
			else
				res.status(401).json({status: 401, message: "Unauthorized. API key is not valid."}).end();
		});
	}
};

security.corsValidation = function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-BLGREQ-SIGN, X-BLGREQ-APPID, X-BLGREQ-UDID");
	if ('OPTIONS' == req.method) {
		res.send(200).end();
	}
	else {
		next();
	}
};

security.tokenValidation = function(req, res, next) {
	return (expressJwt({secret: security.authSecret}))(req, res, next);
};

security.adminAppValidation = function (req, res, next) {
	var appId = req._telepat.application_id;

	if (!app.applications[appId]) {
		res.status(404).json({status: 404, message: "Application with ID '"+appId+"' does not exist"}).end();
		return;
	}

	if (!req.user)
		return next();

	if (app.applications[appId].admin_id != req.user.email) {
		res.status(401).json({status: 401, message: "This application does not belong to you"}).end();
		return ;
	}

	next();
};

security.objectACL = function (accessControl) {
	return function(req, res, next) {
		if (req.body.model || req.body.channel.model) {
			var mdl = req.body.model || req.body.channel.model;

			if (['user', 'context', 'application'].indexOf(mdl) !== -1)
				return next();

			if (!Models.Application.loadedAppModels[req._telepat.application_id][mdl]) {
				var error = new Error('Model name "'+mdl+'" does not exist.');
				error.status = 404;

				return next(error);
			}

			var acl = Models.Application.loadedAppModels[req._telepat.application_id][mdl][accessControl];

			if (!req.headers.authorization)
				return res.status(401).json({status: 401, message: "Authorization header is not present"}).end();

			if (acl & ACL_AUTHENTICATED || acl & ACL_ADMIN) {
				var authHeaderParts = req.headers.authorization.split(' ');
				var authToken = authHeaderParts[1];

				if (authToken) {
					jwt.verify(authToken, security.authSecret, function (err, decoded) {
						if (err)
							return res.status(401).json({status: 401, message: "Invalid authorization: " + err.message}).end();

						if ((!(acl & ACL_UNAUTHENTICATED)) && (!(acl & ACL_AUTHENTICATED)) &&  (acl & ACL_ADMIN) && (!decoded.isAdmin) )
							return res.status(403).json({status: 403, message: "You don't have the necessary privilegies for this operation"}).end();

						req.user = decoded;

						next();
					});
				} else {
					res.status(400).json({status: 400, message: 'Authorization header field is not formed well'}).end();
				}
			}
			else if (acl & ACL_UNAUTHENTICATED) {
				next();
			} else {
				res.status(403).json({status: 403, message: "You don't have the necessary privilegies for this operation"}).end();
			}
		}
	}
};

module.exports = security;
