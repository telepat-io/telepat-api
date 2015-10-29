var common = require('../common');
var request = common.request;
var should = common.should;
var async = common.async;
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

var userEmail = "user"+ Math.round(Math.random()*1000000)+1000 +"@example.com";
var userEmail2 = "user"+ Math.round(Math.random()*1000000)+1000 +"@example.com";
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

	async.waterfall([
		function(callback) {
			request(url)
				.post('/admin/add')
				.send(admin)
				.end(function(err, res) {

					callback();
				});
		},
		function(callback) {
			request(url)
				.post('/admin/login')
				.set('Content-type','application/json')
				.send(admin)
				.end(function(err, res) {

					var token = res.body.content.token;
					adminAuthValue = 'Bearer ' + token;
					callback();
				});
		},
		function(callback) {
			request(url)
				.post('/admin/app/add')
				.set('Content-type','application/json')
				.set('Authorization', adminAuthValue)
				.send(appRequest)
				.end(function(err, res) {

					appID =  res.body.content.id;
					callback();
				});
		},
		function(callback) {
			request(url)
				.post('/device/register')
				.set('X-BLGREQ-SIGN', appIDsha256)
				.set('X-BLGREQ-UDID', '')
				.set('X-BLGREQ-APPID',appID)
				.send(deviceRegisterRequest)
				.end(function(err, res) {

					deviceIdentification =  res.body.content.identifier;
					callback();
					done();
				});
		}
	]);
});

it('5.1 should return an error response to indicate that the user has NOT logged via Facebook because request body is empty', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.post('/user/login')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send()
		.end(function(err, res) {

			common.assertnDebug([{ expected: '005', result: res.body.code }, { expected: 400, result: res.statusCode }], err, res);
			done();
		});
});

it('5.2 should return an error response to indicate that the user has NOT logged via Facebook because of missing access token', function(done) {

	this.timeout(100*DELAY);

	var clientRequest = {
		something_else: "invalidToken"
	};

	request(url)
		.post('/user/login')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientRequest)
		.end(function(err, res) {

			common.assertnDebug([{ expected: '004', result: res.body.code }, { expected: 400, result: res.statusCode }], err, res);
			done();
		});
});

it('5.3 should return an error response to indicate that the user has NOT logged via Facebook because of invalid token', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		access_token: "invalidToken"
	};

	request(url)
		.post('/user/login')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {

			common.assertnDebug([{ expected: '002', result: res.body.code }, { expected: 500, result: res.statusCode }], err, res);
			done();
		});
});

it('5.4 should return a success response to indicate that the user has logged in via user & password', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		email: userEmail,
		password: "secure_password1337",
		name: "John Smith"
	};

	async.waterfall([
		function(callback) {
			request(url)
				.post('/user/register')
				.set('Content-type','application/json')
				.set('X-BLGREQ-SIGN', appIDsha256 )
				.set('X-BLGREQ-APPID', appID )
				.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
				.send(clientrequest)
				.end(function(err, res) {

					setTimeout(callback, 20*DELAY);
				});
		},
		function(callback) {
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

					common.assertnDebug({ expected: 200, result: res.statusCode }, err, res);
					callback();
					done();
				});
		}
	]);
});

it('5.5 should return a success response to indicate that the user has logged in via Facebook', function(done) {

	this.timeout(100*DELAY);

	var clientrequest;
	var token;

	async.waterfall([
		function(callback) {
			request('https://graph.facebook.com')
				.get('/oauth/access_token?client_id=1086083914753251&client_secret=40f626ca66e4472e0d11c22f048e9ea8&grant_type=client_credentials')
				.send()
				.end(function(err, res) {

					token = res.text.replace('access_token=', '');
					callback();
				});
		},
		function(callback) {
			request('https://graph.facebook.com')
				.get('/v1.0/1086083914753251/accounts/test-users?access_token='+token)
				.send()
				.end(function(err, res) {

					var data = JSON.parse(res.text);
					clientrequest = {
						access_token: data.data[0].access_token
					};
					callback();
				});
		},
		function(callback) {
			request(url)
				.post('/user/register')
				.set('Content-type','application/json')
				.set('X-BLGREQ-SIGN', appIDsha256 )
				.set('X-BLGREQ-APPID', appID )
				.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
				.send(clientrequest)
				.end(function(err, res) {

					setTimeout(callback, 20*DELAY);
				});
		},
		function(callback) {
			request(url)
				.post('/user/login')
				.set('Content-type','application/json')
				.set('X-BLGREQ-SIGN', appIDsha256 )
				.set('X-BLGREQ-APPID', appID )
				.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
				.send(clientrequest)
				.end(function(err, res) {

					common.assertnDebug({ expected: 200, result: res.statusCode }, err, res);
					callback();
					done();
				});
		}
	]);
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

			common.assertnDebug({ expected: 200, result: res.statusCode }, err, res);
			done();
		});
});

it('5.7 should return an error response to indicate that the user info was NOT retrieved because user was not found', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		email: "exampleUser@appscend.com",
		password: "secure_password1337",
		name: "John Smith"
	};

	var authValue3;
	var subclientrequest;

	async.waterfall([
		function(callback) {
			request(url)
				.post('/user/register')
				.set('Content-type','application/json')
				.set('X-BLGREQ-SIGN', appIDsha256 )
				.set('X-BLGREQ-APPID', appID )
				.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
				.send(clientrequest)
				.end(function(err, res) {
					setTimeout(callback, 20*DELAY);
				});
		},
		function(callback) {
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
					authValue3 = 'Bearer ' + token3;
					subclientrequest = {
						id : userID3,
						email : "exampleUser@appscend.com"
					};
					callback();
				});
		},
		function(callback) {
			request(url)
				.delete('/user/delete')
				.set('X-BLGREQ-SIGN', appIDsha256)
				.set('X-BLGREQ-UDID', deviceIdentification)
				.set('X-BLGREQ-APPID',appID)
				.set('Authorization', authValue3)
				.send(subclientrequest)
				.end(function(err, res) {

					setTimeout(callback, 20*DELAY);
				});
		},
		function(callback) {
			request(url)
				.get('/user/me')
				.set('Content-type','application/json')
				.set('X-BLGREQ-SIGN', appIDsha256 )
				.set('X-BLGREQ-APPID', appID )
				.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
				.set('Authorization', authValue3 )
				.send()
				.end(function(err, res) {

					common.assertnDebug([{ expected: '023', result: res.body.code }, { expected: 404, result: res.statusCode }], err, res);
					callback();
					done();
				});
		}
	]);
});

it('5.8 should return an error response to indicate that the user has NOT logged in via user & password because of invalid credentials', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		email: userEmail,
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

			common.assertnDebug([{ expected: '031', result: res.body.code }, { expected: 401, result: res.statusCode }], err, res);
			done();
		});
});

it('5.9 should return an error response to indicate that the user has NOT logged in via user & password because user not found', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		email: 'user'+Math.round(Math.random()*1000000)+'@example.com',
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

			common.assertnDebug([{ expected: '023', result: res.body.code }, { expected: 404, result: res.statusCode }], err, res);
			done();
		});
});

it('5.10 should return an error response to indicate that the user has NOT logged in via user & password because email was missing for request', function(done) {

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

			common.assertnDebug([{ expected: '004', result: res.body.code }, { expected: 400, result: res.statusCode }], err, res);
			done();
		});
});

it('5.11 should return an error response to indicate that the user has NOT logged in via user & password because password was missing for request', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		email: 'user'+Math.round(Math.random()*1000000)+'@example.com',
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

			common.assertnDebug([{ expected: '004', result: res.body.code }, { expected: 400, result: res.statusCode }], err, res);
			done();
		});
});

it('5.12 should return a success response to indicate that the user was updated', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		patches : [
			{
				op: "replace",
				path: "user/"+userID+"/name",
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

			common.assertnDebug( { expected: 202, result: res.statusCode }, err, res);
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

			common.assertnDebug( { expected: 202, result: res.statusCode }, err, res);
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

			common.assertnDebug([{ expected: '042', result: res.body.code }, { expected: 400, result: res.statusCode }], err, res);
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

			common.assertnDebug([{ expected: '005', result: res.body.code }, { expected: 400, result: res.statusCode }], err, res);
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

			common.assertnDebug([{ expected: '038', result: res.body.code }, { expected: 400, result: res.statusCode }], err, res);
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

			common.assertnDebug([{ expected: '038', result: res.body.code }, { expected: 400, result: res.statusCode }], err, res);
			done();
		});
});

it('5.18 should return a success response to indicate that the user was updated immediate', function(done) {

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

			common.assertnDebug({ expected: 200, result: res.statusCode }, err, res);
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

			common.assertnDebug({ expected: 200, result: res.statusCode }, err, res);
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

			common.assertnDebug([{ expected: '014', result: res.body.code }, { expected: 401, result: res.statusCode }], err, res);
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

			common.assertnDebug([{ expected: '040', result: res.body.code }, { expected: 400, result: res.statusCode }, { expected: 'Malformed authorization token', result: res.body.message }], err, res);
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

			common.assertnDebug([{ expected: '013', result: res.body.code }, { expected: 401, result: res.statusCode }], err, res);
			done();
		});
});

it('5.23 should return an error response to indicate that the token was NOT updated because X-BLGREQ-SIGN is missing', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.get('/user/refresh_token')
		.set('Content-type','application/json')
		.set('X-BLGREQ-UDID', deviceIdentification)
		.set('X-BLGREQ-APPID',appID)
		.set('Authorization', authValue )
		.send()
		.end(function(err, res) {

			common.assertnDebug([{ expected: '007', result: res.body.code }, { expected: 400, result: res.statusCode }], err, res);
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

			common.assertnDebug([{ expected: '006', result: res.body.code }, { expected: 415, result: res.statusCode }], err, res);
			done();
		});
});

it('5.25 should return an error response to indicate that the token was NOT updated because of invalid API key', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.get('/user/refresh_token')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 + '66')
		.set('X-BLGREQ-UDID', deviceIdentification)
		.set('X-BLGREQ-APPID',appID)
		.set('Authorization', authValue )
		.send()
		.end(function(err, res) {

			common.assertnDebug([{ expected: '008', result: res.body.code }, { expected: 401, result: res.statusCode }], err, res);
			done();
		});
});

it('5.26 should return an error response to indicate that the token was NOT updated because of missing UDID', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.get('/user/refresh_token')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID',appID)
		.set('Authorization', authValue )
		.send()
		.end(function(err, res) {

			common.assertnDebug([{ expected: '009', result: res.body.code }, { expected: 400, result: res.statusCode }], err, res);
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

			common.assertnDebug({ expected: 200, result: res.statusCode }, err, res);
			done();
		});
});

it('5.28 should return a success response to indicate that the user has registered', function(done) {

	this.timeout(20*DELAY);

	var clientrequest = {
		email: userEmail2,
		password: "secure_password1337",
		name: "John Smith"
	};

	request(url)
		.post('/user/register')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {

			common.assertnDebug({ expected: 202, result: res.statusCode }, err, res);
			setTimeout(done, 14*DELAY);
		});
});

it('5.29 should return a success response to indicate that the user has NOT registered because user is already registered', function(done) {

	var clientrequest = {
		email: userEmail,
		password: "secure_password1337",
		name: "John Smith"
	};

	request(url)
		.post('/user/register')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID)
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {

			common.assertnDebug([{ expected: '029', result: res.body.code }, { expected: 409, result: res.statusCode }], err, res);
			done();
		});
});

it('5.30 should return a success response to indicate that the user has NOT registered because of empty body', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.post('/user/register')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID)
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send()
		.end(function(err, res) {

			common.assertnDebug([{ expected: '005', result: res.body.code }, { expected: 400, result: res.statusCode }], err, res);
			done();
		});
});

it('5.31 should return a success response to indicate that the user was deleted', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		email: userEmail2,
		password: "secure_password1337",
		name: "John Smith"
	};

	var subclientrequest;

	async.waterfall([
		function(callback) {
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
					subclientrequest = {
						id : userID,
						email : userEmail
					};

					callback();
				});
		},
		function(callback) {
			request(url)
				.delete('/user/delete')
				.set('X-BLGREQ-SIGN', appIDsha256)
				.set('X-BLGREQ-UDID', deviceIdentification)
				.set('X-BLGREQ-APPID',appID)
				.set('Authorization', authValue)
				.send(subclientrequest)
				.end(function(err, res) {

					common.assertnDebug({ expected: 202, result: res.statusCode }, err, res);
					callback();
					done();
				});
		}
	]);
});
