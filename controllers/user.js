var express = require('express');
var router = express.Router();
var FB = require('facebook-node');
var Twitter = require('twitter');
var async = require('async');
var Models = require('telepat-models');
var security = require('./security');
var jwt = require('jsonwebtoken');
var microtime = require('microtime-nodejs');
var crypto = require('crypto');
var guid = require('uuid');
var mandrill = require('mandrill-api');

var unless = function(paths, middleware) {
	return function(req, res, next) {
		var excluded = false;
		for (var i=0; i<paths.length; i++) {
			if (paths[i] === req.path) {
				excluded = true;
			}
		}
		if (excluded) {
			return next();
		} else {
			return middleware(req, res, next);
		}
	};
};

router.use(unless(['/confirm', '/request_password_reset'], security.deviceIdValidation));
router.use(unless(['/confirm'], security.applicationIdValidation));
router.use(unless(['/confirm'], security.apiKeyValidation));

router.use(['/logout', '/me', '/update', '/update_immediate', '/delete'], security.tokenValidation);

/**
 * @api {post} /user/login-{s} Login
 * @apiDescription Log in the user through Facebook or Twitter.
 * @apiName UserLogin
 * @apiGroup User
 * @apiVersion 0.2.8
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from device/register)
 *
 * @apiParam {String} s GET param for the login provider
 * @apiParam {String} access_token Facebook access token.
 *
 * @apiExample {json} Facebook login
 * 	{
 * 		"access_token": "fb access token"
 * 	}
 *
 * 	@apiExample {json} Twitter login
 * 	{
 * 		"oauth_token": "oauth token",
 * 		"oauth_token_secret": "oauth token secret"
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			"token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhYmlAYXBwc2NlbmQuY29tIiwiaXNBZG1pbiI6dHJ1ZSwi
 * 			aWF0IjoxNDMyOTA2ODQwLCJleHAiOjE0MzI5MTA0NDB9.knhPevsK4cWewnx0LpSLrMg3Tk_OpchKu6it7FK9C2Q"
 * 			"user": {
 * 				"id": 31,
 *				"type": "user",
 * 				"username": "abcd@appscend.com",
 * 				"devices": [
 *					"466fa519-acb4-424b-8736-fc6f35d6b6cc"
 *				],
 *				"password": "acb8a9cbb479b6079f59eabbb50780087859aba2e8c0c397097007444bba07c0"
 *			}
 * 		}
 * 	}
 *
 * 	@apiError 400 [028]InsufficientFacebookPermissions User email is not publicly available
 * 	(insufficient Facebook permissions)
 * 	@apiError 404 [023]UserNotFound User not found
 *
 */
router.post('/login-:s', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0)
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));

	var loginProvider = req.params.s;

	if (loginProvider == 'facebook') {
		if (!req.body.access_token)
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['access_token']));
		if (!app.telepatConfig.login_providers || !app.telepatConfig.login_providers.facebook)
			return next(new Models.TelepatError(Models.TelepatError.errors.ServerNotConfigured,
				['facebook login provider']));
		else
			FB.options(app.telepatConfig.login_providers.facebook);
	} else if (loginProvider == 'twitter') {
		if (!req.body.oauth_token)
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['oauth_token']));
		if (!req.body.oauth_token_secret)
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['oauth_token_secret']));
		if (!app.telepatConfig.login_providers || !app.telepatConfig.login_providers.twitter)
			return next(new Models.TelepatError(Models.TelepatError.errors.ServerNotConfigured,
				['twitter login provider']));
	} else {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidLoginProvider, ['facebook, twitter']));
	}

	var accessToken = req.body.access_token;
	var username = null;
	var userProfile = null;
	var socialProfile = null;
	var deviceId = req._telepat.device_id;
	var appId = req._telepat.applicationId;

	async.waterfall([
		//Retrieve facebook information
		function(callback) {
			if (loginProvider == 'facebook') {
				FB.napi('/me?fields=name,email,id,gender', {access_token: accessToken}, function(err, result) {
					if (err) return callback(err);

					if (!result.email) {
						callback(new Models.TelepatError(Models.TelepatError.errors.InsufficientFacebookPermissions,
							'email address is missing'));
					}

					username = result.email;
					socialProfile = result;

					callback();
				});
			} else if (loginProvider == 'twitter') {
				var options = {
					access_token_key: req.body.oauth_token,
					access_token_secret: req.body.oauth_token_secret
				};

				options.consumer_key = app.telepatConfig.login_providers.twitter.consumer_key;
				options.consumer_secret = app.telepatConfig.login_providers.twitter.consumer_secret;

				var twitterClient = new Twitter(options);

				twitterClient.get('account/settings', {}, function(err, result) {
					if (err)
						return callback(err);

					username = result.screen_name;
					socialProfile = {screen_name: result.screen_name};

					callback();
				});
			}
		},
		function(callback) {
			//try and get user profile from DB
			Models.User({username: username}, appId, function(err, result) {
				if (err && err.status == 404) {
					callback(new Models.TelepatError(Models.TelepatError.errors.UserNotFound));
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
			patches.push(Models.Delta.formPatch(userProfile, 'replace', {devices: userProfile.devices}));

			if (loginProvider == 'facebook') {
				if (userProfile.name != socialProfile.name)
					patches.push(Models.Delta.formPatch(userProfile, 'replace', {name: socialProfile.name}));
				if (userProfile.gender != socialProfile.gender)
					patches.push(Models.Delta.formPatch(userProfile, 'replace', {gender: socialProfile.gender}));
			}

			Models.User.update(username, appId, patches, callback);

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
			var token = jwt.sign({username: username, id: userProfile.id}, security.authSecret,
				{ expiresInMinutes: 60 });
			delete userProfile.password;
			res.json({status: 200, content: {token: token, user: userProfile}});
		}
	});
});

/**
 * @api {post} /user/register-{s} Register
 * @apiDescription Registers a new user using a Facebook token or directly with an email and password. User is not created
 * immediately.
 * @apiName UserRegister
 * @apiGroup User
 * @apiVersion 0.2.8
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from device/register)
 *
 * @apiParam {String} s GET param for the login provider (can be "username" for registering without a 3rd party)
 * @apiParam {String} access_token Facebook access token.
 *
 * @apiExample {json} Username
 *
 * {
 * 		"username": "example@appscend.com",
 * 		"password": "secure_password1337",
 * 		"name": "John Smith"
 * }
 *
 * @apiExample {json} Facebook Request
 * 	{
 * 		"access_token": "fb access token"
 * 	}
 *
 * @apiExample {json} Twitter request
 * 	{
 * 		"oauth_token": "oauth token",
 * 		"oauth_token_secret": "oauth token secret"
 * 	}
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 202,
 * 		"content": "User created"
 * 	}
 *
 * 	@apiError 400 [028]InsufficientFacebookPermissions User email is not publicly available
 * 	(insufficient facebook permissions)
 * 	@apiError 409 [029]UserAlreadyExists User with that email address already exists
 *
 */
router.post('/register-:s', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));
	}

	var loginProvider = req.params.s;

	if (loginProvider == 'facebook') {
		if (!req.body.access_token)
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['access_token']));
		if (!app.telepatConfig.login_providers || !app.telepatConfig.login_providers.facebook)
			return next(new Models.TelepatError(Models.TelepatError.errors.ServerNotConfigured,
				['facebook login handler']));
		else
			FB.options(app.telepatConfig.login_providers.facebook);
	} else if (loginProvider == 'twitter') {
		if (!req.body.oauth_token)
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['oauth_token']));
		if (!req.body.oauth_token_secret)
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['oauth_token_secret']));
		if (!app.telepatConfig.login_providers || !app.telepatConfig.login_providers.twitter)
			return next(new Models.TelepatError(Models.TelepatError.errors.ServerNotConfigured,
				['twitter login provider']));
	} else if (loginProvider == 'username') {
		if (!req.body.username)
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['username']));
		if (!req.body.password)
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['password']));
	} else {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidLoginProvider, ['facebook, twitter, username']));
	}

	var userProfile = req.body;
	var accessToken = req.body.access_token;
	var fbFriends = [];
	var deviceId = req._telepat.device_id;
	var appId = req._telepat.applicationId;
	var requiresConfirmation = Models.Application.loadedAppModels[appId].email_confirmation;

	if (loginProvider == 'username' && requiresConfirmation && !req.body.email) {
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['email']));
	}

	async.waterfall([
		function(callback) {
			if (loginProvider == 'facebook') {
				FB.napi('/me?fields=name,email,id,gender', {access_token: accessToken}, function(err, result) {
					if (err) return callback(err);

					if (!result.email) {
						callback(new Models.TelepatError(Models.TelepatError.errors.InsufficientFacebookPermissions,
							['email address is missing']));
					}

					userProfile = result;
					userProfile.username = result.email;

					callback();
				});
			} else if (loginProvider == 'twitter') {
				var options = {
					access_token_key: req.body.oauth_token,
					access_token_secret: req.body.oauth_token_secret
				};

				options.consumer_key = app.telepatConfig.login_providers.twitter.consumer_key;
				options.consumer_secret = app.telepatConfig.login_providers.twitter.consumer_secret;

				var twitterClient = new Twitter(options);

				twitterClient.get('account/settings', {}, function(err, result) {

					userProfile = {};
					userProfile.username = result.screen_name;

					callback();
				});
			} else {
				callback();
			}
		},
		function(callback) {
			//get his/her friends
			if (loginProvider == 'facebook') {
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
			if (!userProfile.username) {
				return callback(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField,
					['username']));
			}

			Models.User({username: userProfile.username}, appId, function(err, result) {
				if (!err) {
					callback(new Models.TelepatError(Models.TelepatError.errors.UserAlreadyExists));
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

			if (fbFriends.length)
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

			//request came from facebook
			if (accessToken) {
				userProfile.fid = userProfile.id;
				delete userProfile.id;
			}

			if (requiresConfirmation &&
				loginProvider == 'username' &&
				Models.Application.loadedAppModels[appId].from_email) {

				if (!app.telepatConfig.mandrill || !app.telepatConfig.mandrill.api_key) {
					Models.Application.logger.warning('Mandrill API key is missing, user email address will be ' +
						'automatically confirmed');
					userProfile.confirmed = true;
				} else {
					var mandrillClient = new mandrill.Mandrill(app.telepatConfig.mandrill.api_key);

					userProfile.confirmed = false;
					userProfile.confirmationHash = crypto.createHash('md5').update(guid.v4()).digest('hex').toLowerCase();
					var url = 'http://'+req.headers.host + '/user/confirm?username='+
						encodeURIComponent(userProfile.username)+'&hash='+userProfile.confirmationHash+'&app_id='+appId;
					var message = {
						html: 'In order to be able to use and log in to the "'+Models.Application.loadedAppModels[appId].name+
						'" app click this link: <a href="'+url+'">Confirm</a>',
						subject: 'Account confirmation for "'+Models.Application.loadedAppModels[appId].name+'"',
						from_email: Models.Application.loadedAppModels[appId].from_email,
						from_name: Models.Application.loadedAppModels[appId].name,
						to: [
							{
								email: userProfile.email,
								type: 'to'
							}
						]
					};
					mandrillClient.messages.send({message: message, async: "async"}, function() {}, function(err) {
						Models.Application.logger.warning('Unable to send confirmation email: ' + err.name + ' - '
							+ err.message);
					});
				}
			}

			app.messagingClient.send([JSON.stringify({
				op: 'add',
				object: userProfile,
				applicationId: req._telepat.applicationId,
				isUser: true
			})], 'aggregation', callback);
		},
		//add this user to his/her friends array
		function(callback) {
			if (fbFriends.length) {
				app.messagingClient.send([JSON.stringify({fid: userProfile.id, friends: fbFriends})],
					'update_friends', callback);
			} else
				callback();
		}
	], function(err) {
		if (err) return next(err);

		res.status(202).json({status: 202, content: 'User created'});
	});
});

router.get('/confirm', function(req, res, next) {
	var username = req.query.username;
	var hash = req.query.hash;
	var appId = req.query.app_id;
	var user = null;

	async.series([
		function(callback) {
			Models.User({username: username}, appId, function(err, result) {
				if (err) return callback(err);

				user = result;
				callback();
			});
		},
		function(callback) {
			if (hash != user.confirmationHash) {
				return callback(new Models.TelepatError(Models.TelepatError.errors.ClientBadRequest, ['invalid hash']));
			}

			var patches = [];
			patches.push(Models.Delta.formPatch(user, 'replace', {confirmed: true}));

			Models.User.update(user.username, appId, patches, callback);
		}
	], function(err) {
		if (err)
			return next(err);

		res.status(200).json({status: 200, content: 'Account confirmed'});
	});
});

/**
 * @api {get} /user/me Me
 * @apiDescription Info about logged user
 * @apiName UserMe
 * @apiGroup User
 * @apiVersion 0.2.8
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint.
 * Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from device/register)
 *
 * @apiParam {String} password The password
 * @apiParam {String} email The email
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"content": {
 *			"id": 31,
 *			"type": "user",
 * 			"username": "abcd@appscend.com",
 * 			"devices": [
 *				"466fa519-acb4-424b-8736-fc6f35d6b6cc"
 *			]
 * 		}
 * 	}
 *
 */
router.get('/me', function(req, res, next) {
	Models.User({id: req.user.id}, req._telepat.applicationId, function(err, result) {
		if (err && err.status == 404) {
			return next(new Models.TelepatError(Models.TelepatError.errors.UserNotFound));
		}
		else if (err)
			next(err);
		else
			delete result.password;
			res.status(200).json({status: 200, content: result});
	});
});

/**
 * @api {post} /user/login_password Password login
 * @apiDescription Logs in the user with a password
 * @apiName UserLoginPassword
 * @apiGroup User
 * @apiVersion 0.2.8
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from device/register)
 *
 * @apiParam {String} password The password
 * @apiParam {String} username Username
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"username": "user@example.com",
 * 		"password": "magic-password1337"
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"content": {
 * 			"token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhYmlAYXBwc2NlbmQuY29tIiwiaXNBZG1pbiI6dHJ1ZSwi
 * 			aWF0IjoxNDMyOTA2ODQwLCJleHAiOjE0MzI5MTA0NDB9.knhPevsK4cWewnx0LpSLrMg3Tk_OpchKu6it7FK9C2Q"
 * 			"user": {
 * 				"id": 31,
 *				"type": "user",
 * 				"username": "abcd@appscend.com",
 * 				"devices": [
 *					"466fa519-acb4-424b-8736-fc6f35d6b6cc"
 *				],
 *				"password": "acb8a9cbb479b6079f59eabbb50780087859aba2e8c0c397097007444bba07c0"
 * 			}
 * 		}
 * 	}
 *
 * 	@apiError 401 [031]UserBadLogin User email and password did not match
 *
 */
router.post('/login_password', function(req, res, next) {
	if (!req.body.username)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['username']));

	if (!req.body.password)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['password']));

	var userProfile = null;
	var username = req.body.username;
	var password = req.body.password.toString();
	var deviceId = req._telepat.device_id;
	var appId = req._telepat.applicationId;
	var requiresConfirmation = Models.Application.loadedAppModels[appId].email_confirmation;

	var hashedPassword = null;

	async.series([
		function(callback) {
			//try and get user profile from DB
			Models.User({username: username}, appId, function(err, result) {
				if (err && err.status == 404) {
					callback(new Models.TelepatError(Models.TelepatError.errors.UserNotFound));
				}
				else if (err)
					callback(err);
				else {
					if (!requiresConfirmation || result.confirmed) {
						userProfile = result;
						callback();
					} else {
						return callback(new Models.TelepatError(Models.TelepatError.errors.UnconfirmedAccount));
					}
				}
			});
		},
		function(callback) {
			var patches = [];
			patches.push(Models.Delta.formPatch(userProfile, 'append', {devices: deviceId}));

			if (userProfile.devices) {
				var idx = userProfile.devices.indexOf(deviceId);
				if (idx === -1) {
					Models.User.update(userProfile.username, appId, patches, callback);
				} else
					callback();
			} else {
				Models.User.update(userProfile.username, appId, patches, callback);
			}
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
			return next(new Models.TelepatError(Models.TelepatError.errors.UserBadLogin));
		}

		delete userProfile.password;

		var token = jwt.sign({username: username, id: userProfile.id}, security.authSecret, { expiresInMinutes: 60 });
		res.status(200).json({status: 200, content: {user: userProfile, token: token }});
	});
});

/**
 * @api {get} /user/logout Logout
 * @apiDescription Logs out the user removing the device from his array of devices.
 * @apiName UserLogout
 * @apiGroup User
 * @apiVersion 0.2.8
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from device/register)
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": "Logged out of device"
 * 	}
 */
router.get('/logout', function(req, res, next) {
	var deviceId = req._telepat.device_id;
	var username = req.user.username;
	var appID = req._telepat.applicationId;

	async.waterfall([
		function(callback) {
			Models.User({id: req.user.id}, appID, callback);
		},
		function(user, callback) {
			if (user.devices) {
				var idx = user.devices.indexOf(deviceId);
				if (idx >= 0)
					user.devices.splice(idx, 1);

				Models.User.update(username, appID, [
		      {
		        "op": "replace",
		        "path": "user/"+username+"/devices",
		        "value": user.devices
		      }
		    ], callback);
			} else {
				callback();
			}
		}
	], function(err, result) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: "Logged out of device"});
	});
});


/**
 * @api {get} /user/refresh_token Refresh Token
 * @apiDescription Sends a new authentication token to the user. The old token must be provide (and it may or not
 * may not be already expired).
 * @apiName RefreshToken
 * @apiGroup User
 * @apiVersion 0.2.8
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint.
 * Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from device/register)
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhYmlAYXBwc2NlbmQuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaW
 * 			F0IjoxNDMyOTA2ODQwLCJleHAiOjE0MzI5MTA0NDB9.knhPevsK4cWewnx0LpSLrMg3Tk_OpchKu6it7FK9C2Q"
 * 		}
 * 	}
 *
 * @apiError 400 [013]AuthorizationMissing  If authorization header is missing
 * @apiError 400 [039]ClientBadRequest Error decoding auth token
 * @apiError 400 [040]MalformedAuthorizationToken Authorization token is malformed
 * @apiError 400 [014]InvalidAuthorization Authorization header is invalid
 */
router.get('/refresh_token', function(req, res, next) {
	if (!req.get('Authorization')) {
		return next(new Models.TelepatError(Models.TelepatError.errors.AuthorizationMissing));
	}

	var authHeader = req.get('Authorization').split(' ');
	if (authHeader[0] == 'Bearer' && authHeader[1]) {
		try {
			var decoded = jwt.decode(authHeader[1]);
		} catch (e) {
			return next(new Models.TelepatError(Models.TelepatError.errors.ClientBadRequest, [e.message]));
		}

		if (!decoded) {
			return next(new Models.TelepatError(Models.TelepatError.errors.MalformedAuthorizationToken));
		}

		var newToken = jwt.sign(decoded, security.authSecret, {expiresInMinutes: 60});

		return res.status(200).json({status: 200, content: {token: newToken}});
	} else {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidAuthorization, ['header invalid']));
	}
});

/**
 * @api {post} /user/update Update
 * @apiDescription Updates the user information. This operation is not immediate.
 * @apiName UserUpdate
 * @apiGroup User
 * @apiVersion 0.2.8
 *
 * @apiParam {Object[]} patches Array of patches that describe the modifications
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"patches": [
 * 			{
 * 				"op": "replace",
 * 				"path": "user/user_id/field_name",
 * 				"value": "new value
 * 			}
 * 		]
 * 	}
 *
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 202,
 * 		"content": "User updated"
 * 	}
 *
 * 	@apiError [042]400 InvalidPatch Invalid patch supplied
 *
 */
router.post('/update', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));
	} else if (!Array.isArray(req.body.patches)) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" is not an array']));
	} else if (req.body.patches.length == 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" array is empty']));
	}

	var patches = req.body.patches;
	var id = req.user.id;
	var username = req.user.username;
	var modifiedMicrotime = microtime.now();

	var i = 0;
	async.eachSeries(patches, function(p, c) {
		patches[i].username = username;

		if (patches[i].path.split('/')[2] == 'password') {

			security.encryptPassword(patches[i].value, function(err, hash) {
				patches[i].value = hash;
				i++;
				c();
			});
		} else {
			i++;
			c();
		}
	}, function() {
		async.eachSeries(patches, function(patch, c) {
			var patchUserId = patch.path.split('/')[1];

			if (patchUserId != id) {
				return c(new Models.TelepatError(Models.TelepatError.errors.InvalidPatch,
					['Invalid ID in one of the patches']));
			}

			app.messagingClient.send([JSON.stringify({
				op: 'update',
				object: patch,
				id: id,
				applicationId: req._telepat.applicationId,
				isUser: true,
				ts: modifiedMicrotime
			})], 'aggregation', c);
		}, function(err) {
			if (err) return next(err);

			res.status(202).json({status: 202, content: "User updated"});
		});
	});
});

router.post('/update_immediate', function(req, res, next) {
	var user = req.body;
	var appId = req._telepat.applicationId;

	req.user.type = 'user';

	async.waterfall([
		function(callback) {
			if (user.password)
				security.encryptPassword(user.password, callback);
			else
				callback(null, false);
		},
		function(hash, callback) {
			if (hash)
				user.password = hash;

			var patches = [];

			async.each(Object.keys(user), function(prop, c) {
				var property = {};
				property[prop] = user[prop];
				patches.push(Models.Delta.formPatch(req.user, 'replace', property));
				c();
			}, function() {
				Models.User.update(req.user.username, appId, patches, callback);
			});
		}
	], function(err) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: "User updated"});
	});
});

/**
 * @api {delete} /user/delete Delete
 * @apiDescription Deletes a user
 * @apiName UserDelete
 * @apiGroup User
 * @apiVersion 0.2.8
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 202,
 * 		"content": "User deleted"
 * 	}
 *
 */
router.delete('/delete', function(req, res, next) {
	var id = req.user.id;
	var username = req.user.username;

	app.messagingClient.send([JSON.stringify({
		op: 'delete',
		object: {path: 'user/'+id, username: username},
		applicationId: req._telepat.applicationId,
		isUser: true
	})], 'aggregation', function(err) {
		if (err) return next(err);

		res.status(202).json({status: 202, content: "User deleted"});
	});
});

/**
 * @api {delete} /user/request_password_reset Request Password Reset
 * @apiDescription Requests a password reset for the user, an email is sent to its email address
 * @apiName UserRequestPasswordReset
 * @apiGroup User
 * @apiVersion 0.2.8
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"type": "app",
 * 		"username": "email@example.com"
 * 	}
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": "Password reset email sent"
 * 	}
 *
 */
router.post('/request_password_reset', function(req, res, next) {
	var type = req.body.type; // either 'browser' or 'app'
	var appId = req._telepat.applicationId;
	var username = req.body.username;
	var link = null;
	var token = crypto.createHash('md5').update(guid.v4()).digest('hex').toLowerCase();
	var user = null;

	if (!app.telepatConfig.mandrill || !app.telepatConfig.mandrill.api_key) {
		return next(new Models.TelepatError(Models.TelepatError.errors.ServerNotConfigured, ['Mandrill API key']));
	}

	if (type == 'browser') {
		link = Models.Application.loadedAppModels[appId].password_reset.browser_link;
	} else if (type == 'app') {
		link = Models.Application.loadedAppModels[appId].password_reset.app_link;
	}
	else if (type == 'android') {
		link = Models.Application.loadedAppModels[appId].password_reset.android_app_link;
	} else {
		return next(new Models.TelepatError(Models.TelepatError.errors.ClientBadRequest, ['invalid type']));
	}

	async.series([
		function(callback) {
			Models.User({username: username}, appId, function(err, result) {
				if (err) return callback(err);

				if (!result.email)
					return callback(new Models.TelepatError(Models.TelepatError.errors.ClientBadRequest,
						['user has no email address']));

				user = result;
				callback();
			})
		},
		function(callback) {
			var mandrillClient = new mandrill.Mandrill(app.telepatConfig.mandrill.api_key);

			link += '?token='+token+'&user_id='+user.id;

			var redirectUrl = app.telepatConfig.redirect_url+'?url='+encodeURIComponent(link);

			var message = {
				html: 'Password reset request from the "'+Models.Application.loadedAppModels[appId].name+
				'" app. Click this URL to reset password: <a href="'+redirectUrl+'">Reset</a>',
				subject: 'Reset account password for "'+username+'"',
				from_email: Models.Application.loadedAppModels[appId].from_email,
				from_name: Models.Application.loadedAppModels[appId].name,
				to: [
					{
						email: user.email,
						type: 'to'
					}
				],
				track_clicks: false,
				track_opens: false
			};
			mandrillClient.messages.send({message: message, async: "async"}, function() {}, function(err) {
				Models.Application.logger.warning('Unable to send confirmation email: ' + err.name + ' - '
					+ err.message);
			});

			var patches = [];
			patches.push(Models.Delta.formPatch(user, 'replace', {password_reset_token: token}));

			Models.User.update(username, appId, patches, callback);
		}
	], function(err) {
		if (err)
			return next(err);
		res.status(200).json({status: 200, content: "Password reset email sent"});
	});
});

/**
 * @api {delete} /user/password_reset Password Reset
 * @apiDescription Resets the password of the user based on a token
 * @apiName UserPasswordReset
 * @apiGroup User
 * @apiVersion 0.2.8
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"token": "password_reset_token",
 * 		"user_id": "user_id",
 * 		"password": "new passowrd"
 * 	}
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": "new passowrd"
 * 	}
 *
 */
router.post('/password_reset', function(req, res, next) {
	var token = req.body.token;
	var userId = req.body.user_id;
	var newPassword = req.body.password;
	var appId = req._telepat.applicationId;
	var user = null;

	async.series([
		function(callback) {
			Models.User({id: userId}, appId, function(err, result) {
				if (err) return callback(err);

				if (result.password_reset_token == null ||
					result.password_reset_token == undefined ||
					result.password_reset_token != token) {
					return callback(new Models.TelepatError(Models.TelepatError.errors.ClientBadRequest,
						['invalid token']));
				}

				user = result;
				callback();
			})
		},
		function(callback) {
			security.encryptPassword(newPassword, function(err, hashedPassword) {
				if (err) return callback(err);

				var patches = [];
				patches.push(Models.Delta.formPatch(user, 'replace', {password: hashedPassword}));
				patches.push(Models.Delta.formPatch(user, 'replace', {password_reset_token: null}));

				Models.User.update(user.username, appId, patches, callback);
			});
		}
	], function(err) {
		if (err)
			return next(err);

		res.status(200).json({status: 200, content: newPassword});
	})
});

module.exports = router;
