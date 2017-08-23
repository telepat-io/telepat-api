var express = require('express');
var router = express.Router();
var FB = require('facebook-node');
var Twitter = require('twitter');
var async = require('async');
var security = require('./security');
var jwt = require('jsonwebtoken');
var microtime = require('microtime-nodejs');
var crypto = require('crypto');
var guid = require('uuid');
var mandrill = require('mandrill-api');
var tlib = require('telepat-models');
var sendgridHelper = require('sendgrid').mail;

var unless = function (paths, middleware) {
	return function (req, res, next) {
		var excluded = false;
		for (var i = 0; i < paths.length; i++) {
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

var isMobileBrowser = function (userAgent) {
	return userAgent.match(/(iPad|iPhone|iPod|Android|Windows Phone)/g) ? true : false;
};

router.use(unless(['/refresh_token', '/confirm', '/request_password_reset', '/metadata', '/update_metadata', '/reset_password_intermediate'], security.deviceIdValidation));
router.use(unless(['/refresh_token', '/confirm', '/metadata', '/update_metadata', '/reset_password_intermediate'], security.applicationIdValidation));
router.use(unless(['/refresh_token', '/confirm', '/metadata', '/update_metadata', '/reset_password_intermediate'], security.apiKeyValidation));

router.use(['/logout', '/me', '/update', '/update_immediate', '/delete', '/metadata', '/update_metadata'],
	security.tokenValidation);

/**
 * @api {post} /user/login-password Password login
 * @apiDescription Logs in the user with a password
 * @apiName UserLoginPassword
 * @apiGroup User
 * @apiVersion 0.4.0
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
router.post(['/login-password', '/login_password'], function (req, res, next) {
	if (!req.body.username)
		return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['username']));

	if (!req.body.password)
		return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['password']));

	var userProfile = null;
	var username = req.body.username;
	var password = req.body.password.toString();
	var deviceId = req._telepat.device_id;
	var appId = req._telepat.applicationId;
	var requiresConfirmation = tlib.apps[appId].email_confirmation;

	var hashedPassword = null;

	async.series([
		function (callback) {
			//try and get user profile from DB

			tlib.users.get({ username: username }, appId, function (err, result) {
				if (err && err.status == 404) {
					callback(new tlib.TelepatError(tlib.TelepatError.errors.UserNotFound));
				}
				else if (err)
					callback(err);
				else {
					if (!requiresConfirmation || result.confirmed) {
						userProfile = result;
						callback();
					} else {
						return callback(new tlib.TelepatError(tlib.TelepatError.errors.UnconfirmedAccount));
					}
				}
			});
		},
		function (callback) {
			var patches = [];
			patches.push(tlib.delta.formPatch(userProfile, 'append', { devices: deviceId }));

			if (userProfile.devices) {
				var idx = userProfile.devices.indexOf(deviceId);
				if (idx === -1) {
					tlib.users.update(patches, callback);
				} else
					callback();
			} else {
				tlib.users.update(patches, callback);
			}
		},
		function (callback) {
			security.encryptPassword(req.body.password, function (err, hash) {
				if (err)
					return callback(err);

				hashedPassword = hash;

				callback();
			});
		}
	], function (err) {
		if (err)
			return next(err);

		if (hashedPassword != userProfile.password) {
			return next(new tlib.TelepatError(tlib.TelepatError.errors.UserBadLogin));
		}

		delete userProfile.password;

		var token = security.createToken({ username: username, id: userProfile.id });
		res.status(200).json({ status: 200, content: { user: userProfile.properties, token: token } });
	});
});

/**
 * @api {post} /user/login-{s} Login
 * @apiDescription Log in the user through Facebook or Twitter.
 * @apiName UserLogin
 * @apiGroup User
 * @apiVersion 0.4.0
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
router.post('/login-:s', function (req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0)
		return next(new tlib.TelepatError(tlib.TelepatError.errors.RequestBodyEmpty));

	var loginProvider = req.params.s;

	if (loginProvider == 'facebook') {
		if (!req.body.access_token)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['access_token']));
		if (!tlib.config.login_providers || !tlib.config.login_providers.facebook)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.ServerNotConfigured,
				['facebook login provider']));
		else
			FB.options(tlib.config.login_providers.facebook);
	} else if (loginProvider == 'twitter') {
		if (!req.body.oauth_token)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['oauth_token']));
		if (!req.body.oauth_token_secret)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['oauth_token_secret']));
		if (!tlib.config.login_providers || !tlib.config.login_providers.twitter)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.ServerNotConfigured,
				['twitter login provider']));
	} else {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.InvalidLoginProvider, ['facebook, twitter']));
	}

	var accessToken = req.body.access_token;
	var username = null;
	var userProfile = null;
	var socialProfile = null;
	var deviceId = req._telepat.device_id;
	var appId = req._telepat.applicationId;

	async.series([
		//Retrieve facebook information
		function (callback) {
			if (loginProvider == 'facebook') {
				FB.napi('/me?fields=name,email,id,gender,picture', { access_token: accessToken }, function (err, result) {
					if (err) return callback(err);
					username = result.email || result.id;
					socialProfile = result;
					callback();
				});
			} else if (loginProvider == 'twitter') {
				var options = {
					access_token_key: req.body.oauth_token,
					access_token_secret: req.body.oauth_token_secret
				};

				options.consumer_key = tlib.config.login_providers.twitter.consumer_key;
				options.consumer_secret = tlib.config.login_providers.twitter.consumer_secret;

				var twitterClient = new Twitter(options);

				twitterClient.get('account/settings', {}, function (err, result) {
					if (err)
						return callback(err);

					twitterClient.get('users/show', { screen_name: result.screen_name }, function (err1, result1) {
						if (err1)
							return callback(err1);

						username = result.screen_name;
						socialProfile = result1;

						callback();
					});
				});
			}
		},
		function (callback) {
			//try and get user profile from DB
			if (req.body.username && loginProvider == 'facebook') {
				async.series([
					function (callback1) {
						tlib.users.get({ username: username }, appId, function (err, result) {
							if (err && err.status == 404) {
								callback1();
							}
							else if (err)
								callback1(err);
							else if (!result.fid) {
								callback1();
							} else {
								callback1(new tlib.TelepatError(tlib.TelepatError.errors.UserAlreadyExists));
							}
						});
					},
					function (callback1) {
						tlib.users.get({ username: req.body.username }, appId, function (err, result) {
							if (!err) {
								var patches = [];
								patches.push(tlib.delta.formPatch(result, 'replace', { username: username }));
								patches.push(tlib.delta.formPatch(result, 'replace', { picture: socialProfile.picture.data.url }));
								patches.push(tlib.delta.formPatch(result, 'replace', { fid: socialProfile.id }));
								patches.push(tlib.delta.formPatch(result, 'replace', { name: socialProfile.name }));

								tlib.users.update(patches, function (err, modifiedUser) {
									if (err) return callback1(err);
									userProfile = modifiedUser;
									callback1();
								});
							} else if (err && err.status != 404)
								callback1(err);
							else {
								callback1(new tlib.TelepatError(tlib.TelepatError.errors.UserNotFound));
							}
						});
					}
				], callback);
			} else {
				tlib.users.get({ username: username }, appId, function (err, result) {
					if (err && err.status == 404) {
						callback(new tlib.TelepatError(tlib.TelepatError.errors.UserNotFound));
					}
					else if (err)
						callback(err);
					else {
						userProfile = result;
						callback();
					}
				});

			}
		},
		//update user with deviceID if it already exists
		function (callback) {
			//if linking account with fb, user updating again is not necessary
			if (req.body.username && loginProvider == 'facebook')
				return callback();
			if (userProfile.devices) {
				var idx = userProfile.devices.indexOf(deviceId);
				if (idx === -1)
					userProfile.devices.push(deviceId);
			} else {
				userProfile.devices = [deviceId];
			}

			var patches = [];
			patches.push(tlib.delta.formPatch(userProfile, 'replace', { devices: userProfile.devices }));

			if (loginProvider == 'facebook') {
				if (userProfile.name != socialProfile.name)
					patches.push(tlib.delta.formPatch(userProfile, 'replace', { name: socialProfile.name }));
				if (userProfile.gender != socialProfile.gender)
					patches.push(tlib.delta.formPatch(userProfile, 'replace', { gender: socialProfile.gender }));
				if (userProfile.picture != socialProfile.picture.data.url)
					patches.push(tlib.delta.formPatch(userProfile, 'replace', { picture: socialProfile.picture.data.url }));
			} else if (loginProvider == 'twitter') {
				if (userProfile.name != socialProfile.name)
					patches.push(tlib.delta.formPatch(userProfile, 'replace', { name: socialProfile.name }));
				if (userProfile.picture != socialProfile.profile_image_url_https)
					patches.push(tlib.delta.formPatch(userProfile, 'replace', { picture: socialProfile.picture }));
			}

			tlib.users.update(patches, callback);
		}
		//final step: send authentification token
	], function (err) {
		if (err && err.code == '023') {
			return next(err);
		}

		if (loginProvider == 'facebook' && err && err.response && err.response.error.code == 190) {
			return next(new tlib.TelepatError(tlib.TelepatError.errors.InvalidAuthorization, ['Facebook access token has expired']));
		}
		if (err && err[0] && err[0].code == 89) {
			return next(new tlib.TelepatError(tlib.TelepatError.errors.InvalidAuthorization, ['Twitter access token has expired']));
		}
		if (err)
			return next(err);
		else {
			var token = security.createToken({ username: username, id: userProfile.id });
			delete userProfile.password;
			res.json({ status: 200, content: { token: token, user: userProfile } });
		}
	});
});

/**
 * @api {post} /user/register-{s} Register
 * @apiDescription Registers a new user using a Facebook token or directly with an email and password. User is not created
 * immediately.
 * @apiName UserRegister
 * @apiGroup User
 * @apiVersion 0.4.0
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
router.post('/register-:s', function (req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.RequestBodyEmpty));
	}

	var loginProvider = req.params.s;

	if (loginProvider == 'facebook') {
		if (!req.body.access_token)
			return next(tlib.error(tlib.TelepatError.errors.MissingRequiredField, ['access_token']));
		if (!tlib.config.login_providers || !tlib.config.login_providers.facebook)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.ServerNotConfigured,
				['facebook login handler']));
		else
			FB.options(tlib.config.login_providers.facebook);
	} else if (loginProvider == 'twitter') {
		if (!req.body.oauth_token)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['oauth_token']));
		if (!req.body.oauth_token_secret)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['oauth_token_secret']));
		if (!tlib.config.login_providers || !tlib.config.login_providers.twitter)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.ServerNotConfigured,
				['twitter login provider']));
	} else if (loginProvider == 'username') {
		if (!req.body.username)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['username']));
		if (!req.body.password)
			return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['password']));
	} else {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.InvalidLoginProvider, ['facebook, twitter, username']));
	}

	var userProfile = req.body;
	var accessToken = req.body.access_token;
	var fbFriends = [];
	var deviceId = req._telepat.device_id;
	var appId = req._telepat.applicationId;
	var requiresConfirmation = tlib.apps[appId].email_confirmation;
	if (loginProvider == 'username' && requiresConfirmation && !req.body.email) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['email']));
	}

	var timestamp = microtime.now();

	async.waterfall([
		function (callback) {
			if (loginProvider == 'facebook') {
				FB.napi('/me?fields=name,email,id,gender,picture', { access_token: accessToken }, function (err, result) {
					if (err) {
						return callback(err);
					}

					var picture = result.picture.data.url;
					delete result.picture;

					userProfile = result;
					userProfile.picture = picture;
					userProfile.username = result.email || result.id;

					callback();
				});
			} else if (loginProvider == 'twitter') {
				var options = {
					access_token_key: req.body.oauth_token,
					access_token_secret: req.body.oauth_token_secret
				};

				options.consumer_key = tlib.config.login_providers.twitter.consumer_key;
				options.consumer_secret = tlib.config.login_providers.twitter.consumer_secret;

				var twitterClient = new Twitter(options);

				twitterClient.get('account/settings', {}, function (err, result) {
					if (err)
						return callback(err);

					twitterClient.get('users/show', { screen_name: result.screen_name }, function (err1, result1) {
						if (err1)
							return callback(err1);

						userProfile = {};
						userProfile.name = result1.screen_name;
						userProfile.username = result.screen_name;
						userProfile.picture = result1.profile_image_url_https;

						callback();
					});
				});
			} else {
				callback();
			}
		},
		function (callback) {
			//get his/her friends
			if (loginProvider == 'facebook') {
				FB.napi('/me/friends', { access_token: accessToken }, function (err, result) {
					if (err) return callback(err);

					for (var f in result.data) {
						fbFriends.push(result.data[f].id);
					}
					callback();
				});
			} else
				callback();
		},
		function (callback) {
			if (!userProfile.username) {
				return callback(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField,
					['username']));
			}
			tlib.users.get({ username: userProfile.username }, appId, function (err, result) {
				if (!err) {
					callback(new tlib.TelepatError(tlib.TelepatError.errors.UserAlreadyExists));
				}
				else if (err && err.status != 404)
					callback(err);
				else {
					callback();
				}
			});
		},
		//send message to kafka if user doesn't exist in order to create it
		function (callback) {

			if (fbFriends.length)
				userProfile.friends = fbFriends;

			userProfile.type = 'user';
			userProfile.devices = [deviceId];

			if (userProfile.password)
				security.encryptPassword(userProfile.password, callback);
			else
				callback(null, false);

		}, function (hash, callback) {
			if (hash !== false)
				userProfile.password = hash;

			//request came from facebook
			if (accessToken) {
				userProfile.fid = userProfile.id;
				delete userProfile.id;
			}

			if (requiresConfirmation && loginProvider == 'username') {

				var mandrill = tlib.config.mandrill && tlib.config.mandrill.api_key;
				var sendgrid = tlib.config.sendgrid && tlib.config.sendgrid.api_key;

				if (!mandrill && !sendgrid) {
					tlib.services.logger.warning('Mandrill API key is missing, user email address will be ' +
						'automatically confirmed');
					userProfile.confirmed = true;
				} else if (!tlib.apps[appId].from_email) {
					tlib.services.logger.warning('"from_email" config missing, user email address will be ' +
						'automatically confirmed');
					userProfile.confirmed = true;
				} else {
					var messageContent = '';
					var emailProvider = tlib.config.mandrill ? 'mandrill' : 'sendgrid';
					var apiKey = {};
					apiKey[emailProvider] = tlib.config[emailProvider].api_key;

					userProfile.confirmed = false;
					userProfile.confirmationHash = crypto.createHash('md5').update(guid.v4()).digest('hex').toLowerCase();
					var url = 'http://' + req.headers.host + '/user/confirm?username=' +
						encodeURIComponent(userProfile.username) + '&hash=' + userProfile.confirmationHash + '&app_id=' + appId;

					if (req.body.callbackUrl)
						url += '&redirect_url=' + encodeURIComponent(req.body.callbackUrl);

					if (tlib.apps[appId].email_templates &&
						tlib.apps[appId].email_templates.confirm_account) {

						messageContent = tlib.apps[appId].email_templates.confirm_account.
							replace('{CONFIRM_LINK}', url);
					} else {
						messageContent = 'In order to be able to use and log in to the "' + tlib.apps[appId].name +
							'" app click this link: <a href="' + url + '">Confirm</a>';
					}

					if (tlib.apps[appId].email_templates &&
						tlib.apps[appId].email_templates.confirm_account) {

						messageContent = tlib.apps[appId].email_templates.confirm_account.
							replace(/\{CONFIRM_LINK}/g, url);
					} else {
						messageContent = 'In order to be able to use and log in to the "' + tlib.apps[appId].name +
							'" app click this link: <a href="' + url + '">Confirm</a>';
					}

					sendEmail(apiKey,
						{
							email: tlib.apps[appId].from_email,
							name: tlib.apps[appId].name
						},
						userProfile.email,
						'Account confirmation for "' + tlib.apps[appId].name + '"',
						messageContent
					);
				}
			}

			userProfile.application_id = req._telepat.applicationId;
			delete userProfile.access_token;
			delete userProfile.callbackUrl;

			tlib.services.messagingClient.send([JSON.stringify({
				op: 'create',
				object: userProfile,
				application_id: req._telepat.applicationId,
				timestamp: timestamp
			})], 'aggregation', callback);

		}
	], function (err) {

		if (err && err.message == 'Invalid OAuth access token.' && loginProvider == 'facebook') {
			return next(new tlib.TelepatError(tlib.TelepatError.errors.ServerConfigurationFailure, 'Facebook invalid OAuth access token'));
		}
		if (err) return next(err);

		res.status(202).json({ status: 202, content: 'User created' });
	});
});

/**
 * @api {get} /user/confirm ConfirmEmailAddress
 * @apiDescription Confirms the email address for the user
 * @apiName ConfirmEmailAddress
 * @apiGroup User
 * @apiVersion 0.4.3
 *
 * @apiHeader {String} Content-type application/json
 *
 * @apiParam {String} username The username
 * @apiParam {String} hash The confirmation hash
 * @apiParam {String} app_id The application ID
 * @apiParam {String} callbackUrl The app deeplink url to redirect the user to
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
router.get('/confirm', function (req, res, next) {;
	var username = req.body.username;
	var hash = req.body.hash;
	var appId = req.body.app_id;
	var user = null;
	var redirectUrl = req.body.redirect_url;

	async.series([
		function (callback) {
			tlib.users.get({ username: username }, appId, function (err, result) {
				if (err) return callback(err);

				user = result;
				callback();
			});
		},
		function (callback) {

			if (hash != user.confirmationHash) {
				return callback(new tlib.TelepatError(tlib.TelepatError.errors.ClientBadRequest, ['invalid hash']));
			}

			var patches = [];
			patches.push(tlib.delta.formPatch(user, 'replace', { confirmed: true }));

			tlib.users.update(patches, callback);
		}
	], function (err) {
		if (err)
			return next(err);

		if (redirectUrl && tlib.config.redirect_url) {
			res.redirect(tlib.config.redirect_url + '?url=' + encodeURIComponent(redirectUrl));
			res.end();
		} else if (tlib.apps[appId].email_templates &&
			tlib.apps[appId].email_templates.after_confirm) {
			res.status(200);
			res.set('Content-Type', 'text/html');
			res.send(tlib.apps[appId].email_templates.after_confirm);
		} else {
			res.status(200).json({ status: 200, content: 'Account confirmed' });
		}
	});
});

/**
 * @api {get} /user/me Me
 * @apiDescription Info about logged user
 * @apiName UserMe
 * @apiGroup User
 * @apiVersion 0.4.0
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
router.get('/me', function (req, res, next) {
	tlib.users.get({ id: req.user.id }, req._telepat.applicationId, function (err, result) {
		if (err && err.status == 404) {
			return next(new tlib.TelepatError(tlib.TelepatError.errors.UserNotFound));
		}
		else if (err)
			next(err);
		else
			delete result.password;
		res.status(200).json({ status: 200, content: result });
	});
});

/**
 * @api {get} /user/get getUser
 * @apiDescription Info about an user, based on their ID
 * @apiName UserGet
 * @apiGroup User
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint.
 * Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from device/register)
 *
 * @apiParam {String} user_id The ID of the desired user
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
router.get('/get', function (req, res, next) {
	tlib.users.get({ id: req.body.user_id }, req._telepat.applicationId, function (err, result) {
		if (err && err.status == 404) {
			return next(new tlib.TelepatError(tlib.TelepatError.errors.UserNotFound));
		}
		else if (err)
			next(err);
		else
			delete result.password;
		res.status(200).json({ status: 200, content: result });
	});
});

/**
 * @api {get} /user/logout Logout
 * @apiDescription Logs out the user removing the device from his array of devices.
 * @apiName UserLogout
 * @apiGroup User
 * @apiVersion 0.4.0
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
router.get('/logout', function (req, res, next) {
	var deviceId = req._telepat.device_id;
	var appID = req._telepat.applicationId;

	async.waterfall([
		function (callback) {
			tlib.users.get({ id: req.user.id }, appID, callback);
		},
		function (user, callback) {
			if (user.devices) {
				var idx = user.devices.indexOf(deviceId);
				if (idx >= 0)
					user.devices.splice(idx, 1);

				tlib.users.update([
					{
						"op": "replace",
						"path": "user/" + req.user.id + "/devices",
						"value": user.devices
					}
				], callback);
			} else {
				callback();
			}
		}
	], function (err) {
		if (err) return next(err);

		res.status(200).json({ status: 200, content: "Logged out of device" });
	});
});


/**
 * @api {get} /user/refresh_token Refresh Token
 * @apiDescription Sends a new authentication token to the user. The old token must be provide (and it may or not
 * may not be already expired).
 * @apiName RefreshToken
 * @apiGroup User
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint.
 * Should have the format: <i>Bearer $TOKEN</i>
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
router.get('/refresh_token', function (req, res, next) {
	if (!req.get('Authorization')) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.AuthorizationMissing));
	}

	var authHeader = req.get('Authorization').split(' ');
	if (authHeader[0] == 'Bearer' && authHeader[1]) {
		try {
			var decoded = jwt.decode(authHeader[1]);
		} catch (e) {
			return next(new tlib.TelepatError(tlib.TelepatError.errors.ClientBadRequest, [e.message]));
		}

		if (!decoded) {
			return next(new tlib.TelepatError(tlib.TelepatError.errors.MalformedAuthorizationToken));
		}

		var newToken = security.createToken(decoded);

		return res.status(200).json({ status: 200, content: { token: newToken } });
	} else {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.InvalidAuthorization, ['header invalid']));
	}
});

/**
 * @api {post} /user/update Update
 * @apiDescription Updates the user information. This operation is not immediate.
 * @apiName UserUpdate
 * @apiGroup User
 * @apiVersion 0.4.0
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
router.post('/update', function (req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.RequestBodyEmpty));
	} else if (!Array.isArray(req.body.patches)) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.InvalidFieldValue,
			['"patches" is not an array']));
	} else if (req.body.patches.length == 0) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.InvalidFieldValue,
			['"patches" array is empty']));
	}

	var patches = req.body.patches;
	var id = req.user.id;
	var username = req.user.username;
	var modifiedMicrotime = microtime.now();

	var i = 0;
	async.eachSeries(patches, function (p, c) {
		patches[i].username = username;

		if (patches[i].path.split('/')[2] == 'password') {

			security.encryptPassword(patches[i].value, function (err, hash) {
				patches[i].value = hash;
				i++;
				c();
			});
		} else {
			i++;
			c();
		}
	}, function () {
		async.eachSeries(patches, function (patch, c) {
			var patchUserId = patch.path.split('/')[1];

			if (patchUserId != id) {
				return c(new tlib.TelepatError(tlib.TelepatError.errors.InvalidPatch,
					['Invalid ID in one of the patches']));
			}
			c();
		}, function (err) {
			if (err) return next(err);

			tlib.services.messagingClient.send([JSON.stringify({
				op: 'update',
				patches: patches,
				application_id: req._telepat.applicationId,
				timestamp: modifiedMicrotime
			})], 'aggregation', function (err) {
				if (err)
					return next(err);

				res.status(202).json({ status: 202, content: "User updated" });
			});


		});
	});

});

/**
 * @api {delete} /user/delete Delete
 * @apiDescription Deletes a user
 * @apiName UserDelete
 * @apiGroup User
 * @apiVersion 0.4.0
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
router.delete('/delete', function (req, res, next) {
	var timestamp = microtime.now();


	tlib.services.messagingClient.send([JSON.stringify({
		op: 'delete',
		object: { id: req.user.id, model: 'user', application_id:req._telepat.applicationId },
		application_id: req._telepat.applicationId,
		timestamp: timestamp
	})], 'aggregation', function (err) {
		if (err) return next(err);

		res.status(202).json({ status: 202, content: "User deleted" });
	});


});


/**
 * @api {delete} /user/request_password_reset Request Password Reset
 * @apiDescription Requests a password reset for the user, an email is sent to its email address
 * @apiName UserRequestPasswordReset
 * @apiGroup User
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 *
 * @apiParam {string} link An application deep link to redirect the user when clicking the link in the email sent
 * @apiParam {string} username The username which password we want to reset
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"link": "app://callback-url",
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
router.post('/request_password_reset', function (req, res, next) {
	var link = req.body.callbackUrl; // either 'browser' or 'app'
	var appId = req._telepat.applicationId;
	var username = req.body.username;
	var token = crypto.createHash('md5').update(guid.v4()).digest('hex').toLowerCase();
	var user = null;

	var mandrill = tlib.config.mandrill && tlib.config.mandrill.api_key;
	var sendgrid = tlib.config.sendgrid && tlib.config.sendgrid.api_key;

	if (!mandrill && !sendgrid) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.ServerNotConfigured, ['mandrill/sendgrid API keys missing']));
	}

	async.series([
		function (callback) {
			tlib.users.get({ username: username }, appId, function (err, result) {
				if (err) return callback(err);

				if (!result.email)
					return callback(new tlib.TelepatError(tlib.TelepatError.errors.ClientBadRequest,
						['user has no email address']));

				user = result;
				callback();
			});
		},
		function (callback) {
			var messageContent = '';
			var emailProvider = tlib.config.mandrill ? 'mandrill' : 'sendgrid';
			var apiKey = {};
			apiKey[emailProvider] = tlib.config[emailProvider].api_key;

			link += '?token=' + token + '&user_id=' + user.id;

			var redirectUrl = 'http://' + req.headers.host + '/user/reset_password_intermediate?url=' + encodeURIComponent(link) +
				'&app_id=' + appId;

			if (tlib.apps[appId].email_templates &&
				tlib.apps[appId].email_templates.reset_password) {
				messageContent = tlib.apps[appId].email_templates.reset_password.
					replace(/\{CONFIRM_LINK}/g, redirectUrl);
			} else {
				messageContent = 'Password reset request from the "' + tlib.apps[appId].name +
					'" app. Click this URL to reset password: <a href="' + redirectUrl + '">Reset</a>';
			}
			sendEmail(apiKey,
				{
					email: tlib.apps[appId].from_email,
					name: tlib.apps[appId].name
				},
				user.email,
				'Reset account password for "' + username + '"',
				messageContent
			);

			var patches = [];
			patches.push(tlib.delta.formPatch(user, 'replace', { password_reset_token: token }));

			tlib.users.update(patches, callback);
		}
	], function (err) {
		if (err)
			return next(err);
		res.status(200).json({ status: 200, content: "Password reset email sent" });
	});
});

router.get('/reset_password_intermediate', function (req, res, next) {
	var appId = req.query.app_id;

	if (!tlib.apps[appId])
		return next(new tlib.TelepatError(tlib.TelepatError.errors.ApplicationNotFound, [appId]));

	if (!isMobileBrowser(req.get('User-Agent'))) {
		if (tlib.apps[appId].email_templates &&
			tlib.apps[appId].email_templates.weblink) {

			res.status(200);
			res.type('html');
			res.send(tlib.apps[appId].email_templates.weblink);
			res.end();
		}
	} else {
		res.redirect(decodeURIComponent(req.query.url));
	}
});

/**
 * @api {delete} /user/password_reset Password Reset
 * @apiDescription Resets the password of the user based on a token
 * @apiName UserPasswordReset
 * @apiGroup User
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 *
 * @apiParam {String} token The token received from the query params in the app deeplink callback url
 * @apiParam {String} user_id The user_id received from the query params in the app deeplink callback url
 * @apiParam {String} password The new password
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
router.post('/password_reset', function (req, res, next) {
	var token = req.body.token;
	var userId = req.body.user_id;
	var newPassword = req.body.password;
	var appId = req._telepat.applicationId;
	var user = null;

	async.series([
		function (callback) {
			tlib.users.get({ id: userId }, appId, function (err, result) {
				if (err) return callback(err);
				if (result.password_reset_token == null ||
					result.password_reset_token == undefined ||
					result.password_reset_token != token) {
					return callback(new tlib.TelepatError(tlib.TelepatError.errors.ClientBadRequest,
						['invalid token']));
				}

				user = result;
				callback();
			})
		},
		function (callback) {
			security.encryptPassword(newPassword, function (err, hashedPassword) {
				if (err) return callback(err);

				var patches = [];
				
				patches.push(tlib.delta.formPatch(user, 'replace', { password: hashedPassword }));
				patches.push(tlib.delta.formPatch(user, 'replace', { password_reset_token: null }));
				tlib.users.update(patches, callback);
			});
		}
	], function (err) {
		if (err)
			return next(err);

		res.status(200).json({ status: 200, content: newPassword });
	})
});

/**
 * @api {get} /user/metadata Get Metadata
 * @apiDescription Gets user metadata (private info)
 * @apiName UserGetMetadata
 * @apiGroup User
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 *			"id": "9fa7751a-d733-404a-a269-c8b64817dfd5",
 *   		"user_id": "15f76424-d4bd-48d4-b812-c4ebc09782f1",
 *   		"points": 100,
 *		}
 * 	}
 *
 */
router.get('/metadata', function (req, res, next) {
	var userId = req.user.id;
	tlib.users.getMetadata(userId, function (err, result) {
		if (err) return next(err);
		res.status(200).json({ status: 200, content: result });
	});
});

/**
 * @api {post} /user/update_metadata Update Metadata
 * @apiDescription Updates user metadata
 * @apiName UserUpdateMetadata
 * @apiGroup User
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 *
 * @apiParam {Object[]} patches Array of patches that describe the modifications
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"patches": [
 * 			{
 * 				"op": "replace",
 * 				"path": "user_metadata/metadata_id/field_name",
 * 				"value": "new value
 * 			}
 * 		]
 * 	}
 *
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": "Metadata updated successfully"
 * 	}
 *
 * 	@apiError [042]400 InvalidPatch Invalid patch supplied
 *
 */
router.post('/update_metadata', function (req, res, next) {
	var userId = req.user.id;
	var patches = req.body.patches;

	if (!Array.isArray(patches) || patches.length == 0) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField,
			['patches must be a non-empty array']));
	}
	tlib.users.updateMetadata(userId, patches, function (err) {
		if (err) return next(err);

		res.status(200).json({ status: 200, content: "Metadata updated successfully" });
	});
});

function sendEmail(provider, from, to, subject, content) {
	var emailService = Object.keys(provider)[0];
	var apiKey = provider[emailService];

	if (emailService == 'mandrill') {
		var mandrillClient = new mandrill.Mandrill(apiKey);

		var message = {
			html: content,
			subject: subject,
			from_email: from.email,
			from_name: from.name,
			to: [
				{
					email: to,
					type: 'to'
				}
			]
		};
		
		mandrillClient.messages.send({ message: message, async: "async" }, function () { }, function (err) {
			tlib.services.logger.warning('Unable to send Mandrill mail: ' + err.name + ' - '
				+ err.message);
		});
	} else if (emailService == 'sendgrid') {
		var from_email = new sendgridHelper.Email(from.email, from.name);
		var to_email = new sendgridHelper.Email(to);
		var mail = new sendgridHelper.Mail(from_email, subject, to_email, new sendgridHelper.Content('text/html', content));

		var sg = require('sendgrid')(apiKey);
		var req = sg.emptyRequest({
			method: 'POST',
			path: '/v3/mail/send',
			body: mail.toJSON()
		});

		sg.API(req, function (err, response) {
			if (err) {
				tlib.services.logger.warning('Unable to send Sendgrid amail: ' + err.name + ' - '
					+ err.message);
			}
			else if (response.statusCode >= 400) {
				var error = JSON.parse(response.body);
				
				tlib.services.logger.warning('Unable to send Sendgrid amail: ' + error.errors[0].message);
			}
		});
	}
}

module.exports = router;
