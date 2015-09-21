var common = require('../common');
var request = common.request;
var should = common.should;
var assert = common.assert;
var crypto = common.crypto;
var url = common.url;
var DELAY = common.DELAY;

var appIDsha256 = common.appIDsha256;

var deviceIdentification;
var invalidUDID = 'invalid';
var appIDsha256 =  common.appIDsha256;
var authValue;
var adminAuthValue;
var token;
var appID;
var userID;

var userEmail = "user"+ Math.round(Math.random()*1000000)+1000 +"@example.com";
var userEmail2 = "user"+ Math.round(Math.random()*1000000)+1000 +"@example.com";
var adminEmail = 'admin'+Math.round(Math.random()*1000000)+'@example.com';
var adminPassword = '5f4dcc3b5aa765d61d8327deb882cf99';

var admin = {
	email: adminEmail,
	password: adminPassword
};

before(function(done){
	var clientrequest = {
		"info": {
			"os": "Android",
			"version": "4.4.3",
			"sdk_level": 19,
			"manufacturer": "HTC",
			"model": "HTC One_M8",
			"udid": invalidUDID
		},
		"persistent": {
			"type": "android",
			"token": "android pn token"
		}
	}

	this.timeout(10000);
	var clientrequest = {
		"name": "test-app",
		"keys": [ common.appKey ]
	};
	request(url)
		.post('/admin/add')
		.send(admin)
		.end(function(err, res) {
			setTimeout(function () {
				request(url)
					.post('/admin/login')
					.set('Content-type','application/json')
					.send(admin)
					.end(function(err, res) {
						var token = res.body.content.token;
						adminAuthValue = 'Bearer ' + token;
						request(url)
							.post('/admin/app/add')
							.set('Content-type','application/json')
							.set('Authorization', adminAuthValue)
							.send(clientrequest)
							.end(function(err, res) {
								appID =  res.body.content.id;
								var clientrequest = {
									"info": {
										"os": "Android",
										"version": "4.4.3",
										"sdk_level": 19,
										"manufacturer": "HTC",
										"model": "HTC One_M8",
										"udid": invalidUDID
									},
									"persistent": {
										"type": "android",
										"token": "android pn token"
									}
								}
								request(url)
									.post('/device/register')
									.set('X-BLGREQ-SIGN', appIDsha256)
									.set('X-BLGREQ-UDID', '')
									.set('X-BLGREQ-APPID',appID)
									.send(clientrequest)
									.end(function(err, res) {
										deviceIdentification =  res.body.content.identifier;
										done();
									});
							});
					});
			}, 4*DELAY);
		});
});

// it('should return an error response to indicate that the user has NOT logged via FACEBOOK because of missing access token', function(done) {

// var clientrequest = {};

// request(url)
// .post('/user/login')
// .set('Content-type','application/json')
// .set('X-BLGREQ-SIGN', appIDsha256 )
// .set('X-BLGREQ-APPID', 1 )
// .set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
// .send(clientrequest)
// .end(function(err, res) {
// res.statusCode.should.be.equal(400);
// done();
// });
// });

it('should return a success response to indicate that the user has logged in via user & password', function(done) {
	var clientrequest = {
		"email": userEmail,
		"password": "secure_password1337",
		"name": "John Smith"
	};
	request(url)
		.post('/user/register')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {
			setTimeout(function() {
				request(url)
					.post('/user/login_password')
					.set('Content-type','application/json')
					.set('X-BLGREQ-SIGN', appIDsha256 )
					.set('X-BLGREQ-APPID', appID )
					.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
					.send(clientrequest)
					.end(function(err, res) {
						token = res.body.content.token;
						userID = res.body.content.user.id;
						authValue = 'Bearer ' + token;
						res.statusCode.should.be.equal(200);
						done();
					});
			}, 4*DELAY);
		});
});

it('should return a success response to indicate that the user has logged in via Facebook', function(done) {
	this.timeout(15*DELAY);
	request('https://graph.facebook.com')
		.get('/oauth/access_token?client_id=1086083914753251&client_secret=40f626ca66e4472e0d11c22f048e9ea8&grant_type=client_credentials')
		.send()
		.end(function(err, res) {
			request('https://graph.facebook.com')
				.get('/v1.0/1086083914753251/accounts/test-users?access_token='+res.text.replace('access_token=', ''))
				.send()
				.end(function(err, res) {
					var data = JSON.parse(res.text);
					var clientrequest = {
						"access_token": data.data[0].access_token
					};
					request(url)
						.post('/user/register')
						.set('Content-type','application/json')
						.set('X-BLGREQ-SIGN', appIDsha256 )
						.set('X-BLGREQ-APPID', appID )
						.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
						.send(clientrequest)
						.end(function(err, res) {
							setTimeout(function() {
								request(url)
									.post('/user/login')
									.set('Content-type','application/json')
									.set('X-BLGREQ-SIGN', appIDsha256 )
									.set('X-BLGREQ-APPID', appID )
									.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
									.send(clientrequest)
									.end(function(err, res) {
										//token = res.body.content.token;
										//userID = res.body.content.user.id;
										//authValue = 'Bearer ' + token;
										res.statusCode.should.be.equal(200);
										done();
									});
							}, 4*DELAY);
						});
				});
		});
});

it('should return a success response to indicate that the user info was retrived', function(done) {
	request(url)
		.get('/user/me')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.set('Authorization', authValue )
		.send()
		.end(function(err, res) {
			res.statusCode.should.be.equal(200);
			done();
		});
});

it('should return an error response to indicate that the user has NOT logged in via user & password because of Invalid Credentials', function(done) {
	var clientrequest = {
		"email": userEmail,
		"password": "secure_password",
		"name": "John Smith"
	};
	request(url)
		.post('/user/login_password')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {
			res.statusCode.should.be.equal(401);
			done();
		});
});

it('should return an error response to indicate that the user has NOT logged in via user & password because user not found', function(done) {
	var clientrequest = {
		"email": 'user'+Math.round(Math.random()*1000000)+'@example.com',
		"password": "secure_password",
		"name": "John Smith"
	};
	request(url)
		.post('/user/login_password')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {
			res.statusCode.should.be.equal(404);
			done();
		});
});

it('should return a success response to indicate that the user was updated', function(done) {
	var clientrequest = {
		"email": userEmail,
		"password": "secure_password1337",
		"patches" : [
			{
				"op": "replace",
				"path": "user/"+userEmail+"/name",
				"value": "new value"
			}
		]
	};
	request(url)
		.post('/user/update')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.set('Authorization', authValue )
		.send(clientrequest)
		.end(function(err, res) {
			res.statusCode.should.be.equal(202);
			done();
		});
});

it('should return a success response to indicate that the token was updated', function(done) {
	request(url)
		.get('/user/refresh_token')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', deviceIdentification)
		.set('X-BLGREQ-APPID',appID)
		.set('Authorization', authValue )
		.send()
		.end(function(err, res) {
			token = res.body.content.token;
			authValue = 'Bearer ' + token;
			res.statusCode.should.be.equal(200);
			done();
		});
});

it('should return an error response to indicate that the token was NOT updated because of bad Authorization', function(done) {
	var authValue = "something";
	request(url)
		.get('/user/refresh_token')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', deviceIdentification)
		.set('X-BLGREQ-APPID',appID)
		.set('Authorization', authValue )
		.send()
		.end(function(err, res) {
			res.statusCode.should.be.equal(400);
			res.body.message.should.be.equal("Token not present or authorization header is invalid");
			done();
		});
});

it('should return an error response to indicate that the token was NOT updated because of bad token', function(done) {
	var authValue = 'Bearer something';
	request(url)
		.get('/user/refresh_token')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', deviceIdentification)
		.set('X-BLGREQ-APPID',appID)
		.set('Authorization', authValue )
		.send()
		.end(function(err, res) {
			res.statusCode.should.be.equal(400);
			res.body.message.should.be.equal("Malformed authorization token");
			done();
		});
});

it('should return a success response to indicate that the user logged out', function(done) {
	request(url)
		.get('/user/logout')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', deviceIdentification)
		.set('X-BLGREQ-APPID',appID)
		.set('Authorization', authValue)
		.send()
		.end(function(err, res) {
			res.statusCode.should.be.equal(200);
			done();
		});
});

it('should return a success response to indicate that the user has registered', function(done) {
	var clientrequest = {
		"email": userEmail2,
		"password": "secure_password1337",
		"name": "John Smith"
	};
	request(url)
		.post('/user/register')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {
			res.statusCode.should.be.equal(202);
			done();
		});
});

it('should return a success response to indicate that the user has NOT registered', function(done) {
	var clientrequest = {
		"email": userEmail,
		"password": "secure_password1337",
		"name": "John Smith"
	};
	request(url)
		.post('/user/register')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID)
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {
			res.statusCode.should.be.equal(409);
			done();
		});
});

it('should return a success response to indicate that the user was deleted', function(done) {
	var clientrequest = {
		"email": userEmail,
		"password": "secure_password1337",
		"name": "John Smith"
	};
	request(url)
		.post('/user/login_password')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {
			token = res.body.content.token;
			userID = res.body.content.user.id;
			authValue = 'Bearer ' + token;
			var subclientrequest = {
				"id" : userID,
				"email" : userEmail
			};
			request(url)
				.post('/user/delete')
				.set('X-BLGREQ-SIGN', appIDsha256)
				.set('X-BLGREQ-UDID', deviceIdentification)
				.set('X-BLGREQ-APPID',appID)
				.set('Authorization', authValue)
				.send(subclientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(202);
					done();
				});
		});
});
