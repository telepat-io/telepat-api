var express = require('express');
var router = express.Router();
var FB = require('facebook-node');
var async = require('async');
var crypto = require('crypto');
var Models = require('octopus-models-api');
var security = require('./security');
var jwt = require('jsonwebtoken');

var options = {
	client_id:          '777341809047927',
	client_secret:      '336f01a4b50c7c6f459b60c93c50d7ce',
	redirect_uri:    'http://blg-node-front.cloudapp.net:3001/user/create'
};

FB.options(options);

router.all('/fb-login', function(req, res) {
	res.redirect(301, FB.getLoginUrl({scope: 'public_profile,user_about_me,user_friends', client_id: options.client_id, redirect_uri: options.redirect_uri})).end();
});

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
router.all('/create', function(req, res) {
	var code = req.query.code;

	var accessToken = {};
	var fbFriends = [];
	var userProfile = {};
	var insertedUser = {};

	if (!req.get('X-BLGREQ-SIGN')) {
		res.status(200).json({code: code}).end();
		return ;
	}

	async.waterfall([
		function(callback) {
			FB.napi('oauth/access_token', {code: code, client_id: options.client_id, client_secret: options.client_secret, redirect_uri: options.redirect_uri}, callback);
		},
		function(results, callback) {
			accessToken = results.access_token;
			FB.napi('/me', {access_token: accessToken}, function(err, result) {
				if (err) return callback(err);
				userProfile = result;
				callback();
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
			var props = {
				email: crypto.createHash('sha256').update(Math.random().toString()).digest('hex').slice(0,5)+'@gmail.com',
				fid: userProfile.id,
				name: userProfile.name,
				gender: userProfile.gender,
				friends: fbFriends
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
			var token = jwt.sign(insertedUser, security.authSecret, { expiresInMinutes: 60 });
			res.json({ token: token }).end();
		}
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
