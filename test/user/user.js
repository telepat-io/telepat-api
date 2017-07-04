var common = require('../common');
var request = common.request;
var should = common.should;
var url = common.url;
var DELAY = common.DELAY;

var appIDsha256 = common.appIDsha256;

var deviceIdentification;
var invalidUDID = 'invalid';
var authValue;
var adminAuthValue;
var token;
var appID;
var userID;

var userEmail = "user"+ Math.round(Math.random()*1000000)+1000 +"@example1.com";
var userEmail2 = "user"+ Math.round(Math.random()*1000000)+1000 +"@example.com";
var userEmail3 = "user"+ Math.round(Math.random()*1000000)+1000 +"@example.com";
var adminEmail = 'admin'+Math.round(Math.random()*1000000)+'@example.com';
var adminPassword = '5f4dcc3b5aa765d61d8327deb882cf99';

var admin = {
	email: adminEmail,
	password: adminPassword
};

before(function(done){

	this.timeout(100*DELAY);

	var deviceRegisterRequest = {
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


	var appRequest = {
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
					adminAuthValue = 'Bearer ' + token;

					request(url)
						.post('/admin/app/add')
						.set('Content-type','application/json')
						.set('Authorization', adminAuthValue)
						.send(appRequest)
						.end(function(err, res) {

							appID =  res.body.content.id;

							request(url)
								.post('/device/register')
								.set('X-BLGREQ-SIGN', appIDsha256)
								.set('X-BLGREQ-UDID', '')
								.set('X-BLGREQ-APPID',appID)
								.send(deviceRegisterRequest)
								.end(function(err, res) {

									deviceIdentification =  res.body.content.identifier;
									done();
								});
						});
				});
		});
});

it('5.1 should return an error response to indicate that the user has NOT logged via Facebook because request body is empty', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.post('/user/login-facebook')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send()
		.end(function(err, res) {

			res.body.code.should.be.equal('005');
			res.statusCode.should.be.equal(400);
			done();
		});
});

it('5.2 should return an error response to indicate that the user has NOT logged via Facebook because of missing access token', function(done) {

	this.timeout(100*DELAY);

	var clientRequest = {
		something_else: "invalidToken"
	};

	request(url)
		.post('/user/login-facebook')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientRequest)
		.end(function(err, res) {

			res.body.code.should.be.equal('004');
			res.statusCode.should.be.equal(400);
			done();
		});
});

it('5.3 should return an error response to indicate that the user has NOT logged via Facebook because of invalid token', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		access_token: "invalidToken"
	};

	request(url)
		.post('/user/login-facebook')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {
			res.statusCode.should.be.equal(401);
			res.body.code.should.be.equal('014');
			done();
		});
});

it('5.4 should return a success response to indicate that the user has logged in via user & password', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		username: userEmail,
		password: "secure_password1337",
		name: "John Smith"
	};
	request(url)
		.post('/user/register-username')
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
			}, 20*DELAY);
		});
});

it('5.5 should return a success response to indicate that the user has logged in via Facebook', function(done) {

	this.timeout(100*DELAY);


	request('https://graph.facebook.com')
		.get('/oauth/access_token?client_id=1086083914753251&client_secret=40f626ca66e4472e0d11c22f048e9ea8&grant_type=client_credentials')
		.send()
		.end(function(err, res) {
			var text = JSON.parse(res.text);
			request('https://graph.facebook.com')
				.get('/v1.0/1086083914753251/accounts/test-users?access_token='+ text.access_token)
				.send()
				.end(function(err, res) {
					var data = JSON.parse(res.text);
					var clientrequest = {
						access_token: data.data[0].access_token,
						
					}
					request(url)
						.post('/user/register-facebook')
						.set('Content-type','application/json')
						.set('X-BLGREQ-SIGN', appIDsha256 )
						.set('X-BLGREQ-APPID', appID )
						.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
						.send(clientrequest)
						.end(function(err, res) {
							var subclientrequest = {
								access_token: clientrequest.access_token
		
							}
							setTimeout(function() {
								request(url)
									.post('/user/login-facebook')
									.set('Content-type','application/json')
									.set('X-BLGREQ-SIGN', appIDsha256 )
									.set('X-BLGREQ-APPID', appID )
									.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
									.send(subclientrequest)
									.end(function(err, res) {
										
										res.statusCode.should.be.equal(200);
										done();
									});
							}, 20*DELAY);
						});
				});
		});
});

it('5.6 should return a success response to indicate that the user info was retrieved', function(done) {

	this.timeout(100*DELAY);

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

it('5.7 should return an error response to indicate that the user info was NOT retrieved because user was not found', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		username: "exampleUser@appscend.com",
		password: "secure_password1337",
		name: "John Smith"
	};

	request(url)
		.post('/user/register-username')
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

						var token3 = res.body.content.token;
						var userID3 = res.body.content.user.id;
						var authValue3 = 'Bearer ' + token3;
						var subclientrequest = {
							id : userID3,
							username : "exampleUser@appscend.com"
						};

						request(url)
							.delete('/user/delete')
							.set('X-BLGREQ-SIGN', appIDsha256)
							.set('X-BLGREQ-UDID', deviceIdentification)
							.set('X-BLGREQ-APPID',appID)
							.set('Authorization', authValue3)
							.send(subclientrequest)
							.end(function(err, res) {
								setTimeout(function(){

									request(url)
										.get('/user/me')
										.set('Content-type','application/json')
										.set('X-BLGREQ-SIGN', appIDsha256 )
										.set('X-BLGREQ-APPID', appID )
										.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
										.set('Authorization', authValue3 )
										.send()
										.end(function(err, res) {

											res.statusCode.should.be.equal(404);
											res.body.code.should.be.equal('023');
											done();
										});
								}, 20*DELAY);
							});
					});
			}, 20*DELAY);
		});
});

it('5.8 should return an error response to indicate that the user has NOT logged in via user & password because of invalid credentials', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		username: userEmail,
		password: "secure_password",
		name: "John Smith"
	};

	request(url)
		.post('/user/login_password')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {

			res.body.code.should.be.equal('031');
			res.statusCode.should.be.equal(401);
			done();
		});
});

it('5.9 should return an error response to indicate that the user has NOT logged in via user & password because user not found', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		username: 'user'+Math.round(Math.random()*1000000)+'@example.com',
		password: "secure_password",
		name: "John Smith"
	};

	request(url)
		.post('/user/login_password')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {

			res.body.code.should.be.equal('023');
			res.statusCode.should.be.equal(404);
			done();
		});
});

it('5.10 should return an error response to indicate that the user has NOT logged in via user & password because username was missing for request', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		password: "secure_password",
		name: "John Smith"
	};

	request(url)
		.post('/user/login_password')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {

			res.body.code.should.be.equal('004');
			res.statusCode.should.be.equal(400);
			done();
		});
});

it('5.11 should return an error response to indicate that the user has NOT logged in via user & password because password was missing for request', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		username: 'user'+Math.round(Math.random()*1000000)+'@example.com',
		name: "John Smith"
	};

	request(url)
		.post('/user/login_password')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {

			res.body.code.should.be.equal('004');
			res.statusCode.should.be.equal(400);
			done();
		});
});

it('5.12 should return a success response to indicate that the user was updated', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		patches : [
			{
				op: "replace",
				path: "user/"+userID+"/token",
				value: "token"
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

it('5.13 should return a success response to indicate that the user password was updated', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		patches : [
			{
				op: "replace",
				path: "user/"+userID+"/password",
				value: "new value"
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

it('5.14 should return an error response to indicate that the userID is not valid', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		patches : [
			{
				op: "replace",
				path: "user/" + userID + "66" +"/password",
				value: "new value"
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

			res.body.code.should.be.equal('042');
			res.statusCode.should.be.equal(400);
			done();
		});
});

it('5.15 should return a success response to indicate that the user password was NOT updated because of empty request body', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.post('/user/update')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.set('Authorization', authValue )
		.send()
		.end(function(err, res) {

			res.body.code.should.be.equal('005');
			res.statusCode.should.be.equal(400);
			done();
		});
});

it('5.16 should return a success response to indicate that the user password was NOT updated because patches is not an array', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		patches : {}
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

			res.body.code.should.be.equal('038');
			res.statusCode.should.be.equal(400);
			done();
		});
});

it('5.17 should return a success response to indicate that the user password was NOT updated because patches is an empty array', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		patches : []
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

			res.body.code.should.be.equal('038');
			res.statusCode.should.be.equal(400);
			done();
		});
});

it('5.18 should return a success response to indicate that the user was updated immediate', function(done) {
	done()
	this.timeout(100*DELAY);

	var clientrequest = {
		name: "new name",
		password: "new pass"
	};

	request(url)
		.post('/user/update_immediate')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.set('Authorization', authValue )
		.send(clientrequest)
		.end(function(err, res) {

			res.statusCode.should.be.equal(200);
			done();
		});
});

it('5.19 should return a success response to indicate that the token was updated', function(done) {

	this.timeout(100*DELAY);

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

it('5.20 should return an error response to indicate that the token was NOT updated because of bad authorization', function(done) {

	this.timeout(100*DELAY);

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

			res.body.code.should.be.equal('014');
			res.statusCode.should.be.equal(401);
			done();
		});
});

it('5.21 should return an error response to indicate that the token was NOT updated because of bad token', function(done) {

	this.timeout(100*DELAY);

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

			res.body.code.should.be.equal('040');
			res.statusCode.should.be.equal(400);
			res.body.message.should.be.equal("Malformed authorization token");
			done();
		});
});

it('5.22 should return an error response to indicate that the token was NOT updated because authorization is missing', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.get('/user/refresh_token')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', deviceIdentification)
		.set('X-BLGREQ-APPID',appID)
		.send()
		.end(function(err, res) {

			res.body.code.should.be.equal('013');
			res.statusCode.should.be.equal(401);
			done();
		});
});

it('5.24 should return an error response to indicate that the token was NOT updated because Content-type is not application/json', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.get('/user/refresh_token')
		.set('Content-type','application/other')
		.set('X-BLGREQ-SIGN', appIDsha256)
		.set('X-BLGREQ-UDID', deviceIdentification)
		.set('X-BLGREQ-APPID',appID)
		.set('Authorization', authValue )
		.send()
		.end(function(err, res) {

			res.body.code.should.be.equal('006');
			res.statusCode.should.be.equal(415);
			done();
		});
});

it('5.27 should return a success response to indicate that the user logged out', function(done) {

	this.timeout(100*DELAY);

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
it('5.28 should return a success response to indicate that the user has registered', function(done) {

	this.timeout(100*DELAY);

	this.timeout(20*DELAY);

	var clientrequest = {
		username: userEmail2,
		password: "secure_password1337",
		name: "John Smith"
	};

	request(url)
		.post('/user/register-username')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {

			res.statusCode.should.be.equal(202);
			setTimeout(done, 14*DELAY);
		});
});

it('5.29 should return a success response to indicate that the user has NOT registered because user is already registered', function(done) {

	var clientrequest = {
		username: userEmail2,
		password: "secure_password1337",
		name: "John Smith"
	};

	request(url)
		.post('/user/register-username')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID)
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {
			res.body.code.should.be.equal('029');
			res.statusCode.should.be.equal(409);
			done();
		});
});

it('5.30 should return a success response to indicate that the user has NOT registered because of empty body', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.post('/user/register-username')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID)
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send()
		.end(function(err, res) {

			res.body.code.should.be.equal('005');
			res.statusCode.should.be.equal(400);
			done();
		});
});

it('5.31 should return a success response to indicate that the user was deleted', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		username: userEmail2,
		password: "secure_password1337",
		name: "John Smith"
	};

	request(url)
		.post('/user/login_password')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {
			var token = res.body.content.token;
			var userID = res.body.content.user.id;
			var authValue = 'Bearer ' + token;
			var subclientrequest = {
				id : userID,
				username : userEmail
			};

			request(url)
				.delete('/user/delete')
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
it('5.32 should return an error response to indicate that the user has NOT logged via Twitter because request body is empty', function(done) {
	
	this.timeout(100 * DELAY);
	
	request(url)
		.post('/user/login-twitter')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send()
		.end(function(err, res) {

			res.body.code.should.be.equal('005');
			res.statusCode.should.be.equal(400);
			done();
		});


});

it('5.33 should return an error response to indicate that the user has NOT logged via Twitter because of missing oauth token', function(done) {
	
	
	this.timeout(100 * DELAY);
	
	var clientrequest = {
		something_else : "invalid_token"
	}

	request(url)
		.post('/user/login-twitter')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {

			res.body.code.should.be.equal('004');
			res.statusCode.should.be.equal(400);
			done();
		});
	
});

it('5.34 should return an error response to indicate that the user has NOT logged via Twitter because of missing oauth token secret', function(done) {
	
	
	this.timeout(100 * DELAY);
	
	var clientrequest = {
		oauth_token : "valid token",
	}

	request(url)
		.post('/user/login-twitter')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {

			res.body.code.should.be.equal('004');
			res.statusCode.should.be.equal(400);
			done();
		});
	
});

it('5.35 should return an error response to indicate that the user has NOT logged via Twitter because of wrong creditentials', function(done) {
	
	this.timeout(100*DELAY);

	var clientrequest = {
		oauth_token: "invalidToken",
		oauth_token_secret: "invalidToken"
	};

	request(url)
		.post('/user/login-twitter')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {
	
			res.statusCode.should.be.equal(401);
			res.body.code.should.be.equal('014');
			done();
		});;

});

var clientrequest2 = {
		username: userEmail3,
		email: userEmail3,
		password: "secure_password1337",
		name: "John Smith"
};

it('5.36 should return a success response to indicate that the user metadata was updated', function(done) {

	this.timeout(100*DELAY);


	request(url)
		.post('/user/register-username')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest2)
		.end(function(err, res) {

			setTimeout(function() {
				request(url)
					.post('/user/login_password')
					.set('Content-type','application/json')
					.set('X-BLGREQ-SIGN', appIDsha256 )
					.set('X-BLGREQ-APPID', appID )
					.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
					.send(clientrequest2)
					.end(function(err, res) {
						token = res.body.content.token;
						userID = res.body.content.user.id;
						authValue = 'Bearer ' + token;
			
						request(url)
							.get('/user/metadata')
							.set('Content-type','application/json')
							.set('X-BLGREQ-SIGN', appIDsha256 )
							.set('X-BLGREQ-APPID', appID )
							.set('Authorization', authValue)
							.send()
							.end(function(err, res){
								
								var metadataId = res.body.content.id;
								var subclientrequest = {
									patches : [
										{
											op: "replace",
											path: "user_metadata/"+metadataId+"/name",
											value: "Gicu"
										}
									],
								
								};

								request(url)
									.post('/user/update_metadata')
									.set('Content-type','application/json')
									.set('X-BLGREQ-SIGN', appIDsha256 )
									.set('X-BLGREQ-APPID', appID )
									.set('Authorization', authValue)
									.send(subclientrequest)
									.end(function(err, res){
										
										res.body.status.should.be.equal(200);

										done();
									});
									
							});

						
					// });
				});
			},20*DELAY);

	});
});

it('5.37 should return an error response to indicate that the user metadata was NOT updated because of missing required field', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.post('/user/update_metadata')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('Authorization', authValue)
		.send()
		.end(function(err, res){	
			res.body.status.should.be.equal(400);
			res.body.code.should.be.equal('004');
			done();
		});
									
});
 
 it('5.38 should return a success response to indicate that a password reset email was sent', function(done) {

	this.timeout(10000*DELAY);
	var clientrequest = {
		username: userEmail3,
		link: "link"
	}
	request(url)
		.post('/user/request_password_reset')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.send(clientrequest)
		.end(function(err, res){
			res.body.status.should.be.equal(200);
			done();
		});

});
 it('5.39 should return an error response to indicate that a password reset email was NOT sent because user not found', function(done) {

	this.timeout(10000*DELAY);
	var clientrequest = {
		username: userEmail2,
		link: "link"
	}
	request(url)
		.post('/user/request_password_reset')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.send(clientrequest)
		.end(function(err, res){	
			res.body.status.should.be.equal(404);
			res.body.code.should.be.equal('023');
			done();
		});

});
 it('5.40 should return an error response to indicate that a password reset email was NOT sent because user has no email address', function(done) {

	this.timeout(100*DELAY);
	var clientrequest = {
		username: userEmail,
		link: "link"
	}
	request(url)
		.post('/user/request_password_reset')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.send(clientrequest)
		.end(function(err, res){	

			res.body.status.should.be.equal(400);
			res.body.code.should.be.equal('039');
			done();
		});

});
it('5.41 should return a sucess response to indicate that an user was registered in via Twitter', function(done){

	this.timeout(100*DELAY);

	var clientrequest = {
		oauth_token: "863538561676652544-LiBPkd2t4R2aF7zUHAQ4DbN28Ras3jP", 
		oauth_token_secret: "sFZcTBOyn9LoexCig7XEtBI5Ouchx8pZ1DMyAe6jwZGLR" 
	}

	request(url)
		.post('/user/register-twitter')	
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {
			console.log(res);
			res.statusCode.should.be.equal(202);
			done();
		});
});


it('5.42 should return a success response to indicate that an user was logged in via Twitter', function(done){
	
	this.timeout(100*DELAY);

	var clientrequest = {
		oauth_token: "863538561676652544-LiBPkd2t4R2aF7zUHAQ4DbN28Ras3jP", 
		oauth_token_secret: "sFZcTBOyn9LoexCig7XEtBI5Ouchx8pZ1DMyAe6jwZGLR" 
	}

	request(url)
		.post('/user/login-twitter')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res){
		
			var twitterToken = res.body.content.token;
			var clientrequest = {
				id: res.body.content.user.id
			}
			res.statusCode.should.be.equal(200);
			done();

		});

});

it('5.43 should return a success response to indicate that a password was reseted', function(done) {

	this.timeout(100*DELAY);


	var clientrequest = {
		patches : [
			{
				op: "replace",
				path: "user/"+userID+"/password_reset_token",
				value: "token"
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

			var subclientrequest = {
				token: "token", 
				user_id: userID,
				password: "new_password"
			}
			setTimeout(function() {
				request(url)
					.post('/user/password_reset')
					.set('Content-type','application/json')
					.set('X-BLGREQ-SIGN', appIDsha256 )
					.set('X-BLGREQ-APPID', appID )
					.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
					.send(subclientrequest)
					.end(function(err, res) {

						res.statusCode.should.be.equal(200);
						done();
					});
			}, 20*DELAY);

		});

});

it('5.44 should return a success response to indicate that informations about another user where retirved', function(done){

	this.timeout(100*DELAY);

	var clientrequest = {
		user_id: userID
	}
	request(url)
		.get('/user/get')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
		.set('Authorization', authValue)
		.send(clientrequest)
		.end(function(err, res){
			res.statusCode.should.be.equal(200);
			done();
		});

});

it('5.45 should return a success response to indicate that informations about another user where NOT retirved because user was not found', function(done){

	this.timeout(100*DELAY);

	var clientrequest = {
		user_id: userID + '2131'
	}
	request(url)
		.get('/user/get')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
		.set('Authorization', authValue)
		.send(clientrequest)
		.end(function(err, res){
		
			res.statusCode.should.be.equal(404);
			res.body.code.should.be.equal('023');
			done();
		});

});

it('5.46 should return an success response to indicate that an account was confirmed', function(done){

	this.timeout(100*DELAY);
	console.log('used user id is ', userID);
	var clientrequest = {
		patches : [
			{
				op: "replace",
				path: "user/"+userID+"/confirmationHash",
				value: "hash"
			},
			{
				op: "replace",
				path: "user/"+userID+"/confirmed" ,
				value: "false"
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

			var clientrequest = {
				hash: "hash",
				username: userEmail3, 
				app_id: appID
			}
			setTimeout(function() {
				request(url)
					.get('/user/confirm')
					.set('Content-type','application/json')
					.send(clientrequest)
					.end(function(err, res) {

						res.statusCode.should.be.equal(200);
						done();
					});
			}, 40*DELAY);

		});

});

