var should = require('should');
var assert = require('assert');
var request = require('supertest');
var crypto = require('crypto-js');
var async = require('async');

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

function assertnLog(toAssert,err,res) {
	try{
		return toAssert.result.should.be.equal(toAssert.expected);
	}
	catch(assertError){
		if(res){
			console.log(res.body);
		}
		else{
			console.log(err);
		}
		throw (assertError);
	}
}
exports.assertnDebug = function assertnDebug(toAssert,err,res) {
	if (!Array.isArray(toAssert)) {
		var temp = toAssert;
		toAssert = [];
		toAssert[0] = temp;
	}

	for (var k in toAssert) {
		assertnLog(toAssert[k], err, res);
	}
}

exports.should = should;
exports.async = async;
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
