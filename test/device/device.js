var common = require('../common');
var request = common.request;
var should = common.should;
var url = common.url;
var DELAY = common.DELAY;

var appID;
var authValue;
var appIDsha256 = common.appIDsha256;

var adminEmail = 'admin' + Math.round(Math.random() * 1000000) + '@example.com';
var adminPassword = '5f4dcc3b5aa765d61d8327deb882cf99';

var admin = {
	email: adminEmail,
	password: adminPassword
};

var invalidUDID = 'invalid';
var deviceIdentifier;

before(function(done){

	this.timeout(100*DELAY);

	var clientrequest = {
		name: "test-app",
		keys: [ common.appKey ]
	};

	request(url)
		.post('/admin/add')
		.send(admin)
		.end(function(err, res) {

			request(url)
				.post('/admin/login')
				.set('Content-type','application/json')
				.send(admin)
				.end(function(err, res) {

					var token = res.body.content.token;
					authValue = 'Bearer ' + token;

					request(url)
						.post('/admin/app/add')
						.set('Content-type','application/json')
						.set('Authorization', authValue)
						.send(clientrequest)
						.end(function(err, res) {

							appID =  res.body.content.id;
							done();
						});
				});
		});
});

it('3.1 should return a success response to indicate device successfully registered', function(done) {

	this.timeout(100*DELAY);

	var clientRequest = {
		info: {
			os: "Android",
			version: "4.4.3",
			sdk_level: 19,
			manufacturer: "HTC",
			model: "HTC One_M8",
			udid: invalidUDID
		},
		persistent: {
			type: "android",
			token: "android pn token"
		}
	};

	request(url)
		.post('/device/register')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', '')
		.set('X-BLGREQ-APPID', appID)
		.send(clientRequest)
		.end(function(err, res) {

			res.statusCode.should.be.equal(200);
			res.body.content.identifier;
			done();
		});
});

it('3.2 should return a success response to indicate device successfully registered with random UDID', function(done) {

	this.timeout(100*DELAY);

	var clientRequest = {
		info: {
			os: "Android",
			version: "4.4.3",
			sdk_level: 19,
			manufacturer: "HTC",
			model: "HTC One_M8",
			udid: Math.round(Math.random()*1000000)+1000
		},
		persistent: {
			type: "android",
			token: "android pn token"
		}
	};

	request(url)
		.post('/device/register')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', '')
		.set('X-BLGREQ-APPID', appID)
		.send(clientRequest)
		.end(function(err, res) {

			res.statusCode.should.be.equal(200);
			deviceIdentifier = res.body.content.identifier;
			done();
		});
});

it('3.3 should return a success response to indicate device successfully updated', function(done) {

	this.timeout(100*DELAY);

	var clientRequest = {
		info: {
			os: "Android",
			version: "4.4.3",
			sdk_level: 19,
			manufacturer: "HTC",
			model: "HTC One_M8",
		},
		persistent: {
			type: "android",
			token: "android pn token"
		}
	};
	console.log(deviceIdentifier);
	console.log(appID);
	request(url)
		.post('/device/register')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', deviceIdentifier)
		.set('X-BLGREQ-APPID', appID)
		.send(clientRequest)
		.end(function(err, res) {

			res.statusCode.should.be.equal(200);
			done();
		});
});

it('3.4 should return an error response to indicate device successfully registered, uuid missing from request', function(done) {

	this.timeout(100*DELAY);

	var clientRequest = {
		info: {
			os: "Android",
			version: "4.4.3",
			sdk_level: 19,
			manufacturer: "HTC",
			model: "HTC One_M8",
		},
		persistent: {
			type: "android",
			token: "android pn token"
		}
	};

	request(url)
		.post('/device/register')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', '')
		.set('X-BLGREQ-APPID', appID)
		.send(clientRequest)
		.end(function(err, res) {

			res.statusCode.should.be.equal(200);
			done();
		});
});

it('3.5 should return an error response to indicate device NOT successfully registered because of missing info', function(done) {

	this.timeout(100*DELAY);

	var clientRequest = {
		persistent: {
			type: "android",
			token: "android pn token"
		}
	};

	request(url)
		.post('/device/register')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', '')
		.set('X-BLGREQ-APPID', appID)
		.send(clientRequest)
		.end(function(err, res) {

			res.statusCode.should.be.equal(400);
			res.body.code.should.be.equal('004');
			done();
		});
});

it('3.6 should return an error response to indicate device NOT successfully registered because of missing body', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.post('/device/register')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', '')
		.set('X-BLGREQ-APPID', appID)
		.send()
		.end(function(err, res) {

			res.statusCode.should.be.equal(400);
			res.body.code.should.be.equal('005');
			done();
		});
});

it('3.7 should return an error response to indicate device NOT successfully registered because of missing body and invalidUDID', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.post('/device/register')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', 'invalidUDID')
		.set('X-BLGREQ-APPID', appID)
		.send()
		.end(function(err, res) {

			res.statusCode.should.be.equal(400);
			res.body.code.should.be.equal('005');
			done();
		});
});

it('3.8 should return an error response to indicate device NOT successfully registered because of invalid UDID', function(done) {

	this.timeout(100*DELAY);

	var clientRequest = {
		info: {
			os: "Android",
			version: "4.4.3",
			sdk_level: 19,
			manufacturer: "HTC",
			model: "HTC One_M8",
		},
		persistent: {
			type: "android",
			token: "android pn token"
		}
	};

	request(url)
		.post('/device/register')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', invalidUDID)
		.set('X-BLGREQ-APPID', appID)
		.send(clientRequest)
		.end(function(err, res) {

			res.statusCode.should.be.equal(404);
			res.body.code.should.be.equal('025');
			done();
		});
});
