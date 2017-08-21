var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var expressJwt = require('express-jwt');
var bcrypt = require('bcrypt');
var async = require('async');
var tlib = require('telepat-models');

ACL_UNAUTHENTICATED = 1;
ACL_AUTHENTICATED = 2;
ACL_ADMIN = 4;
ACL_AUTHOR = 8;

var security = {};

security.authSecret = '835hoyubg#@$#2wfsda';

security.createToken = function (data) {
	return jwt.sign(data, this.authSecret, { expiresIn: 3600 });
};

security.encryptPassword = function(password, callback) {
	bcrypt.hash(password, tlib.config.password_salt, callback);
};

security.contentTypeValidation = function(req, res, next) {
	if (req.get('Content-Type') && req.get('Content-Type').substring(0, 16) !== 'application/json')
		return next(tlib.error(tlib.errors.InvalidContentType));
	else next();
};

security.apiKeyValidation = function(req, res, next) {
	if (req.get('X-BLGREQ-SIGN') === undefined)
		return next(tlib.error(tlib.errors.ApiKeySignatureMissing));
	else {
		var clientHash = req.get('X-BLGREQ-SIGN').toLowerCase();
		var serverHash = null;
		var apiKeys = tlib.apps[req.get('X-BLGREQ-APPID')].keys;

		async.detect(apiKeys, function(item ,cb) {
			if (item)
				serverHash = crypto.createHash('sha256').update(item).digest('hex').toLowerCase();
			cb(serverHash === clientHash);
		}, function(result) {
			if (result) {
				next();
			}
			else
				return next(tlib.error(tlib.errors.InvalidApikey));
		});
	}
};

security.deviceIdValidation = function(req, res, next) {
	if (req.get('X-BLGREQ-UDID') === undefined)
		return next(tlib.error(tlib.errors.DeviceIdMissing));
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
		return next(tlib.error(tlib.errors.ApplicationIdMissing));
	else {
		if (!tlib.apps[req.get('X-BLGREQ-APPID')]) {
			return next(tlib.error(tlib.errors.ApplicationNotFound,
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
	res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
	res.header("Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept, Authorization, X-BLGREQ-SIGN, X-BLGREQ-APPID, X-BLGREQ-UDID");
	if ('OPTIONS' == req.method) {
		res.status(200).end();
	}
	else {
		next();
	}
};

security.tokenValidation = function(req, res, next) {
	if (!req.headers.authorization) {
		
		let x = tlib.error(tlib.errors.AuthorizationMissing);
		return next(tlib.error(tlib.errors.AuthorizationMissing));
	}

	return (expressJwt({secret: security.authSecret}))(req, res, function(err) {
		if (err && err.message == 'jwt expired')	{
			return next(tlib.error(tlib.errors.ExpiredAuthorizationToken));
		} else if (err && err.message == 'jwt malformed') {
			return next(tlib.error(tlib.errors.MalformedAuthorizationToken));
		} else if (err && err.message == 'invalid signature' ) {
			return next(tlib.error(tlib.errors.MalformedAuthorizationToken));
		}
			return next(err);
	});
};

security.adminAppValidation = function (req, res, next) {
	var appId = req._telepat.applicationId;

	if (!req.user)
		return next();

	if (tlib.apps[appId].admins.indexOf(req.user.id) === -1) {
		return next(tlib.error(tlib.errors.ApplicationForbidden));
	}

	next();
};

function verifyAndSetUser(req, next, acl) {
	var authHeaderParts = req.headers.authorization.split(' ');
	var authToken = authHeaderParts[1];

	jwt.verify(authToken, security.authSecret, function (err, decoded) {
		if (err) {
			if (err.message == 'jwt expired')	{
				return next(tlib.error(tlib.errors.ExpiredAuthorizationToken));
			} else if (err.message == 'jwt malformed') {
				return next(tlib.error(tlib.errors.MalformedAuthorizationToken));
			} else if(err && err.message == 'invalid signature') {
				return next(tlib.error(tlib.errors.MalformedAuthorizationToken));
			} 
			else return next(err);
		}

		if (acl) {
			if ((!(acl & ACL_UNAUTHENTICATED)) && (!(acl & ACL_AUTHENTICATED)) &&  (acl & ACL_ADMIN) && (!decoded.isAdmin) ) {
				return next(tlib.error(tlib.errors.OperationNotAllowed));
			}
		}

		req.user = decoded;

		next();
	});
}

security.objectACL = function (accessControl) {
	return function(req, res, next) {
		if (!req.body || !Object.getOwnPropertyNames(req.body).length) {
			return next(tlib.error(tlib.errors.RequestBodyEmpty));
		}

		var mdl = null;

		if (req.body.model)
			mdl = req.body.model;
		else if (req.body.channel && req.body.channel.model)
			mdl = req.body.channel.model;
		else
			return next(tlib.error(tlib.errors.MissingRequiredField, ['model']));

		if (['context', 'application'].indexOf(mdl) !== -1)
			return next();
		else if (mdl === 'user') {
			return verifyAndSetUser(req, next);
		}

		if (!tlib.apps[req._telepat.applicationId].schema) {
			return next(tlib.error(tlib.errors.ApplicationHasNoSchema));
		}

		if (!tlib.apps[req._telepat.applicationId].schema[mdl]) {
			return next(tlib.error(tlib.errors.ApplicationSchemaModelNotFound,
				[req._telepat.applicationId, mdl]));
		}

		var acl = tlib.apps[req._telepat.applicationId].schema[mdl][accessControl];

		if (!req.headers.authorization && !(acl & ACL_UNAUTHENTICATED))
			return next(tlib.error(tlib.errors.AuthorizationMissing));
		else if (req.body.model || (req.body.channel && req.body.channel.model)) {
			if (!req.headers && (acl & ACL_AUTHOR)) {
				return next(tlib.errors(tlib.errors.OperationNotAllowed));
			} else if (!req.headers.authorization && acl & ACL_UNAUTHENTICATED) {
				next();
			} else if (acl & ACL_AUTHENTICATED || acl & ACL_ADMIN) {
				var authHeaderParts = req.headers.authorization.split(' ');
				var authToken = authHeaderParts[1];

				if (!authToken) {
					return next(tlib.error(tlib.errors.InvalidAuthorization,
						['authorization header field is not formed well']));
				} else {
					return verifyAndSetUser(req, next, acl);
				}
			}
			else {
				return next(tlib.error(tlib.errors.OperationNotAllowed));
			}
		} else {
			next(tlib.error(tlib.errors.MissingRequiredField, ['model or channel.model']));
		}
	}
};

module.exports = security;
