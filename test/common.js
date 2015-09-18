var should = require('should');
var assert = require('assert');
var request = require('supertest');
var crypto = require('crypto-js');

var appKey = "3406870085495689e34d878f09faf52c";

exports.should = should;
exports.assert = assert;
exports.request = request;
exports.crypto = crypto;

exports.url = 'http://localhost:3000';
appID = '1';
exports.appKey = appKey;
exports.appIDsha256 = crypto.SHA256(appKey).toString(crypto.enc.Hex);
exports.DELAY = 300;