var express = require('express');
var router = express.Router();
var FB = require('facebook-node');
var async = require('async');
var crypto = require('crypto');
var Models = require('octopus-models-api');

var options = {
	client_id:          '777341809047927',
	client_secret:      '336f01a4b50c7c6f459b60c93c50d7ce',
	redirect_uri:    'http://blg-node-front.cloudapp.net:3001/user/create'
};

FB.options(options);

router.all('/fb-login', function(req, res) {
	res.redirect(301, FB.getLoginUrl({scope: 'public_profile,user_about_me,user_friends', client_id: options.client_id, redirect_uri: options.redirect_uri})).end();
});

router.all('/create', function(req, res) {
	var code = req.query.code;

	var accessToken = {};
	var fbFriends = [];
	var userProfile = {};

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

			//callback(null, results);
			Models.User.create(props, callback);
		},
		function(result, callback) {
			app.kafkaProducer.send([{
				topic: 'update_friends',
				messages: [JSON.stringify({fid: userProfile.id, friends: fbFriends})],
				attributes: 0
			}], callback);
		}
	], function(err, results) {
		console.log(err ,results);
		if (err)
			res.status(400).json(err).end();
		else
			res.status(200).json(results).end();
	});
});

module.exports = router;
