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

/**
 * @api {post} /user/create Create
 * @apiDescription Creates a new user based on the access token from FB. This is accessed from a FB redirect.
 * @apiName UserCreate
 * @apiGroup User
 * @apiVersion 0.0.1
 *
 * @apiParam {String} code FB access token.
 *
 */
router.post('/login', function(req, res) {
	var accessToken = req.body.access_token;
	var fbFriends = [];
	var userProfile = {};
	var userExists = null;

	async.waterfall([
		function(callback) {
			FB.napi('/me', {access_token: accessToken}, function(err, result) {
				if (err) return callback(err);
				userProfile = result;
				callback();
			});
		},
		function(callback) {
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
			FB.napi('/me/friends', {access_token: accessToken}, function(err, result) {
				if (err) return callback(err);

				for(var f in result.data) {
					fbFriends.push(result.data[f].id);
				}
				callback();
			});
		},
		function(callback) {
			if (userExists) {
				var devices = userProfile.devices;
				if (devices) {
					var idx = devices.indexOf(req.get('X-BLGREQ-UDID'));
					if (idx === -1)
						devices.push(req.get('X-BLGREQ-UDID'));
				} else {
					devices = [req.get('X-BLGREQ-UDID')];
				}

				Models.User.update(userProfile.email, {devices: devices}, callback);
			} else
				callback(null, true);
		},
		function(result, callback) {
			if (userExists)
				return callback(null, true);

			var props = {
				email: userProfile.email,
				fid: userProfile.id,
				name: userProfile.name,
				gender: userProfile.gender,
				friends: fbFriends,
				device: req.get('X-BLGREQ-UDID'),
				authenticated: 1
			};

			props.type = 'user';

			app.kafkaProducer.send([{
				topic: 'aggregation',
				messages: [JSON.stringify({
					op: 'add',
					object: props,
					applicationId: req.get('X-BLGREQ-APPID')
				})],
				attributes: 0
			}], callback);
		},
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
	], function(err, results) {
		console.log(err, results);
		if (err)
			res.status(400).json(err).end();
		else {
			var token = jwt.sign(userProfile.email, security.authSecret, { expiresInMinutes: 60 });
			res.json({ token: token }).end();
		}
	});
});

router.post('/logout', function(req, res, next) {
	var deviceId = req.get('X-BLGREQ-UDID');
	var email = req.user.email;

	async.waterfall([
		function(callback) {
			Models.User(id, callback);
		},
		function(user, callback) {
			if (user.devices) {
				var idx = user.devices.indexOf(deviceId);
				if (idx >= 0)
					user.devices.splice(idx, 1);

				Models.User.Update(email, {authenticated: 0, devices: user.devices}, callback);
			} else {
				callback();
			}
		}
	], function(err, result) {

	});
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
			applicationId: req.get('X-BLGREQ-APPID'),
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
			applicationId: req.get('X-BLGREQ-APPID'),
			user: true
		})],
		attributes: 0
	}], function(err) {
		if (err) return next(err);

		res.status(200).json({status: 200, message: "User deleted."}).end();
	});
});

module.exports = router;
