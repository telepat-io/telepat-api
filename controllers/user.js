var express = require('express');
var router = express.Router();
var FB = require('facebook-node');
var async = require('async');
var Models = require('telepat-models');
var security = require('./security');
var jwt = require('jsonwebtoken');
var crypto = require('crypto');

var options = {
	client_id:          '1086083914753251',
	client_secret:      '40f626ca66e4472e0d11c22f048e9ea8'
};

FB.options(options);

router.use(security.keyValidation);
router.use(security.deviceIDExists);
router.use('/logout', security.tokenValidation);
router.use('/me', security.tokenValidation);

/**
 * @api {post} /user/login Login
 * @apiDescription Log in the user and create it if it doesn't exist in database.
 * @apiName UserLogin
 * @apiGroup User
 * @apiVersion 0.1.2
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
	var accessToken = req.body.access_token;
	var email = null;
	var userProfile = null;
	var fbProfile = null;
	var deviceId = req._telepat.device_id;

	async.waterfall([
		//Retrieve facebook information
		function(callback) {
			FB.napi('/me', {access_token: accessToken}, function(err, result) {
				if (err) return callback(err);
				userProfile = result;
				email = result.email;

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
			Models.User(email, function(err, result) {
				if (err && err.code == cb.errors.keyNotFound) {
					var error = new Error('User with email address not found');
					error.status = 404;
					callback(error);
				}
				else if (err)
					callback(err);
				else {
					userProfile = result;
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

			//user first logged in with password then with fb
			if (!userProfile.fid) {
				var key = 'blg:'+User._model.namespace+':fid:'+fbProfile.id;
				Application.bucket.insert(key, userProfile.email, function() {
					userProfile.fid = fbProfile.id;
					userProfile.name = fbProfile.name;
					userProfile.gender = fbProfile.gender;

					Models.User.update(userProfile.email, userProfile, callback);
				});
			} else {
				callback(null, true);
			}
		}
		//final step: send authentification token
	], function(err, results) {
		if (err)
			res.status(400).json(err).end();
		else {
			var token = jwt.sign({email: userProfile.email}, security.authSecret, { expiresInMinutes: 60 });
			res.json({status: 200, content: {token: token, user: userProfile}}).end();
		}
	});
});

router.post('/register', function(req, res, next) {
	var userProfile = req.body;
	var accessToken = req.body.access_token;
	var fbFriends = [];
	var deviceId = req._telepat.device_id;

	async.waterfall([
		function(callback) {
			if (accessToken) {
				FB.napi('/me', {access_token: accessToken}, function(err, result) {
					if (err) return callback(err);

					if (!userProfile.email) {
						var error = new Error('User email is not publicly available (insufficient facebook permissions)');
						error.status = 400;
						callback(error);
					}

					userProfile = result;

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
			Models.User(userProfile.email, function(err, result) {
				if (!err) {
					var error = new Error('User with that email address already exists');
					error.code = 409;
					callback(error);
				}
				else if (err && err.code !== cb.errors.keyNotFound)
					callback(err);
				else {
					callback();
				}
			});
		},
		//send message to kafka if user doesn't exist in order to create it
		function(result, callback) {
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

			if (userProfile.password) {
				var passwordSalt = req.app.get('password_salt');
				var md5password = crypto.createHash('md5').update(userProfile.password).digest('hex');
				userProfile.password = crypto.createHash('sha256').update(passwordSalt[0]+md5password+passwordSalt[1]).digest('hex');
			}

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

	/*async.waterfall([
		function(callback) {
			Models.User(req.body.email, function(err, result) {
				if (!err) {
					var error = new Error('User with that email address already exists');
					error.code = 409;
					callback(error);
				}
				else if (err && err.code !== cb.errors.keyNotFound)
					callback(err);
				else {
					callback();
				}
			});
		},
		function(callback) {
			/!*var props = {
				email: props.email,
				fid: "",
				name: props.name,
				gender: userProfile.gender,
				friends: fbFriends,
				devices: [deviceId]
			};*!/

			props.fid = "";
			props.friends = [];
			props.devices = [deviceId];
			props.type = 'user';

			app.kafkaProducer.send([{
				topic: 'aggregation',
				messages: [JSON.stringify({
					op: 'add',
					object: props,
					applicationId: req._telepat.application_id,
					isUser: true
				})],
				attributes: 0
			}], callback);
		}
	], function(err) {
		if (err) return next(err);


	});*/
});

/**
 * @api {post} /user/me Info about logged user
 * @apiDescription Logs in the user with a password; creates the user if it doesn't exist
 * @apiName UserLoginPassword
 * @apiGroup User
 * @apiVersion 0.2.1
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
	Models.User(req.user.email, function(err, result) {
		if (err && err.code == cb.errors.keyNotFound) {
			var error = new Error('User not fount');
			error.status = 404;

			return next(error);
		}
		else if (err)
			next(err);
		else
			next(null, result);
	});
});

/**
 * @api {post} /user/login_password Password login
 * @apiDescription Logs in the user with a password; creates the user if it doesn't exist
 * @apiName UserLoginPassword
 * @apiGroup User
 * @apiVersion 0.1.2
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
 * 		}
 * 	}
 *
 * 	@apiError 401 <code>InvalidCredentials</code> User email and password did not match
 *
 */
router.post('/login_password', function(req, res, next) {
	var userProfile = null;
	var email = req.body.email;
	var password = req.body.password;
	var deviceId = req._telepat.device_id;

	var passwordSalt = req.app.get('password_salt');
	var md5password = crypto.createHash('md5').update(password).digest('hex');
	var hashedPassword = crypto.createHash('sha256').update(passwordSalt[0]+md5password+passwordSalt[1]).digest('hex');

	async.series([
		function(callback) {
			//try and get user profile from DB
			Models.User(email, function(err, result) {
				if (err && err.code == cb.errors.keyNotFound) {
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
		}
	], function(err) {
		if (err)
			return next(err);

		if (hashedPassword != userProfile.password) {
			res.status(401).json({status: 401, message: 'wrong password'}).end();

			return;
		}

		delete userProfile.password;

		var token = jwt.sign({email: email}, security.authSecret, { expiresInMinutes: 60 });
		res.json({status: 200, content: {user: userProfile, token: token }}).end();
		/*else {
			var props = {
				email: email,
				fid: '',
				name: req.body.name,
				gender: req.body.gender,
				friends: [],
				devices: [deviceId],
				password: hashedPassword
			};

			props.type = 'user';

			app.kafkaProducer.send([{
				topic: 'aggregation',
				messages: [JSON.stringify({
					op: 'add',
					object: props,
					applicationId: req._telepat.application_id,
					isUser: true
				})],
				attributes: 0
			}], function(err) {
				if (err) console.log(err);
			});

			var token = jwt.sign({email: email}, security.authSecret, { expiresInMinutes: 60 });
			res.json({status: 200, content: {token: token }}).end();
		}*/
	});
});

/**
 * @api {post} /user/logout Logout
 * @apiDescription Logs out the user removing the device from his array of devices.
 * @apiName UserLogout
 * @apiGroup User
 * @apiVersion 0.1.2
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": "Logged out of device"
 * 	}
 *
 * @apiError NotAuthenticated  Only authenticated users may access this endpoint.
 */
router.post('/logout', function(req, res, next) {
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
 * @api {post} /user/refresh_token Refresh Token
 * @apiDescription Sends a new authentification token to the user. The old token must be provide (and it may or not
 * may not be aleady expired).
 * @apiName RefreshToken
 * @apiGroup User
 * @apiVersion 0.1.2
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
 * 		status: 401,
 * 		message: "Token not present or authorization header is invalid"
 * 	}
 */
router.post('/refresh_token', function(req, res, next) {
	var oldToken = req.get('Authorization').split(' ')[1];
	if (oldToken) {
		var decoded = jwt.decode(oldToken);
		var newToken = jwt.sign(decoded, security.authSecret, {expiresInMinutes: 60});

		return res.status(200).json({status: 200, content: {token: newToken}}).end();
	} else {
		var error = new Error('Token not present or authorization header is invalid');
		error.status = 401;

		return next(error);
	}
});

/**
 * @api {post} /user/update Update
 * @apiDescription Updates the user information
 * @apiName UserUpdate
 * @apiGroup User
 * @apiVersion 0.1.2
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

	for(var p in patches) {
		patches[p].email = email;
		if (patches[p].path.split('/')[2] == 'password') {
			var passwordSalt = req.app.get('password_salt');
			var md5password = crypto.createHash('md5').update(patches[p].value).digest('hex');
			patches[p].value = crypto.createHash('sha256').update(passwordSalt[0]+md5password+passwordSalt[1]).digest('hex');
		}
	}

	app.kafkaProducer.send([{
		topic: 'aggregator',
		message: [JSON.stringify({
			op: 'edit',
			object: patches,
			id: id,
			applicationId: req._telepat.application_id,
			user: true
		})],
		attributes: 0
	}], function(err, result) {
		if (err) return next(err);

		res.status(202).json({status: 202, content: "User updated"}).end();
	});
});

router.post('/update_immediate', function(req, res, next) {
	var user = req.body;

	if (user.password) {
		var passwordSalt = req.app.get('password_salt');
		var md5password = crypto.createHash('md5').update(props.password).digest('hex');
		user.password = crypto.createHash('sha256').update(passwordSalt[0]+md5password+passwordSalt[1]).digest('hex');
	}

	Models.User.update(user.email, user, function(err, result) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: "User updated"}).end();
	});
});

/**
 * @api {post} /user/delete Delete
 * @apiDescription Deletes a user
 * @apiName UserDelete
 * @apiGroup User
 * @apiVersion 0.1.2
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
		message: [JSON.stringify({
			op: 'delete',
			object: {id: id, email: email},
			applicationId: req._telepat.application_id,
			user: true
		})],
		attributes: 0
	}], function(err) {
		if (err) return next(err);

		res.status(202).json({status: 202, content: "User deleted"}).end();
	});
});

module.exports = router;
