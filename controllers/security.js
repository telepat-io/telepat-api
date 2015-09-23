var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var Models = require('telepat-models');
var expressJwt = require('express-jwt');
var bcrypt = require('bcrypt');

ACL_UNAUTHENTICATED = 1;
ACL_AUTHENTICATED = 2;
ACL_ADMIN = 4;

var security = {};

security.authSecret = '835hoyubg#@$#2wfsda';

security.createToken = function (data) {
	return jwt.sign(data, this.authSecret, { expiresInMinutes: 60 });
};

security.encryptPassword = function(password, callback) {
	bcrypt.hash(password, app.get('password_salt'), callback);
};

security.deviceIDExists = function(req, res, next) {
	var deviceId = req._telepat.device_id;

	if (!deviceId) {
		return next(new Models.TelepatError(Models.TelepatError.errors.DeviceIdMissing));
	}

	next();
};

security.contentTypeValidation = function(req, res, next) {
	if (req.get('Content-Type') && req.get('Content-Type').substring(0, 16) !== 'application/json')
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidContentType));
	else next();
};

security.apiKeyValidation = function(req, res, next) {
	if (req.get('X-BLGREQ-SIGN') === undefined)
		return next(new Models.TelepatError(Models.TelepatError.errors.ApiKeySignatureMissing));
	else {
		var clientHash = req.get('X-BLGREQ-SIGN').toLowerCase();
		var serverHash = null;
		var apiKeys = app.applications[req.get('X-BLGREQ-APPID')].keys;

		async.detect(apiKeys, function(item ,cb) {
			serverHash = crypto.createHash('sha256').update(item).digest('hex').toLowerCase();
			cb(serverHash === clientHash);
		}, function(result) {
			if (result) {
				next();
			}
			else
				return next(new Models.TelepatError(Models.TelepatError.errors.InvalidApikey));
		});
	}
};

security.deviceIdValidation = function(req, res, next) {
	if (req.get('X-BLGREQ-UDID') === undefined)
		return next(new Models.TelepatError(Models.TelepatError.errors.DeviceIdMissing));
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
		return next(new Models.TelepatError(Models.TelepatError.errors.ApplicationIdMissing));
	else {
		if (!app.applications[req.get('X-BLGREQ-APPID')]) {
			return next(new Models.TelepatError(Models.TelepatError.errors.ApplicationNotFound,
				[req.get('X-BLGREQ-APPID')]));
		}

		if (req._telepat)
			req._telepat.applicationId = req.get('X-BLGREQ-APPID');
		else
			req._telepat = {applicationId: req.get('X-BLGREQ-APPID')};

		next();
	}
};

security.corsValidation = function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept, Authorization, X-BLGREQ-SIGN, X-BLGREQ-APPID, X-BLGREQ-UDID");
	if ('OPTIONS' == req.method) {
		res.send(200).end();
	}
	else {
		next();
	}
};

security.tokenValidation = function(req, res, next) {
	if (!req.headers.authorization)
		return next(new Models.TelepatError(Models.TelepatError.errors.AuthorizationMissing));

	return (expressJwt({secret: security.authSecret}))(req, res, next);
};

security.adminAppValidation = function (req, res, next) {
	var appId = req._telepat.applicationId;

	if (!app.applications[appId]) {
		return next(new Models.TelepatError(Models.TelepatError.errors.ApplicationNotFound, [appId]));
	}

	if (!req.user)
		return next();

	if (app.applications[appId].admins.indexOf(req.user.id) === -1) {
		return next(new Models.TelepatError(Models.TelepatError.errors.ApplicationForbidden));
	}

	next();
};

security.objectACL = function (accessControl) {
	return function(req, res, next) {
		if (!Object.getOwnPropertyNames(req.body).length) {
			next();
		} else if (req.body.model || (req.body.channel && req.body.channel.model)) {
			var mdl = req.body.model || req.body.channel.model;

			if (['user', 'context', 'application'].indexOf(mdl) !== -1)
				return next();

			if (!Models.Application.loadedAppModels[req._telepat.applicationId][mdl]) {
				return next(new Models.TelepatError(Models.TelepatError.errors.ApplicationSchemaModelNotFound,
					[req._telepat.applicationId, mdl]));
			}

			var acl = Models.Application.loadedAppModels[req._telepat.applicationId][mdl][accessControl];

			if (!req.headers.authorization)
				return next(new Models.TelepatError(Models.TelepatError.errors.AuthorizationMissing));

			if (acl & ACL_AUTHENTICATED || acl & ACL_ADMIN) {
				var authHeaderParts = req.headers.authorization.split(' ');
				var authToken = authHeaderParts[1];

				if (authToken) {
					jwt.verify(authToken, security.authSecret, function (err, decoded) {
						if (err)
							return next(new Models.TelepatError(Models.TelepatError.errors.InvalidAuthorization, [err.message]));

						if ((!(acl & ACL_UNAUTHENTICATED)) && (!(acl & ACL_AUTHENTICATED)) &&  (acl & ACL_ADMIN) && (!decoded.isAdmin) )
							return next(new Models.TelepatError(Models.TelepatError.errors.OperationNotAllowed));

						req.user = decoded;

						next();
					});
				} else {
					return next(new Models.TelepatError(Models.TelepatError.errors.InvalidAuthorization,
						['authorization header field is not formed well']));
				}
			}
			else if (acl & ACL_UNAUTHENTICATED) {
				next();
			} else {
				return next(new Models.TelepatError(Models.TelepatError.errors.OperationNotAllowed));
			}
		} else {
			next();
		}
	}
};

module.exports = security;
