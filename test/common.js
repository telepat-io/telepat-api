var should = require('should');
var assert = require('assert');
var request = require('supertest');
var crypto = require('crypto-js');

var appKey = "3406870085495689e34d878f09faf52c";
var logLevel = process.env.TP_TST_LOG || 1;
exports.url = 'http://localhost:3000';
exports.appKey = appKey;
exports.appIDsha256 = crypto.SHA256(appKey).toString(crypto.enc.Hex);
exports.DELAY = 100;
exports.logLevel = logLevel;

function highjackEnd(request) {
	var end = request.end;
	request.end = function (callback) {
		end.call(this, function (err, res) {
			if (logLevel === 2 || (err && logLevel === 1)) {
				console.log(res.body);
			}
			callback(err, res);
		})
	}
	return request;
}

exports.should = should;
exports.assert = assert;
exports.crypto = crypto;

exports.request = function (url) {
	var rq = request(url);
	var get = rq.get;
	rq.get = function(path) {
		return highjackEnd(get.call(this, path))
	}
	var post = rq.post;
	rq.post = function(path) {
		return highjackEnd(post.call(this, path))
	}
	return rq;
}
