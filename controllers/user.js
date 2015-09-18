var express = require('express');
var router = express.Router();
var FB = require('facebook-node');
var async = require('async');
var Models = require('telepat-models');
var security = require('./security');
var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var microtime = require('microtime-nodejs');

var options = {
	client_id:          '1086083914753251',
	client_secret:      '40f626ca66e4472e0d11c22f048e9ea8'
};

FB.options(options);

router.use(security.deviceIdValidation);
router.use(security.applicationIdValidation);
router.use(security.apiKeyValidation);

router.use(['/logout', '/me', '/update'], security.tokenValidation);

/**
 * @api {post} /user/login Login
 * @apiDescription Log in the user through facebook
 * @apiName UserLogin
 * @apiGroup User
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiParam {String} access_token Facebook access token.
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"access_token": "fb access token"
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			"token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhYmlAYXBwc2NlbmQuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaWF0IjoxNDMyOTA2ODQwLCJleHAiOjE0MzI5MTA0NDB9.knhPevsK4cWewnx0LpSLrMg3Tk_OpchKu6it7FK9C2Q"
 * 			"user": {
 * 				 "id": 31,
 *				"type": "user",
 * 				"email": "abcd@appscend.com",
 * 				"fid": "facebook_id",
 * 				"devices": [
 *					"466fa519-acb4-424b-8736-fc6f35d6b6cc"
 *				],
 *				"friends": [],
 *				"password": "acb8a9cbb479b6079f59eabbb50780087859aba2e8c0c397097007444bba07c0"
 *			}
 * 		}
 * 	}
 *
 * 	@apiError 400 <code>InsufficientFacebookPermissions</code> User email is not publicly available (insufficient facebook permissions)
 *
 */
router.post('/login', function(req, res, next) {
	if (!req.body.access_token)
		res.status(400).json({status: 400, message: "Facebook access token is missing"}).end();

	var accessToken = req.body.access_token;
	var email = null;
	var userProfile = null;
	var fbProfile = null;
	var deviceId = req._telepat.device_id;
	var appId = req._telepat.application_id;

	async.waterfall([
		//Retrieve facebook information
		function(callback) {
			FB.napi('/me', {access_token: accessToken}, function(err, result) {
				if (err) return callback(err);
				email = result.email;
				fbProfile = result;

				if (!email) {
					var error = new Error('User email is not publicly available (insufficient facebook permissions)');
					error.status = 400;
					callback(error);
				}

				callback();
			});
		},
		function(callback) {
			//try and get user profile from DB
			Models.User(email, appId, function(err, result) {
				if (err && err.status == 404) {
					var error = new Error('User with email address not found');
					error.status = 404;
					callback(error);
				}
				else if (err)
					callback(err);
				else {
					userProfile = result;
					callback();
				}
			});
		},
		//update user with deviceID if it already exists
		function(callback) {
			if (userProfile.devices) {
				var idx = userProfile.devices.indexOf(deviceId);
				if (idx === -1)
					userProfile.devices.push(deviceId);
			} else {
				userProfile.devices = [deviceId];
			}
			var patches = [];
			patches.push({op: 'replace', path: 'user/'+userProfile.id+'/devices', value: userProfile.devices});

			if (userProfile.name != fbProfile.name)
				patches.push({op: 'replace', path: 'user/'+userProfile.id+'/name', value: fbProfile.name});
			if (userProfile.gender != fbProfile.gender)
				patches.push({op: 'replace', path: 'user/'+userProfile.id+'/gender', value: fbProfile.gender});

			Models.User.update(userProfile.email, appId, patches, callback);

			//user first logged in with password then with fb
			/*if (!userProfile.fid) {
				var key = 'blg:'+Models.User._model.namespace+':fid:'+fbProfile.id;
				Models.Application.bucket.insert(key, userProfile.email, function() {
					userProfile.fid = fbProfile.id;
					userProfile.name = fbProfile.name;
					userProfile.gender = fbProfile.gender;

					Models.User.update(userProfile.email, userProfile, callback);
				});
			} else {
				callback(null, true);
			}*/
		}
		//final step: send authentification token
	], function(err, results) {
		if (err)
			return next(err);
		else {
			var token = jwt.sign({email: userProfile.email, id: userProfile.id}, security.authSecret, { expiresInMinutes: 60 });
			res.json({status: 200, content: {token: token, user: userProfile}}).end();
		}
	});
});

/**
 * @api {post} /user/register Register
 * @apiDescription Registers a new user using a fb token or directly with an email and password
 * @apiName UserRegister
 * @apiGroup User
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiParam {String} access_token Facebook access token.
 *
 * @apiExample {json} Facebook Request
 * 	{
 * 		"access_token": "fb access token"
 * 	}
 *
 * @apiExample {json} Client Request (with password)
 *
 * {
 * 		"email": "example@appscend.com",
 * 		"password": "secure_password1337",
 * 		"name": "John Smith"
 * }
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 202,
 * 		"content": "User created"
 * 	}
 *
 * 	@apiError 400 <code>InsufficientFacebookPermissions</code> User email is not publicly available (insufficient facebook permissions)
 * 	@apiError 409 <code>UserAlreadyExists</code> User with that email address already exists
 *
 */
router.post('/register', function(req, res, next) {
	if (!req.body)
		res.status(400).json({status: 400, message: "Request body is empty"}).end();

	var userProfile = req.body;
	var accessToken = req.body.access_token;
	var fbFriends = [];
	var deviceId = req._telepat.device_id;
	var appId = req._telepat.application_id;

	async.waterfall([
		function(callback) {
			if (accessToken) {
				FB.napi('/me', {access_token: accessToken}, function(err, result) {
					if (err) return callback(err);

					userProfile = result;

					if (!userProfile.email) {
						var error = new Error('User email is not publicly available (insufficient facebook permissions)');
						error.status = 400;
						callback(error);
					}

					callback();
				});
			} else {
				callback();
			}
		},
		function(callback) {
			//get his/her friends
			if (accessToken) {
				FB.napi('/me/friends', {access_token: accessToken}, function(err, result) {
					if (err) return callback(err);

					for(var f in result.data) {
						fbFriends.push(result.data[f].id);
					}
					callback();
				});
			} else
				callback();
		},
		function(callback) {
			if (!userProfile.email) {
				var error = new Error('Email address is missing from the request body or facebook access token not provided');
				error.status = 400;
				return callback(error);
			}

			Models.User(userProfile.email, appId, function(err, result) {
				if (!err) {
					var error = new Error('User with that email address already exists');
					error.status = 409;
					callback(error);
				}
				else if (err && err.status != 404)
					callback(err);
				else {
					callback();
				}
			});
		},
		//send message to kafka if user doesn't exist in order to create it
		function(callback) {
			/*var props = {
			 email: userProfile.email,
			 fid: userProfile.id,
			 name: userProfile.name,
			 gender: userProfile.gender,
			 friends: fbFriends,
			 devices: [deviceId]
			 };*/

			userProfile.friends = fbFriends;
			userProfile.type = 'user';
			userProfile.devices = [deviceId];

			if (userProfile.password)
				security.encryptPassword(userProfile.password, callback);
			else
				callback(null, false);

		}, function(hash, callback) {
			if (hash !== false)
				userProfile.password = hash;

			app.kafkaProducer.send([{
				topic: 'aggregation',
				messages: [JSON.stringify({
					op: 'add',
					object: userProfile,
					applicationId: req._telepat.application_id,
					isUser: true
				})],
				attributes: 0
			}], callback);
		},
		//add this user to his/her friends array
		function(result, callback) {
			if (fbFriends.length) {
				app.kafkaProducer.send([{
					topic: 'update_friends',
					messages: [JSON.stringify({fid: userProfile.id, friends: fbFriends})],
					attributes: 0
				}], callback);
			} else
				callback();
		}
	], function(err) {
		if (err) return next(err);

		res.status(202).json({status: 202, content: 'User created'}).end();
	});
});

/**
 * @api {get} /user/me Info about logged user
 * @apiDescription Logs in the user with a password; creates the user if it doesn't exist
 * @apiName UserLoginPassword
 * @apiGroup User
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiParam {String} password The password
 * @apiParam {String} email The email
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"content": {
 *			"id": 31,
 *			"type": "user",
 * 			"email": "abcd@appscend.com",
 * 			"fid": "",
 * 			"devices": [
 *				"466fa519-acb4-424b-8736-fc6f35d6b6cc"
 *			],
 *			"friends": [],
 *			"password": "acb8a9cbb479b6079f59eabbb50780087859aba2e8c0c397097007444bba07c0"
 * 		}
 * 	}
 *
 * 	@apiError 401 <code>InvalidCredentials</code> User email and password did not match
 *
 */
router.get('/me', function(req, res, next) {
	Models.User(req.user.email, req._telepat.application_id, function(err, result) {
		if (err && err.status == 404) {
			var error = new Error('User not found');
			error.status = 404;

			return next(error);
		}
		else if (err)
			next(err);
		else
			delete result.password;
			res.status(200).json({status: 200, content: result}).end();
	});
});

/**
 * @api {post} /user/login_password Password login
 * @apiDescription Logs in the user with a password; creates the user if it doesn't exist
 * @apiName UserLoginPassword
 * @apiGroup User
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiParam {String} password The password
 * @apiParam {String} email The email
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"email": "user@example.com",
 * 		"password": "magic-password1337"
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"content": {
 * 			"token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhYmlAYXBwc2NlbmQuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaWF0IjoxNDMyOTA2ODQwLCJleHAiOjE0MzI5MTA0NDB9.knhPevsK4cWewnx0LpSLrMg3Tk_OpchKu6it7FK9C2Q"
 * 			"user": {
 * 				"id": 31,
 *				"type": "user",
 * 				"email": "abcd@appscend.com",
 * 				"fid": "",
 * 				"devices": [
 *					"466fa519-acb4-424b-8736-fc6f35d6b6cc"
 *				],
 *				"friends": [],
 *				"password": "acb8a9cbb479b6079f59eabbb50780087859aba2e8c0c397097007444bba07c0"
 * 			}
 * 		}
 * 	}
 *
 * 	@apiError 401 <code>InvalidCredentials</code> User email and password did not match
 *  @apiError 404 <code>UserNotFound</code> User with that email address doesn't exist
 *
 */
router.post('/login_password', function(req, res, next) {
	if (!req.body.email)
		return res.status(400).json({status: 400, message: "Missing email address"}).end();

	if (!req.body.password)
		return res.status(400).json({status: 400, message: "Missing password"}).end();

	var userProfile = null;
	var email = req.body.email;
	var password = req.body.password.toString();
	var deviceId = req._telepat.device_id;
	var appId = req._telepat.application_id;

	var hashedPassword = null;

	async.series([
		function(callback) {
			//try and get user profile from DB
			Models.User(email, appId, function(err, result) {
				if (err && err.status == 404) {
					var error = new Error('User with email address not found');
					error.status = 404;
					callback(error);
				}
				else if (err)
					callback(err);
				else {
					userProfile = result;
					callback();
				}
			});
		},
		function(callback) {
			security.encryptPassword(req.body.password, function(err, hash) {
				if (err)
					return callback(err);

				hashedPassword = hash;

				callback();
			});
		}
	], function(err) {
		if (err)
			return next(err);

		if (hashedPassword != userProfile.password) {
			res.status(401).json({status: 401, message: 'wrong password'}).end();

			return;
		}

		delete userProfile.password;

		var token = jwt.sign({email: email, id: userProfile.id}, security.authSecret, { expiresInMinutes: 60 });
		res.json({status: 200, content: {user: userProfile, token: token }}).end();
	});
});

/**
 * @api {get} /user/logout Logout
 * @apiDescription Logs out the user removing the device from his array of devices.
 * @apiName UserLogout
 * @apiGroup User
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": "Logged out of device"
 * 	}
 *
 * @apiError NotAuthenticated  Only authenticated users may access this endpoint.
 */
router.get('/logout', function(req, res, next) {
	var deviceId = req._telepat.device_id;
	var email = req.user.email;

	async.waterfall([
		function(callback) {
			Models.User(email, callback);
		},
		function(user, callback) {
			if (user.devices) {
				var idx = user.devices.indexOf(deviceId);
				if (idx >= 0)
					user.devices.splice(idx, 1);

				Models.User.update(email, {devices: user.devices}, callback);
			} else {
				callback();
			}
		}
	], function(err, result) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: "Logged out of device"}).end();
	});
});


/**
 * @api {get} /user/refresh_token Refresh Token
 * @apiDescription Sends a new authentification token to the user. The old token must be provide (and it may or not
 * may not be aleady expired).
 * @apiName RefreshToken
 * @apiGroup User
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhYmlAYXBwc2NlbmQuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaWF0IjoxNDMyOTA2ODQwLCJleHAiOjE0MzI5MTA0NDB9.knhPevsK4cWewnx0LpSLrMg3Tk_OpchKu6it7FK9C2Q"
 * 		}
 * 	}
 *
 * @apiError NotAuthenticated  If authorization header is missing or invalid.
 *
 * @apiErrorExample {json} Error Response
 * 	{
 * 		status: 400,
 * 		message: "Token not present or authorization header is invalid"
 * 	}
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		status: 400,
 * 		message: "Malformed authorization token"
 * 	}
 */
router.get('/refresh_token', function(req, res, next) {
	if (!req.get('Authorization')) {
		res.status(400).json({status: 400, message: 'Required Authorization header is missing'}).end();

		return;
	}

	var authHeader = req.get('Authorization').split(' ');
	if (authHeader[0] == 'Bearer' && authHeader[1]) {
		try {
			var decoded = jwt.decode(authHeader[1]);
		} catch (e) {
			return res.status(400).json({status: 400, message: e.message}).end();
		}

		if (!decoded) {
			return res.status(400).json({status: 400, message: 'Malformed authorization token'}).end();
		}

		var newToken = jwt.sign(decoded, security.authSecret, {expiresInMinutes: 60});

		return res.status(200).json({status: 200, content: {token: newToken}}).end();
	} else {
		return res.status(400).json({status: 400, message: 'Token not present or authorization header is invalid'}).end();
	}
});

/**
 * @api {post} /user/update Update
 * @apiDescription Updates the user information
 * @apiName UserUpdate
 * @apiGroup User
 * @apiVersion 0.2.2
 *
 * @apiParam {Object[]} patches Array of patches that describe the modifications
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 202,
 * 		"content": "User updated"
 * 	}
 *
 */
router.post('/update', function(req, res, next) {
	var patches = req.body.patches;
	var id = req.user.id;
	var email = req.user.email;
	var modifiedMicrotime = microtime.now();

	var i = 0;
	async.eachSeries(patches, function(p, c) {
		patches[i].email = email;

		if (patches[i].path.split('/')[2] == 'password') {

			security.encryptPassword(patches[p].value, function(err, hash) {
				patches[p].value = hash;
				i++;
				c();
			});
		} else {
			i++;
			c();
		}
	}, function() {
		async.eachSeries(patches, function(patch, c) {
			app.kafkaProducer.send([{
				topic: 'aggregation',
				messages: [JSON.stringify({
					op: 'update',
					object: patch,
					id: id,
					applicationId: req._telepat.application_id,
					isUser: true,
					ts: modifiedMicrotime
				})],
				attributes: 0
			}], c);
		}, function(err) {
			if (err) return next(err);

			res.status(202).json({status: 202, content: "User updated"}).end();
		});
	});
});

router.post('/update_immediate', function(req, res, next) {
	var user = req.body;

	if (user.password) {
		var passwordSalt = req.app.get('password_salt');
		var md5password = crypto.createHash('md5').update(user.password).digest('hex');
		user.password = crypto.createHash('sha256').update(passwordSalt[0]+md5password+passwordSalt[1]).digest('hex');
	}

	async.waterfall([
		function(callback) {
			security.encryptPassword(user.password, callback);
		},
		function(hash, callback) {
			user.password = hash;

			Models.User.update(user.email, user, function(err, result) {
				if (err) return next(err);

				res.status(200).json({status: 200, content: "User updated"}).end();
			});
		}
	]);
});

/**
 * @api {post} /user/delete Delete
 * @apiDescription Deletes a user
 * @apiName UserDelete
 * @apiGroup User
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiParam {number} id ID of the user
 * @apiParam {string} email Email of the user
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 202,
 * 		"content": "User deleted"
 * 	}
 *
 */
router.post('/delete', function(req, res, next) {
	var id = req.body.id;
	var email = req.body.email;

	app.kafkaProducer.send([{
		topic: 'aggregation',
		messages: [JSON.stringify({
			op: 'delete',
			object: {id: id, email: email},
			applicationId: req._telepat.application_id,
			isUser: true
		})],
		attributes: 0
	}], function(err) {
		if (err) return next(err);

		res.status(202).json({status: 202, content: "User deleted"}).end();
	});
});

module.exports = router;
