var express = require('express');
var router = express.Router();
var FB = require('facebook-node');
var async = require('async');
var Models = require('octopus-models-api');
var security = require('./security');
var jwt = require('jsonwebtoken');

var options = {
	client_id:          '1086083914753251',
	client_secret:      '40f626ca66e4472e0d11c22f048e9ea8'
};

FB.options(options);

router.use(security.keyValidation);
router.use('/logout', security.tokenValidation);

/**
 * @api {post} /user/login Login
 * @apiDescription Log in the user and create it if it doesn't exist in database.
 * @apiName UserLogin
 * @apiGroup User
 * @apiVersion 0.0.1
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
 * 		token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhYmlAYXBwc2NlbmQuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaWF0IjoxNDMyOTA2ODQwLCJleHAiOjE0MzI5MTA0NDB9.knhPevsK4cWewnx0LpSLrMg3Tk_OpchKu6it7FK9C2Q"
 * 	}
 *
 */
router.post('/login', function(req, res) {
	var accessToken = req.body.access_token;
	var fbFriends = [];
	var userProfile = {};
	var userExists = null;
	var deviceId = req._telepat.device_id;

	async.waterfall([
		//Retrieve facebook information
		function(callback) {
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
		},
		function(callback) {
			//try and get user profile from DB
			Models.User(userProfile.email, function(err, result) {
				if (err && err.code == cb.errors.keyNotFound) {
					userExists = false;
					callback();
				}
				else if (err)
					callback(err);
				else {
					userExists = true;
					userProfile = result;
					callback();
				}
			});
		},
		function(callback) {
			//get his/her friends
			FB.napi('/me/friends', {access_token: accessToken}, function(err, result) {
				if (err) return callback(err);

				for(var f in result.data) {
					fbFriends.push(result.data[f].id);
				}
				callback();
			});
		},
		//update user with deviceID if it already exists
		function(callback) {
			if (userExists) {
				var devices = userProfile.devices;
				if (devices) {
					var idx = devices.indexOf(deviceId);
					if (idx === -1)
						devices.push(deviceId);
				} else {
					devices = [deviceId];
				}

				Models.User.update(userProfile.email, {devices: devices}, callback);
			} else
				callback(null, true);
		},
		//send message to kafka if user doesn't exist in order to create it
		function(result, callback) {
			if (userExists)
				return callback(null, true);

			var props = {
				email: userProfile.email,
				fid: userProfile.id,
				name: userProfile.name,
				gender: userProfile.gender,
				friends: fbFriends,
				device: deviceId
			};

			props.type = 'user';

			app.kafkaProducer.send([{
				topic: 'aggregation',
				messages: [JSON.stringify({
					op: 'add',
					object: props,
					applicationId: req._telepat.application_id
				})],
				attributes: 0
			}], callback);
		},
		//add this user to his/her friends array
		function(result, callback) {
			if (userExists)
				return callback(null, true);

			if (fbFriends.length) {
				app.kafkaProducer.send([{
					topic: 'update_friends',
					messages: [JSON.stringify({fid: userProfile.id, friends: fbFriends})],
					attributes: 0
				}], callback);
			} else
				callback();
		}
		//final step: send authentification token
	], function(err, results) {
		if (err)
			res.status(400).json(err).end();
		else {
			var token = jwt.sign({email: userProfile.email}, security.authSecret, { expiresInMinutes: 60 });
			res.json({ token: token }).end();
		}
	});
});

/**
 * @api {post} /user/logout Logout
 * @apiDescription Logs out the user removing the device from his array of devices.
 * @apiName UserLogout
 * @apiGroup User
 * @apiVersion 0.0.1
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"message": "Logged out of device"
 * 	}
 *
 * @apiError NotAuthenticated  Only authenticated users may access this endpoint.
 */
router.post('/logout', function(req, res, next) {
	var deviceId = req._telepat.device_id;
	var email = req.user.email;
	console.log(req);

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

		res.status(200).json({status: 200, message: "Logged out of device"}).end();
	});
});


/**
 * @api {post} /user/refresh_token Refresh Token
 * @apiDescription Sends a new authentification token to the user. The old token must be provide (and it may or not
 * may not be aleady expired.
 * @apiName RefreshToken
 * @apiGroup User
 * @apiVersion 0.0.1
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhYmlAYXBwc2NlbmQuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaWF0IjoxNDMyOTA2ODQwLCJleHAiOjE0MzI5MTA0NDB9.knhPevsK4cWewnx0LpSLrMg3Tk_OpchKu6it7FK9C2Q"
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

		return res.status(200).json({token: newToken}).end();
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
 * @apiVersion 0.0.1
 *
 * @apiParam {Object[]} patches Array of patches that describe the modifications
 *
 */
router.post('/update', function(req, res, next) {
	var patches = req.body.patches;
	var id = req.user.id;
	var email = req.user.email;

	for(var p in patches) {
		patches[p].email = email;
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

		res.status(200).json({status: 200, message: "User updated."}).end();
	});
});


/**
 * @api {post} /user/delete Delete
 * @apiDescription Deletes a user
 * @apiName UserDelete
 * @apiGroup User
 * @apiVersion 0.0.1
 *
 * @apiParam {number} id ID of the user
 * @apiParam {string} email Email of the user
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

		res.status(200).json({status: 200, message: "User deleted."}).end();
	});
});

module.exports = router;
