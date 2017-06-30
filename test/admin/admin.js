var common = require('../common');
var request = common.request;
var should = common.should;
var url = common.url;
var DELAY = common.DELAY;

var authValue;
var appID;
var appID2;
var appIDsha256 = common.appIDsha256;
var appKey = common.appKey;

var adminEmail = 'admin'+Math.round(Math.random()*1000000)+'@example.com';
var adminPassword = '5f4dcc3b5aa765d61d8327deb882cf99';

var adminEmail2 = 'admin'+Math.round(Math.random()*1000000)+'@example.com';
var adminEmail3 = 'admin'+Math.round(Math.random()*1000000)+'@example.com';

var admin = {
	email: adminEmail,
	password: adminPassword
};

var admin2 = {
	email: adminEmail2,
	password: adminPassword
};

var admin3 = {
	email: adminEmail3,
	password: adminPassword
};

var token2;
var authValue2;
var authValue3;

var userEmail = 'user'+Math.round(Math.random()*1000000)+'@example.com';
var userEmail2 = 'user'+Math.round(Math.random()*1000000)+'@example.com';
var userId = null;

describe('1.1.Admin', function() {

	it('1.1.1 should return a 200 code to indicate success when creating a new admin', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/add')
			.send(admin)
			.end(function(err, res) {

				if (err) {
					throw err;
					done(err);
				}

				res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.1.2 should return an error (409) response to indicate failure when admin already exists', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/add')
			.send(admin)
			.end(function(err, res) {
				res.statusCode.should.be.equal(409);
				res.body.code.should.be.equal('030');
				done();
			});

	});

	it('1.1.3 should return an error response indicate failure when admin email is missing', function(done) {

		this.timeout(100*DELAY);

		var admin = {
			password: adminPassword
		};

		request(url)
			.post('/admin/add')
			.send(admin)
			.end(function(err, res) {

				res.body.code.should.be.equal('004');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.1.4 should return an error response to indicate failure when admin email is empty', function(done) {

		this.timeout(100*DELAY);

		var admin = {
			email: "",
			password: adminPassword
		};

		request(url)
			.post('/admin/add')
			.send(admin)
			.end(function(err, res) {

				res.body.code.should.be.equal('004');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.1.5 should return an error response to indicate failure when admin password is empty', function(done) {

		this.timeout(100*DELAY);

		var admin = {
			email: adminEmail,
			password: ""
		};

		request(url)
			.post('/admin/add')
			.send(admin)
			.end(function(err, res) {

				res.body.code.should.be.equal('004');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.1.6 should return an error response to indicate failure when admin password is missing', function(done) {

		this.timeout(100*DELAY);

		var admin = {
			email: adminEmail
		};

		request(url)
			.post('/admin/add')
			.send(admin)
			.end(function(err, res) {

				res.body.code.should.be.equal('004');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.1.7 should return an error for logging in with wrong password', function(done) {

		this.timeout(100*DELAY);

		var admin = {
			email: adminEmail,
			password: adminPassword + '66'
		};
		request(url)
			.post('/admin/login')
			.send(admin)
			.end(function(err, res) {

				res.body.code.should.be.equal('016');
				res.statusCode.should.be.equal(401);
				done();
			});
	});

	it('1.1.8 should return an error for logging in with wrong user', function(done) {

		this.timeout(100*DELAY);

		var randEmail = 'adminx@example.com';
		var admin = {
			email: randEmail,
			password: adminPassword
		};
		request(url)
			.post('/admin/login')
			.send(admin)
			.end(function(err, res) {

				res.body.code.should.be.equal('016');
				res.statusCode.should.be.equal(401);
				done();
			});
	});

	it('1.1.9 should return an error for logging in missing password', function(done) {

		this.timeout(100*DELAY);

		var randEmail = 'adminx@example.com';
		var admin = {
			email: randEmail
		};

		request(url)
			.post('/admin/login')
			.send(admin)
			.end(function(err, res) {

				res.body.code.should.be.equal('004');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.1.10 should return an error for logging in missing email & password', function(done) {

		this.timeout(100*DELAY);

		var admin = {};

		request(url)
			.post('/admin/login')
			.send(admin)
			.end(function(err, res) {

				res.body.code.should.be.equal('004');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.1.11 should return a valid authorization token', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/login')
			.send(admin)
			.end(function(err, res) {

				authValue = 'Bearer ' + res.body.content.token;
				var adminAuth = authValue;
				admin = res.body.content.user;
				res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.1.12 should return information about the logged admin', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.get('/admin/me')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send()
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				res.body.content.email.should.be.equal(admin.email);
				done();
			});
	});

	it('1.1.13 should return an success response indicating the admin account has been updated', function(done) {

		this.timeout(100*DELAY);

		var requestBody = {
			patches: [
				{
					op: 'replace',
					path: 'admin/'+admin.id+'/name',
					value: 'Admin Name v2'
				}
			]
		};

		request(url)
			.post('/admin/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send(requestBody)
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.1.14 should return an error response indicating the admin account has NOT been updated because of invalid admin id', function(done) {

		this.timeout(100*DELAY);

		var admin = {
			patches: [
				{
					op: 'replace',
					path: 'admin/garbage/name',
					value: 'Admin Name v2'
				}
			]
		};

		request(url)
			.post('/admin/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send(admin)
			.end(function(err, res) {

				res.body.code.should.be.equal('041');
				res.statusCode.should.be.equal(401);
				done();
			});
	});

	it('1.1.15 should return an error response indicating the admin account has NOT been updated because of missing authorization header', function(done) {

		this.timeout(100*DELAY);

		var admin = {
			patches: [
				{
					op: 'replace',
					path: 'admin/garbage/name',
					value: 'Admin Name v2'
				}
			]
		};

		request(url)
			.post('/admin/update')
			.set('Content-type','application/json')
			.send(admin)
			.end(function(err, res) {

				res.body.code.should.be.equal('013');
				res.statusCode.should.be.equal(401);
				done();
			});
	});

	it('1.1.16 should return an error response indicating the admin account has NOT been updated because of missing request body', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send()
			.end(function(err, res) {

				res.body.code.should.be.equal('005');
				res.statusCode.should.be.equal(400);
				done();
			});
	});


	it('1.1.17 should return an error response indicating the admin account has NOT been updated because patches is not an array', function(done) {

		this.timeout(100*DELAY);

		var admin = {
			patches: {}
		};

		request(url)
			.post('/admin/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send(admin)
			.end(function(err, res) {

				res.body.code.should.be.equal('038');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.1.18 should return an error response indicating the admin account has NOT been updated because patches is empty', function(done) {

		this.timeout(100*DELAY);

		var admin = {
			patches: []
		};

		request(url)
			.post('/admin/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send(admin)
			.end(function(err, res) {

				res.body.code.should.be.equal('038');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.1.19 should return an error response indicating the admin account has NOT been deleted because of missing credentials', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.delete('/admin/delete')
			.set('Content-type','application/json')
			.send()
			.end(function(err, res) {

				res.statusCode.should.be.equal(401);
				done();
			});
	});

	it('1.1.20 should return an success response indicating the admin account has been deleted', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.delete('/admin/delete')
			.set('Content-type','application/json')
			.set('Authorization', authValue)
			.send()
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);

				request(url)
					.post('/admin/add')
					.send({email: admin.email, password: adminPassword})
					.end(function(err, res) {

						res.statusCode.should.be.equal(200);

						request(url)
							.post('/admin/login')
							.send({email: admin.email, password: adminPassword})
							.end(function(err, res) {

								res.statusCode.should.be.equal(200);
								authValue = 'Bearer ' + res.body.content.token;
								adminAuth = authValue;
								done();
							});
					});
			});
	});
});

describe('1.2.App', function() {

	before(function(done){

		this.timeout(100*DELAY);

		var clientrequest = {
			"name": "test-app",
			"keys": [ appKey ]
		};

		request(url)
			.post('/admin/app/add')
			.set('Content-type','application/json')
			.set('Authorization', authValue)
			.send(clientrequest)
			.end(function(err, res) {

				appID = res.body.content.id;

				request(url)
					.post('/admin/app/add')
					.set('Content-type', 'application/json')
					.set('Authorization', authValue)
					.send(clientrequest)
					.end(function (err, res) {

						appID2 = res.body.content.id;

						request(url)
							.post('/admin/add')
							.send(admin2)
							.end(function (err, res) {

								request(url)
									.post('/admin/login')
									.set('Content-type', 'application/json')
									.send(admin2)
									.end(function (err, res) {

										token2 = res.body.content.token;
										authValue2 = 'Bearer ' + token2;

										request(url)
											.post('/admin/add')
											.send(admin3)
											.end(function (err, res) {

												request(url)
													.post('/admin/login')
													.set('Content-type', 'application/json')
													.send(admin3)
													.end(function (err, res) {

														token3 = res.body.content.token;
														authValue3 = 'Bearer ' + token3;
														done();
													});
											});
									});
							});
					});
			});
	});

	it('1.2.1 should return a success response to indicate app successfully created', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"name": "test-app",
			"keys": [ appKey ]
		};

		var successResponse =  {
			"1": {
				"admin_id": adminEmail,
				"name": "test-app",
				"type": "application",
				"keys": [ appKey ]
			}
		};

		request(url)
			.post('/admin/app/add')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				var objectKey = Object.keys(res.body.content)[0];
				appID = res.body.content.id;
				(res.body.content[objectKey] == successResponse[1]).should.be.ok;
				done();
			});
	});

	it('1.2.2 should return an error response to indicate app was not created because of missing app name', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"keys": ["3406870085495689e34d878f09faf52c"]
		};

		request(url)
			.post('/admin/app/add')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('004');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.2.3 should return a list of applications for the current admin', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"name": "test-app",
			"keys": [ appKey ]
		};

		request(url)
			.post('/admin/app/add')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				request(url)
					.post('/admin/app/add')
					.set('Content-type','application/json')
					.set('Authorization', authValue )
					.send(clientrequest)
					.end(function(err, res) {

						request(url)
							.get('/admin/apps')
							.set('Content-type','application/json')
							.set('Authorization', authValue )
							.send()
							.end(function(err, res) {

								res.statusCode.should.be.equal(200);
								res.body.status.should.be.equal(200);
								(Object.keys(res.body.content).length >= 3).should.be.ok;
								done();
							});
					});
			});
	});

	it('1.2.4 should return a success response for updating an app', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"name": "test-app",
			"keys": [ appKey ]
		};

		request(url)
			.post('/admin/app/add')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				var appID = res.body.content.id;
				var clientrequest2 = {
					patches: [
						{
							op: 'replace',
							path: 'application/'+appID+'/name',
							value: 'New app name'
						}
					]
				};

				request(url)
					.post('/admin/app/update')
					.set('Content-type','application/json')
					.set('Authorization', authValue )
					.set('X-BLGREQ-APPID', appID )
					.send(clientrequest2)
					.end(function(err, res) {

						res.statusCode.should.be.equal(200);
						done();
					});
			});
	});

	it('1.2.5 should return an error response for NOT updating an app because patches is not an array', function(done) {

		this.timeout(100*DELAY);

		var clientrequest2 = {
			patches: {}
		};

		request(url)
			.post('/admin/app/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send(clientrequest2)
			.end(function(err, res) {

				res.body.code.should.be.equal('038');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.2.6 should return an error response for NOT updating an app because patches is an empty array', function(done) {

		this.timeout(100*DELAY);

		var clientrequest2 = {
			patches: []
		};

		request(url)
			.post('/admin/app/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send(clientrequest2)
			.end(function(err, res) {

				res.body.code.should.be.equal('038');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.2.7 should return an error response for NOT updating an app because of missing request body', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/app/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send()
			.end(function(err, res) {

				res.body.code.should.be.equal('005');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.2.8 should return an error response for NOT updating an app because of missing appID', function(done) {

		this.timeout(100*DELAY);

		var clientrequest2 = {
			patches: [
				{
					op: 'replace',
					path: 'application/'+appID + '66' +'/name',
					value: 'New app name'
				}
			]
		};

		request(url)
			.post('/admin/app/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID + '66' )
			.send(clientrequest2)
			.end(function(err, res) {

				res.body.code.should.be.equal('011');
				res.statusCode.should.be.equal(404);
				done();
			});
	});

	it('1.2.9 should return a success response for removing an app', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"name": "test-app",
			"keys": [ appKey ]
		};

		request(url)
			.post('/admin/app/add')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				var appID = res.body.content.id;

				request(url)
					.delete('/admin/app/remove')
					.set('Content-type','application/json')
					.set('Authorization', authValue )
					.send({id: appID})
					.end(function(err, res) {

						res.statusCode.should.be.equal(200);
						res.body.content.should.be.equal('App removed');
						done();
					});
			});
	});

	it('1.2.10 should return an error response for trying to remove an app that does NOT exist', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.delete('/admin/app/remove')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send({id: Math.round(Math.random()*1000000)+1000})
			.end(function(err, res) {

				res.body.code.should.be.equal('011');
				res.statusCode.should.be.equal(404);
				done();
			});
	});

	it('1.2.11 should return an success to indicate an admin has been authorized to an application', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"email": adminEmail2
		};

		request(url)
			.post('/admin/app/authorize')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				if(res)
					res.statusCode.should.be.equal(200);
				done();
			});
	});


	it('1.2.12 should return an error response to indicate admin has NOT been authorized because of missing email from body', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"something": adminEmail2
		};

		request(url)
			.post('/admin/app/authorize')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				if(res)
					res.body.code.should.be.equal('004');
					res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.2.13 should return an error response to indicate admin has NOT been authorized because request body', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/app/authorize')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send()
			.end(function(err, res) {

				if(res)
					res.body.code.should.be.equal('005');
					res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.2.14 should return an error response to indicate admin with email address already authorized for application', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"email": adminEmail2
		};

		setTimeout(function () {
			request(url)
			.post('/admin/app/authorize')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				if(res)
					res.body.code.should.be.equal('017');
					res.statusCode.should.be.equal(409);
				done();
			});
		}, 6*DELAY);
	});

	it('1.2.15 should return an error response to indicate admin has NOT been authenticated because application with that ID doesn\'t exist', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"email": adminEmail2
		};

		request(url)
			.post('/admin/app/authorize')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID + '66')
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				if(res)
					res.body.code.should.be.equal('011');
					res.statusCode.should.be.equal(404);
				done();
			});
	});

	it('1.2.16 should return an success to indicate an admin has been deauthorized to an application', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"email": adminEmail2
		};

		request(url)
			.post('/admin/app/deauthorize')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				if(res)
					res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.2.17 should return an error to indicate an admin has NOT been deauthorized to an application, admin not authorized', function(done) {

		var clientrequest = {
			"email": adminEmail3
		};

		request(url)
			.post('/admin/app/deauthorize')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				if(res){
					res.body.code.should.be.equal('019');
					res.statusCode.should.be.equal(404);
				}
				done();
			});
	});


	it('1.2.18 should return an error response to indicate admin has NOT been deauthorized because of empty request body', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/app/deauthorize')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send()
			.end(function(err, res) {

				if(res)
					res.body.code.should.be.equal('005');
					res.statusCode.should.be.equal(400);
				done();
			});
	});


	it('1.2.19 should return an error response to indicate admin has NOT been deauthorized because of the email field is missing', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"something": adminEmail2
		};

		request(url)
			.post('/admin/app/deauthorize')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				if(res)
					res.body.code.should.be.equal('004');
					res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.2.20 should return an error response to indicate admin has NOT been deauthorized because admin was not found in application', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"email": adminEmail2
		};

		request(url)
			.post('/admin/app/deauthorize')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue2 )
			.send(clientrequest)
			.end(function(err, res) {

				if(res)
					res.body.code.should.be.equal('012');
					res.statusCode.should.be.equal(401);
				done();
			});
	});

	it('1.2.21 should return an error response to indicate admin with email address is the last admin of the application', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"email": adminEmail
		};

		request(url)
			.post('/admin/app/deauthorize')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				if(res)
					res.body.code.should.be.equal('018');
					res.statusCode.should.be.equal(409);
				done();
			});
	});

	it('1.2.22 should return an error response to indicate admin has NOT been deauthenticated because application with that ID doesn\'t exist', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"email": adminEmail2
		};

		request(url)
			.post('/admin/app/deauthorize')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID + '66')
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				if(res)
					res.body.code.should.be.equal('011');
					res.statusCode.should.be.equal(404);
				done();
			});
	});
});

describe('1.3.Context', function() {

	it('1.3.1 should return a success response to indicate context successfully created', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			name: "context",
			meta: {info: "some meta info"}
		};

		request(url)
			.post('/admin/context/add')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send(clientrequest)
			.end(function(err, res) {

				var objectKey = Object.keys(res.body.content)[0];
				contextID = res.body.content.id;
				(res.body.content[objectKey].name == clientrequest.name).should.be.ok;
				res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.3.2 should return an error response to indicate context was NOT successfully created because of empty request body', function(done) {

		request(url)
			.post('/admin/context/add')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send()
			.end(function(err, res) {

				res.body.code.should.be.equal('005');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.3.3 should return the requested context', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"id": contextID
		};

		request(url)
			.post('/admin/context')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send(clientrequest)
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.3.4 should NOT return the requested context, requested context ID is missing', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/context')
			.set('Content-type','application/json')
			.set('Authorization', authValue)
			.set('X-BLGREQ-APPID', appID)
			.send()
			.end(function(err, res) {

				res.body.code.should.be.equal('004');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.3.5 should return an error response to indicate context NOT successfully created because of bad client headers', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			name: "context",
			meta: {info: "some meta info"}
		};

		request(url)
			.post('/admin/context/add')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('010');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.3.6 should return an error response to indicate context NOT successfully created because request body is empty', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/context/add')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.send()
			.end(function(err, res) {

				res.body.code.should.be.equal('010');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.3.7 should return a success response to indicate context was updated', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"id": contextID,
			"patches": [
				{
					"op": "replace",
					"path": "context/"+contextID+"/name",
					"value": "New name"
				}
			]
		};

		request(url)
			.post('/admin/context/update')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID )
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.3.8 should return an error response to indicate context was NOT updated because context was not found', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"id": contextID + '66',
			"patches": [
				{
					"op": "replace",
					"path": "context/"+contextID + '66' +"/name",
					"value": "New name"
				}
			]
		};

		request(url)
			.post('/admin/context/update')
			.set('Content-type','application/json')
			.set('X-BLGREQ-APPID', appID )
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('020');
				res.statusCode.should.be.equal(404);
				done();
			});
	});

	it('1.3.9 should return an error response to indicate context was NOT updated because patches are missing', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"id": Math.round(Math.random()*1000000)+100,
			"name": "new name"
		};

		request(url)
			.post('/admin/context/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('038');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.3.10 should return an error response to indicate context was NOT updated because of missing request body', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/context/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send()
			.end(function(err, res) {

				res.body.code.should.be.equal('005');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.3.11 should return an error response to indicate context was NOT updated because patches is empty', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"id": Math.round(Math.random()*1000000)+100,
			"patches": []
		};

		request(url)
			.post('/admin/context/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('038');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.3.12 should return an error response to indicate context was NOT updated because of missing context id', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"name": "new name",
			"patches": [
				{
					"op": "replace",
					"path": "context/"+contextID+"/name",
					"value": "New name"
				}
			]
		};

		request(url)
			.post('/admin/context/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('004');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.3.13 should return an error response to indicate context was NOT updated by another admin', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"id": contextID,
			"patches": [
				{
					"op": "replace",
					"path": "context/"+contextID+"/name",
					"value": "New name"
				}
			]
		};

		request(url)
			.post('/admin/context/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue2)
			.set('X-BLGREQ-APPID', appID)
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('012');
				res.statusCode.should.be.equal(401);
				done();
			});
	});

	it('1.3.14 should return an error response to indicate context was NOT removed because of invalid context id', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"id": 1
		};

		request(url)
			.delete('/admin/context/remove')
			.set('Content-type','application/json')
			.set('Authorization', authValue)
			.set('X-BLGREQ-APPID', appID)
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('020');
				res.statusCode.should.be.equal(404);
				done();
			});
	});

	it('1.3.15 should return an error indicating the requested context does NOT exist', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"id": Math.round(Math.random()*1000000)+100
		};

		request(url)
			.post('/admin/context')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('020');
				res.statusCode.should.be.equal(404);
				res.body.message.should.be.equal("Context not found");
				done();
			});
	});

	it('1.3.16 should return an error response to indicate context was NOT removed because of missing id from request body', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.delete('/admin/context/remove')
			.set('Content-type','application/json')
			.set('Authorization', authValue)
			.set('X-BLGREQ-APPID', appID)
			.send()
			.end(function(err, res) {

				res.body.code.should.be.equal('004');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.3.17 should return all contexts using the old API', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/contexts')
			.set('Content-type','application/json')
			.set('Authorization', authValue)
			.set('X-BLGREQ-APPID', appID)
			.send({})
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				res.body.content.should.have.length(1);
				done();
			});
	});

	it('1.3.18 should return all contexts using the new API', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/context/all')
			.set('Content-type','application/json')
			.set('Authorization', authValue)
			.set('X-BLGREQ-APPID', appID)
			.send({})
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				res.body.content.should.have.length(1);
				done();
			});
	});

	it('1.3.19 should NOT return all contexts using the old API because of invalid appID', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.get('/admin/contexts')
			.set('Content-type','application/json')
			.set('Authorization', authValue)
			.set('X-BLGREQ-APPID', appID + '66')
			.send()
			.end(function(err, res) {

				res.body.code.should.be.equal('011');
				res.statusCode.should.be.equal(404);
				done();
			});
	});

	it('1.3.20 should return a success response to indicate context was removed', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			id: contextID
		};

		request(url)
			.delete('/admin/context/remove')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID)
			.send(clientrequest)
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				res.body.content.should.be.equal('Context removed');
				done();
			});
	});
});

describe('1.4.Schema', function() {

	it('1.4.1 should return a success response to indicate schema successfully updated', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"appId": appID,
			"schema": {
				"comments": {
					"namespace": "comments",
					"type": "comments",
					"properties": {
						"text": {
							"type": "string"
						}
					},
					"belongsTo": [
						{
							"parentModel": "events",
							"relationType": "hasMany"
						}
					],
					"read_acl": 6,
					"write_acl": 6,
					"meta_read_acl": 6
				},
				"events": {
					"namespace": "events",
					"type": "events",
					"properties": {
						"text": {
							"type": "string"
						},
						"image": {
							"type": "string"
						},
						"options": {
							"type": "object"
						}
					},
					"hasMany": [
						"comments"
					],
					"read_acl": 7,
					"write_acl": 7,
					"meta_read_acl": 4
				},
				"things": {
					"namespace": "events",
					"type": "events",
					"properties": {
						"text": {
							"type": "string"
						},
						"image": {
							"type": "string"
						},
						"options": {
							"type": "object"
						}
					},
					"hasMany": [
						"comments"
					],
					"read_acl": 7,
					"write_acl": 7,
					"meta_read_acl": 4
				}
			}
		};

		request(url)
			.post('/admin/schema/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send(clientrequest)
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.4.2 should return an error response to indicate schema was NOT successfully updated because of appID', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"appId": "1",
			"schema": {
				"comments": {
					"namespace": "comments",
					"type": "comments",
					"properties": {
						"text": {
							"type": "string"
						}
					},
					"belongsTo": [
						{
							"parentModel": "events",
							"relationType": "hasMany"
						}
					],
					"read_acl": 6,
					"write_acl": 6,
					"meta_read_acl": 6
				},
				"events": {
					"namespace": "events",
					"type": "events",
					"properties": {
						"text": {
							"type": "string"
						},
						"image": {
							"type": "string"
						},
						"options": {
							"type": "object"
						}
					},
					"hasMany": [
						"comments"
					],
					"read_acl": 7,
					"write_acl": 7,
					"meta_read_acl": 4,
					"icon": "fa-image"
				}
			}
		};

		request(url)
			.post('/admin/schema/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', Math.round(Math.random()*1000000)+1000 )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('011');
				res.statusCode.should.be.equal(404);
				done();
			});
	});

	it('1.4.3 should return an error response to indicate schema was NOT successfully updated because of missing schema object', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			appId: "1"
		};

		request(url)
			.post('/admin/schema/update')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('004');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.4.4 should return a success response to indicate schema was retrieved successfully using the old API', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.get('/admin/schemas')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send()
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.4.5 should return a success response to indicate schema was retrieved successfully using the new API', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.get('/admin/schema/all')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send()
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.4.6 should return a success response to indicate a model was removed from the application', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			model_name: "things"
		};

		request(url)
			.delete('/admin/schema/remove_model')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send(clientrequest)
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.4.7 should return a error response to indicate a model was NOT removed from the application because of wrong appID', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			model_name: "things"
		};

		request(url)
			.delete('/admin/schema/remove_model')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID + '66' )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('011');
				res.statusCode.should.be.equal(404);
				done();
			});
	});

	it('1.4.8 should return a error response to indicate a model was NOT removed from the application because model name does NOT exist', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			model_name: "others"
		};

		request(url)
			.delete('/admin/schema/remove_model')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('022');
				res.statusCode.should.be.equal(404);
				done();
			});
	});

	it('1.4.9 should return a error response to indicate a model was NOT removed from the application because model was missing from the request', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			something: "others"
		};

		request(url)
			.delete('/admin/schema/remove_model')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID)
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('004');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.4.10 should return a error response to indicate a model was NOT removed from the application because of bad route', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			something: "others"
		};

		request(url)
			.delete('/admin/schema/remove_mode')
			.set('Content-type','application/json')
			.set('Authorization', authValue )
			.set('X-BLGREQ-APPID', appID)
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('003');
				res.statusCode.should.be.equal(404);
				done();
			});
	});
});

describe('1.5.User', function() {

	var clientrequest = {
		username: userEmail,
		password: "secure_password1337",
		name: "John Smith"
	};

	before(function(done){

		this.timeout(100*DELAY);
		request(url)
			.post('/user/register-username')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256 )
			.set('X-BLGREQ-APPID', appID )
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
			.send(clientrequest)
			.end(function(err, res) {
				setTimeout(done, 20*DELAY);
			});
	});

	it('1.5.1 should return a success response to indicate that an user name was updated', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/user/login_password')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256 )
			.set('X-BLGREQ-APPID', appID )
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
			.send(clientrequest)
			.end(function(err, res) {

				userId = res.body.content.user.id;

				var clientrequest = {
					patches: [
						{
							op: "replace",
							path: "user/"+userId+"/name",
							value: "new value"
						}
					]
				};

				request(url)
					.post('/admin/user/update')
					.set('Content-type','application/json')
					.set('X-BLGREQ-SIGN', appIDsha256)
					.set('X-BLGREQ-APPID', appID)
					.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
					.set('Authorization', authValue)
					.send(clientrequest)
					.end(function(err, res) {

						res.statusCode.should.be.equal(200);
						done();
					});
			});
	});

	it('1.5.2 should return a success response to indicate that an user password was updated', function(done) {
		this.timeout(100*DELAY);

		var clientrequest = {
			"patches": [
				{
					"op": "replace",
					"path": "user/"+userId+"/password",
					"value": "new value"
				}
			]
		};

		request(url)
			.post('/admin/user/update')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue)
			.send(clientrequest)
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.5.3 should return an error response to indicate that an user was NOT updated, user was missing from the request', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/user/update')
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

	it('1.5.5 should return an error response to indicate that an user was NOT updated because patches is empty', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			"patches": []
		};

		request(url)
			.post('/admin/user/update')
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

	it('1.5.6 should return a success response indicating that a user has been deleted', function(done) {

		this.timeout(100*DELAY);
		var clientrequest = {
			email: userEmail2,
			password: 'pass',
			username: userEmail2
		}

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
							userID = res.body.content.user.id;
							
							var subclientrequest = {
								id : userID,
								username : userEmail2
							};

							request(url)
								.delete('/admin/user/delete')
								.set('X-BLGREQ-SIGN', appIDsha256)
								.set('X-BLGREQ-APPID',appID)
								.set('Authorization', authValue)
								.send(subclientrequest)
								.end(function(err, res) {
									res.statusCode.should.be.equal(202);
									done();
								});
						});
				},20 * DELAY);
		});
	});

	it('1.5.8 should return a error response indicating that a user has NOT been deleted because of missing username', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			password: "secure_password1337",
			name: "John Smith"
		};

		request(url)
			.delete('/admin/user/delete')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256 )
			.set('X-BLGREQ-APPID', appID )
			.set('Authorization', authValue )
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('004');
				res.statusCode.should.be.equal(400);
				done();
			});
	});

	it('1.5.9 should return an error response indicating that a user has NOT been deleted because of appID not found', function(done) {

		this.timeout(100*DELAY);

		var userEmail = "user3@example.com";
		var clientrequest = {
			username: userEmail,
			password: "secure_password1337",
			name: "John Smith"
		};

		request(url)
			.delete('/admin/user/delete')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256 )
			.set('X-BLGREQ-APPID', Math.round(Math.random()*1000000)+1000 )
			.set('Authorization', authValue )
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('011');
				res.statusCode.should.be.equal(404);
				done();
			});
	});

	it('1.5.10 should return an error response to indicate that an user was NOT found when trying to update', function(done) {

		this.timeout(100*DELAY);

		var clientrequest = {
			username : "wrong@example.com",
			patches: [
				{
					op: "replace",
					path: "user/"+userEmail+"/name",
					value: "new value"
				}
			]
		};

		request(url)
			.post('/admin/user/update')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256 )
			.set('X-BLGREQ-APPID', appID )
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {

				res.body.code.should.be.equal('023');
				res.statusCode.should.be.equal(404);
				done();
			});
	});

	it('1.5.12 should return a success response to indicate that an admin list was retrieved', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/users')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send()
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.5.13 should return a success response to indicate that an admin list was retrieved with pagination', function(done) {

		this.timeout(100*DELAY);

		var clientRequest = {
			offset: 10,
			limit: 10
		};

		request(url)
			.post('/admin/users')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send(clientRequest)
			.end(function(err, res) {

				res.statusCode.should.be.equal(200);
				done();
			});
	});

	it('1.5.14 should return an error response to indicate that an admin list was NOT retrieved for a bad app id', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/users')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-APPID', Math.round(Math.random()*1000000)+1000)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send()
			.end(function(err, res) {

				if(res) {
					res.body.code.should.be.equal('011');
					res.statusCode.should.be.equal(404);
				}

				done();
			});
	});

	it('1.5.15 should return a success response to indicate that an users list was retrieved', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/user/all')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send()
			.end(function(err, res) {

				if(res) {
					res.body.content.should.not.be.empty;
					res.statusCode.should.be.equal(200);
				}
				done();
			});
	});

	it('1.5.16 should return a success response to indicate that an users list was retrieved with pagination', function(done) {

		this.timeout(100*DELAY);

		var clientRequest = {
			page: 2
		};

		request(url)
			.post('/admin/user/all')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-APPID', appID)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send(clientRequest)
			.end(function(err, res) {

				if(res) {
					res.body.content.should.not.be.empty;
					res.statusCode.should.be.equal(200);
				}
				done();
			});
	});

	it('1.5.17 should return an error response to indicate that an users list was NOT retrieved for a bad app id', function(done) {

		this.timeout(100*DELAY);

		request(url)
			.post('/admin/user/all')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-APPID', Math.round(Math.random()*1000000)+1000)
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
			.set('Authorization', authValue )
			.send()
			.end(function(err, res) {

				if(res) {
					res.body.code.should.be.equal('011');
					res.statusCode.should.be.equal(404);
				}
				done();
			});
	});
});
