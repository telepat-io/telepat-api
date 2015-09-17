var should = require('should');
var assert = require('assert');
var request = require('supertest');
var crypto = require('crypto-js');

describe('Api', function () {
	var url = 'http://localhost:3000';
	var adminEmail = 'admin@example.com';
	var adminEmail2 = 'admin2@example.com';
	var adminPassword = '5f4dcc3b5aa765d61d8327deb882cf99';
	var deviceIdentification;
	var APPKey = "3406870085495689e34d878f09faf52c";
	var appIDsha256 = crypto.SHA256(APPKey).toString(crypto.enc.Hex);
	var DELAY = 1500;
	var appID;
	var contextID;
	var authValue;
	var server;
	
	function normalizePort(val) {
	  var port = parseInt(val, 10);
	  if (isNaN(port)) {
	    return val;
	  }
	  if (port >= 0) {
	    return port;
	  }
	  return false;
	}
	
   before(function (done) {
   	this.timeout(10000);
		app = require('../app',done);
		var http = require('http');
		var port = normalizePort(process.env.PORT || '3000');
		app.set('port', port);
		server = http.createServer(app);
		server.listen(port);
		server.on('listening', function() {
			setTimeout(done, 5000);
		});
   });
  
  after(function (done) {
	 server.close(done);
  });

 	// before(function(done){
	// // GET deviceIdentification for future requests
		// var appIDsha256 =  '2a80f1666442062debc4fbc0055d8ba5efc29232a27868c0a8eb76dec23df794';

		// var clientrequest = {
			// "info": {
				// "os": "Android",
				// "version": "4.4.3",
				// "sdk_level": 19,
				// "manufacturer": "HTC",
				// "model": "HTC One_M8",
				// "udid": ''
			// },
			// "persistent": {
			// "type": "android",
			// "token": "android pn token"
			// }
		// }
		// request(url)
		// .post('/device/register')
		// .set('X-BLGREQ-SIGN', appIDsha256)
		// .set('X-BLGREQ-UDID', '')
		// .set('X-BLGREQ-APPID',1)
		// .send(clientrequest)
		// .end(function(err, res) {
			// // TO DO
			// deviceIdentification = res.body.content.identifier;
			// done();
		// });
	// });
 
	describe('Admin',function(){	

		var admin = {
			email: adminEmail,
			password: adminPassword
		};
				
		describe('Admin', function() {

			it('should return a 200 code to indicate succes when creating a new admin', function(done) {

				// once we have specified the info we want to send to the server via POST verb,
				// we need to actually perform the action on the resource, in this case we want to 
				// POST on /api/profiles and we want to send some info
				// We do this using the request object, requiring supertest!
				request(url)
				.post('/admin/add')
				.send(admin)
				// end handles the response
				.end(function(err, res) {
					if (err) {
						throw err;
						done(err);
					}
					setTimeout(function() {
						// this is should.js syntax, very clear
						res.statusCode.should.be.equal(200);
						done();
					}, DELAY);

				});
			});
		
			it('should return a 409 code to indicate failure when admin already exists', function(done) {
				var admin = {
					email: adminEmail,
					password: adminPassword
				};
				request(url)
				.post('/admin/add')
				.send(admin)
				.end(function(err, res) {
					res.statusCode.should.be.equal(409);
					done();
				});
			});
			
			it('should return a 4xx code to indicate failure when admin email is missing', function(done) {

				var admin = {
					password: adminPassword
				};
				request(url)
				.post('/admin/add')
				.send(admin)
				.end(function(err, res) {
				   res.statusCode.should.be.within(400,499);
				   done();
				});
			});
			
			it('should return a 4xx code to indicate failure when admin email is empty', function(done) {
				
				var admin = {
					email: "",
					password: adminPassword
				};
				request(url)
				.post('/admin/add')
				.send(admin)
				.end(function(err, res) {
					res.statusCode.should.be.within(400,499);
					done();
				});
			});
			
			it('should return a 4xx code to indicate failure when admin password is empty', function(done) {

				var admin = {
					email: adminEmail,
					password: ""
				};
				request(url)
				.post('/admin/add')
				.send(admin)
				.end(function(err, res) {
					res.statusCode.should.be.within(400,499);
					done();
				});
			});
			
			it('should return a 4xx code to indicate failure when admin password is missing', function(done) {

				var admin = {
					email: adminEmail
				};
				request(url)
				.post('/admin/add')
				.send(admin)
				.end(function(err, res) {
					res.statusCode.should.be.within(400,499);
					done();
				});
			});
			
			it('should return an error for logging in with wrong user or password', function(done) {
				
				var randEmail = 'admin'+Math.round(Math.random()*1000000)+'@example.com';
				var admin = {
					email: randEmail,
					password: "5f4dcc3b5aa765d61d8327deb882cf99"
				};
				request(url)
				.post('/admin/login')
				.send(admin)
				.end(function(err, res) {
					res.statusCode.should.be.equal(401);
					res.body.message.should.be.equal('Wrong user or password');
					done();
				});
			});

			it('should return a valid authorization token', function(done) {
				
				request(url)
				.post('/admin/login')
				.send(admin)
				.end(function(err, res) {
					authValue = 'Bearer ' + res.body.content.token;
					var tokenarray = res.body.content.token.split(".");
					should(tokenarray[0]+'.'+tokenarray[1] == 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImVtYWlseUBleGFtcGxlLmNvbSIsImlzQWRtaW4iOnRydWUsImlhdCI6MTQzODYwMTcxMSwiZXhwIjoxNDM4NjA1MzxfQ').be.ok;
					done();
				});
			});
			
			it('should return information about the logged admin', function(done) {
				
				request(url)
				.get('/admin/me')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.send()
				.end(function(err, res) {
					res.statusCode.should.be.equal(200);
					res.body.content.email.should.be.equal(admin.email);
					res.body.content.isAdmin.should.be.equal(true);
					done();
				}); 
			});
			
			it('should return a succes response indicating the admin account has been updated', function(done) {
				var randEmail = 'admin'+Math.round(Math.random()*1000000)+'@example.com';
				var admin = {
					email: randEmail,
					password: "5f4dcc3b5aa765d61d8327deb882cf99"
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
							authValue = 'Bearer ' + res.body.content.token;
							request(url)
							.post('/admin/update')
							.set('Content-type','application/json')
							.set('Authorization', authValue )
							.send(admin)
							.end(function(err, res) {
								res.statusCode.should.be.equal(200);
								done();
							});
						});
					}, 1000);
				});  
			});
			
			it('should return a succes response indicating the admin account has been deleted', function(done) {
				var randEmail = 'admin'+Math.round(Math.random()*1000000)+'@example.com';
				var admin = {
					email: randEmail,
					password: "5f4dcc3b5aa765d61d8327deb882cf99"
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
							authValue = 'Bearer ' + res.body.content.token;
								//	console.log(authValue);
							request(url)
							.delete('/admin/delete')
							.set('Content-type','application/json')
							.set('Authorization', authValue )
							.send(admin)
							.end(function(err, res) {
								//console.log(res);
								res.statusCode.should.be.equal(200);
								done();
							});
						});
					}, 1000);
				});  
			});
			
			it('should return an error response indicating the admin account has NOT been updated because of missing request body', function(done) {
	
				request(url)
				.post('/admin/update')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.send()
				.end(function(err, res) {
					res.statusCode.should.be.equal(400);
					done();
				});
				
			});

		});
		
		describe('App', function() {
			// var token;
			// var authValue;
			// var admin = {
				// email: randEmail,
				// password: "5f4dcc3b5aa765d61d8327deb882cf99"
			// };
			
			// before(function(done){
				// request(url)
				// .post('/admin/add')
				// .set('Content-type','application/json')
				// .send(admin)
				// .end(function(err, res) {
					// setTimeout(function () {
						// request(url)
						// .post('/admin/login')
						// .set('Content-type','application/json')
						// .send(admin)
						// .end(function(err, res) {
							// token = res.body.content.token;
							// authValue  = 'Bearer ' + token;
							// done();
						// });
					// }, 1000);
				// });
			// });
			
			it('should return a success response to indicate app succesfully created', function(done) {
				var clientrequest = {
					"name": "test-app",
					"keys": [ APPKey ]
				};
				var successResponse =  {
					"1": {
						 "admin_id": adminEmail,
						 "name": "test-app",
						 "type": "application",
						 "keys": [ APPKey ]
					}
				}
				request(url)
				.post('/admin/app/add')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.send(clientrequest)
				.end(function(err, res) {
					var objectKey = Object.keys(res.body.content)[0];
					appID = res.body.content.id;
					appIDsha256 = crypto.SHA256(APPKey).toString(crypto.enc.Hex);
					(res.body.content[objectKey] == successResponse[1]).should.be.ok;
					done();
				});
			});
			
			it('should return an error response to indicate app was not created because of missing app name', function(done) {
				var clientrequest = {
					"keys": ["3406870085495689e34d878f09faf52c"]
				};
				request(url)
				.post('/admin/app/add')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(400);
					done();
				});
			});
			
			it('should return a list of applications for the current admin', function(done) {			
				var clientrequest = {
					"name": "test-app",
					"keys": [ APPKey ]
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
						setTimeout(function () {
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
						}, 1000);
					});
				});
			});
			
			it('should return a success response for updating an app', function(done) {
				var clientrequest = {
					"name": "test-app",
					"keys": [ APPKey ]
				};
				var clientrequest2 = {
					"name": "test-app-2",
				};
				request(url)
				.post('/admin/app/add')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.send(clientrequest)
				.end(function(err, res) {
					var objectKey = Object.keys(res.body.content)[0];
					var appID = res.body.content.id;
					setTimeout(function () {
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
					}, 2*DELAY);
				});
			});

			
			it('should return a success response for removing an app', function(done) {
				var clientrequest = {
					"name": "test-app",
					"keys": [ APPKey ]
				};
				request(url)
				.post('/admin/app/add')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.send(clientrequest)
				.end(function(err, res) {
					var objectKey = Object.keys(res.body.content)[0];
					var appID = res.body.content.id;
					setTimeout(function() {
						request(url)
						.post('/admin/app/remove')
						.set('Content-type','application/json')
						.set('Authorization', authValue )
						.set('X-BLGREQ-APPID', appID )
						.send()
						.end(function(err, res) {
							res.statusCode.should.be.equal(200);
							res.body.content.should.be.equal('App removed');
							done();	
						});
					}, 2*DELAY);
				});
			});
			
			it('should return an error response for trying to remove an app that does NOT exist', function(done) {
				request(url)
				.post('/admin/app/remove')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.set('X-BLGREQ-APPID', Math.round(Math.random()*1000000)+1000 )
				.send()
				.end(function(err, res) {
					res.statusCode.should.be.equal(404);
					done();	
				});
			});
			
		});
		
		describe('Context', function() {
			
			/////////////////////////////////////////////////////////////
		//	var token;
			var token2;

			var admin2 = {
				email: "emaily4353465572@example.com",
				password: "5f4dcc3b5aa765d61d8327deb882cf99"
			};
		//	var authValue;
			var authValue2;
			var deletedcontextID;

			/////////////////////////////////////////////////////////////
			
			before(function(done){
				this.timeout(10000);
			
							var clientrequest = {
								"name": "test-app",
								"keys": [ APPKey ]
							};
							request(url)
							.post('/admin/app/add')
							.set('Content-type','application/json')
							.set('Authorization', authValue)
							.send(clientrequest)
							.end(function(err, res) {
								//console.log(res.body);
								appID =  res.body.content.id;
								request(url)
								.post('/admin/add')
								.send(admin2)
								.end(function(err, res) {
									setTimeout(function () {
										request(url)
										.post('/admin/login')
										.set('Content-type','application/json')
										.send(admin2)
										.end(function(err, res) {
											token2 = res.body.content.token;
											authValue2 = 'Bearer ' + token2;
											done();
										});
									}, 1000);
								});
							});
				});

			/////////////////////////////////////////////////////////////
			
			it('should return a success response to indicate context succesfully created', function(done) {
				var clientrequest = {
					"name": "context",
					"meta": {"info": "some meta info"},
				}
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
			
			it('should return the requested context', function(done) {
				var clientrequest = {
					"id": contextID
				}
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
			
			it('should NOT return the requested context, requested context ID is missing', function(done) {
				var clientrequest = {
				}
				request(url)
				.post('/admin/context')
				.set('Content-type','application/json')
				.set('Authorization', authValue)
				.set('X-BLGREQ-APPID', appID)
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(200);
					done();
				});
			});
			
			it('should return an error response to indicate context NOT succesfully created because of bad client headers', function(done) {
				var clientrequest = {
					"name": "context",
					"meta": {"info": "some meta info"},
				}
				request(url)
				.post('/admin/context/add')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(400);
					res.body.message.should.be.equal("Requested App ID not found.");
					done();
				});
			});
			
			it('should return an error response to indicate context NOT succesfully created because request body is empty', function(done) {
				var clientrequest = {
				}
				request(url)
				.post('/admin/context/add')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(400);
					done();
				});
			});
			
			it('should return a success response to indicate context was updated', function(done) {
				var clientrequest = {
					"id": contextID,
					"name": "new name"
				}
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
			
			it('should return an error response to indicate context was NOT updated because context does not exist', function(done) {
				var clientrequest = {
					"id": Math.round(Math.random()*1000000)+100,
					"name": "new name"
				}
				request(url)
				.post('/admin/context/update')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.set('X-BLGREQ-APPID', appID )
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(404);
					done();
				});
			});
			
			it('should return an error response to indicate context was NOT updated because of missing context id', function(done) {
				var clientrequest = {
					"name": "new name"
				}
				request(url)
				.post('/admin/context/update')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.set('X-BLGREQ-APPID', appID )
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(400);
					done();
				});
			});
			
			it('should return an error response to indicate context was NOT updated by another admin', function(done) {
				var clientrequest = {
					"id": contextID,
					"name": "new name"
				}
				request(url)
				.post('/admin/context/update')
				.set('Content-type','application/json')
				.set('Authorization', authValue2 )
				.set('X-BLGREQ-APPID', appID )
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(403);
					done();
				});
			});
			
			// before(function(done){
			// 	var clientrequest = {
			// 		"name": "Episode 2",
			// 		"meta": {"info": "some meta info"},
			// 	}
				
			// 	request(url)
			// 	.post('/admin/app/add')
			// 	.set('Content-type','application/json')
			// 	.set('Authorization', authValue )
			// 	.send(clientrequest)
			// 	.end(function(err, res) {
			// 		//console.log(err);
			// 		appID = res.body.content.id;

			// 		request(url)
			// 		.post('/admin/context/add')
			// 		.set('Content-type','application/json')
			// 		.set('Authorization', authValue )
			// 		.set('X-BLGREQ-APPID', appID )
			// 		.send(clientrequest)
			// 		.end(function(err, res) {
			// 			var objectKey = Object.keys(res.body.content)[0];
			// 			deletedcontextID = res.body.content.id;
			// 			//console.log(deletedcontextID);
			// 			done();
			// 		});
			// 	});
			// });
			
			it('should return a success response to indicate context was removed', function(done) {
				var clientrequest = {
					"id": deletedcontextID
				}
				request(url)
				.post('/admin/context/remove')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.set('X-BLGREQ-APPID', '1' )
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(200);
					res.body.content.should.be.equal('Context removed');
					done();
				});
			});
			
			it('should return an error response to indicate context was NOT removed', function(done) {
				var clientrequest = {
					"id": deletedcontextID
				}
				request(url)
				.post('/admin/context/remove')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.set('X-BLGREQ-APPID', '1' )
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(404);
					res.body.message.should.be.equal("Context does not exist");
					done();
				});
			});
			
			it('should return an error indicating the requested context does NOT exist', function(done) {
				var clientrequest = {
					"id": Math.round(Math.random()*1000000)+100
				}
				request(url)
				.post('/admin/context')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.set('X-BLGREQ-APPID', '1' )
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(404);
					res.body.message.should.be.equal("Context not found");
					done();
				});
			});
			
			it('should return all contexts', function(done) {
				request(url)
				.post('/admin/contexts')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.set('X-BLGREQ-APPID', '1' )
				.send()
				.end(function(err, res) {
					res.statusCode.should.be.equal(200);
					//res.body.content.length.should.be.atleast(1);
					done();
				});
			});
		});
		
		describe('Schema', function() {
			var token;
			var admin = {
				email: "emaily435346557@example.com",
				password: "5f4dcc3b5aa765d61d8327deb882cf99"
			};

			before(function(done){
				request(url)
				.post('/admin/add')
				.set('Content-type','application/json')
				.send(admin)
				.end(function(err, res) {
					setTimeout(function () {
						request(url)
						.post('/admin/login')
						.set('Content-type','application/json')
						.send(admin)
						.end(function(err, res) {
							//console.log(res);
							token = res.body.content.token;
							authValue = 'Bearer ' + token;
							done();
						});
					}, DELAY);
				});
			});
			
			it('should return a success response to indicate schema succesfully updated', function(done) {
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
			
			it('should return an error response to indicate schema was NOT succesfully updated because of appID', function(done) {
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
					res.statusCode.should.be.equal(404);
					done();
				});
			});
			
			it('should return an error response to indicate schema was NOT succesfully updated because of missing schema object', function(done) {
				var clientrequest = {
				  "appId": "1"
				};
				request(url)
				.post('/admin/schema/update')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.set('X-BLGREQ-APPID', appID )
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(400);
					done();
				});
			});
			
			it('should return a success response to indicate schema was retrived succesfully', function(done) {
				request(url)
				.post('/admin/schemas')
				.set('Content-type','application/json')
				.set('Authorization', authValue )
				.set('X-BLGREQ-APPID', appID )
				.send()
				.end(function(err, res) {
					res.statusCode.should.be.equal(200);
					done();
				});
			});
		});
		
		describe('User', function() {
			var appIDsha256 =  '2a80f1666442062debc4fbc0055d8ba5efc29232a27868c0a8eb76dec23df794';
			var userEmail = "user@example.com";
			var clientrequest = {
				"email": userEmail,
				"password": "secure_password1337",
				"name": "John Smith"
			};

			
			before(function(done){
				request(url)
				.post('/user/register')
				.set('Content-type','application/json')
				.set('X-BLGREQ-SIGN', appIDsha256 )
				.set('X-BLGREQ-APPID', appID )
				.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
				.send(clientrequest)
				.end(function(err, res) {
					setTimeout(done, DELAY);
				});
			});
			
			it('should return a 404 response to indicate an invalid client request using an invalid X-BLGREQ-UDID header', function(done) {
				var clientrequest = {
					"user": {
						"email": userEmail,
						"name": "New Name"
					}
				};
				request(url)
				.post('/admin/user/update')
				.set('Content-type','application/json')
				.set('X-BLGREQ-SIGN', appIDsha256 )
				.set('X-BLGREQ-APPID', appID )
				.set('X-BLGREQ-UDID', Math.round(Math.random()*1000000)+1000 )
				.set('Authorization', authValue )
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(404);
					done();
				});
			});
			
			it('should return a success response to indicate that an user was updated', function(done) {
				var clientrequest = {
					"user": {
						"email": userEmail,
						"password": "secure_password1337",
						"name": "New Name"
					}
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
			
			it('should return a success response to indicate that an user was NOT updated, user was missing from the request', function(done) {
				var clientrequest = {
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
					res.statusCode.should.be.equal(400);
					done();
				});
			});
			
			it('should return a success response to indicate that an user was NOT updated, user email address was missing from the request', function(done) {
				var clientrequest = {
					"user": {
						"name": "New Name"
					}
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
					res.statusCode.should.be.equal(400);
					done();
				});
			});
				
			it('should return a success response indicating that a user has been deleted', function(done) {
				this.timeout(25000);
	
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
						.post('/admin/user/delete')
						.set('Content-type','application/json')
						.set('X-BLGREQ-SIGN', appIDsha256 )
						.set('X-BLGREQ-APPID', appID )
						.set('Authorization', authValue )
						.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
						.send(clientrequest)
						.end(function(err, res) {
							res.statusCode.should.be.equal(202);
							done();
						});
					}, DELAY);
				});

			});	
			
			// it('should return a success response indicating that a user has NOT been deleted, user does not belong to application', function(done) {
			// 	this.timeout(25000);
			// 	var userEmail = "user3@example.com";
			// 	var clientrequest = {
			// 		"email": userEmail,
			// 		"password": "secure_password1337",
			// 		"name": "John Smith"
			// 	};
			// 	request(url)
			// 	.post('/user/register')
			// 	.set('Content-type','application/json')
			// 	.set('X-BLGREQ-SIGN', appIDsha256 )
			// 	.set('X-BLGREQ-APPID', appID )
			// 	.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
			// 	.send(clientrequest)
			// 	.end(function(err, res) {
			// 		var userEmail = "user2@example.com";
			// 		var clientrequest = {
			// 			"email": userEmail,
			// 			"password": "secure_password1337",
			// 			"name": "John Smith"
			// 		};
			// 		setTimeout(function() {
			// 			request(url)
			// 			.post('/admin/user/delete')
			// 			.set('Content-type','application/json')
			// 			.set('X-BLGREQ-SIGN', appIDsha256 )
			// 			.set('X-BLGREQ-APPID', appID )
			// 			.set('Authorization', authValue )
			// 			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
			// 			.send(clientrequest)
			// 			.end(function(err, res) {
			// 				res.statusCode.should.be.equal(500);
			// 				done();
			// 			});
			// 		}, DELAY);
			// 	});
			// });	
			
			it('should return a success response indicating that a user has NOT been deleted because of missing email address', function(done) {
				var clientrequest = {
					"password": "secure_password1337",
					"name": "John Smith"
				};
				request(url)
				.post('/admin/user/delete')
				.set('Content-type','application/json')
				.set('X-BLGREQ-SIGN', appIDsha256 )
				.set('X-BLGREQ-APPID', appID )
				.set('Authorization', authValue )
				.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(400);
					done();
				});
			});	
		
			it('should return an error response indicating that a user has NOT been deleted because of appID not found', function(done) {
				this.timeout(25000);
				var userEmail = "user3@example.com";
				var clientrequest = {
					"email": userEmail,
					"password": "secure_password1337",
					"name": "John Smith"
				};
				request(url)
				.post('/admin/user/delete')
				.set('Content-type','application/json')
				.set('X-BLGREQ-SIGN', appIDsha256 )
				.set('X-BLGREQ-APPID', 	 Math.round(Math.random()*1000000)+1000 )
				.set('Authorization', authValue )
				.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
				.send(clientrequest)
				.end(function(err, res) {
					res.statusCode.should.be.equal(404);
					done();
				});
			});	
			
			it('should return an success response to indicate that an user was NOT updated', function(done) {

				var clientrequest = {
					"user": {
						"email": "wrongexample@appscend.com",
						"name": "New Name"
					}
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
				//	console.log(authValue);
				//	console.log(res.body);
					res.statusCode.should.be.equal(404);
					res.body.message.should.be.equal("User not found");
					done();
				});
			});
			
			
		
			it('should return an error response to indicate that an user was NOT found when trying to update', function(done) {
				var clientrequest = {
					"user": {
						"email": "user4@example.com",
						"name": "New Name"
					}
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
					res.statusCode.should.be.equal(404);
					res.body.message.should.be.equal("User not found");
					done();
				});
			});
			
			it('should return a success response to indicate that a users list was retrived', function(done) {
				request(url)
				.get('/admin/users')
				.set('Content-type','application/json')
				.set('X-BLGREQ-SIGN', appIDsha256)
				.set('X-BLGREQ-APPID', appID)
				.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
				.set('Authorization', authValue )
				.send()
				.end(function(err, res) {
					if(res) {
						res.statusCode.should.be.equal(200);
					}
					done();
				});
			});
			
			it('should return an error response to indicate that a users list was NOT retrived for a bad app id', function(done) {
				request(url)
				.get('/admin/users')
				.set('Content-type','application/json')
				.set('X-BLGREQ-SIGN', appIDsha256)
				.set('X-BLGREQ-APPID', Math.round(Math.random()*1000000)+1000)
				.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28')
				.set('Authorization', authValue )
				.send()
				.end(function(err, res) {
					if(res)
						res.statusCode.should.be.equal(404);
					done();
				});
			});
		});
	});
	
	describe('Context',function(){
		
			var token;
			var clientrequest = {
				"email": "example@appscend.com",
				"password": "secure_password1337",
				"name": "John Smith"
			};
			var authValue;

			before(function(done){
				request(url)
				.post('/user/register')
				.set('Content-type','application/json')
				.set('X-BLGREQ-SIGN', appIDsha256 )
				.set('X-BLGREQ-APPID', appID )
				.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
				.send(clientrequest)
				.end(function(err, res) {
				//console.log("appID= " + appID);
					setTimeout(function() {
						request(url)
						.post('/user/login_password')
						.set('Content-type','application/json')
						.set('X-BLGREQ-SIGN', appIDsha256 )
						.set('X-BLGREQ-APPID', appID )
						.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
						.send(clientrequest)
						.end(function(err, res) {
						//	console.log(res);
							token = res.body.content.token;
							authValue = 'Bearer ' + token;
							done();
						});
					}, DELAY);
				});
			});
			
		it('should return a success response to indicate context succesfully retrived', function(done) {
			var clientrequest = {
				"id": contextID
			}
			request(url)
			.post('/context')
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
		
		it('should return an error response to indicate context wa NOT succesfully retrived because of missing context ID', function(done) {
			var clientrequest = {}
			request(url)
			.post('/context')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256 )
			.set('X-BLGREQ-APPID', appID )
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(400);
				done();
			});
		});
		
		it('should return an error response to indicate context NOT succesfully retrived', function(done) {
			var clientrequest = {
				"id": Math.round(Math.random()*1000000)+1000
			}
			request(url)
			.post('/context')
			.set('X-BLGREQ-SIGN', appIDsha256 )
			.set('X-BLGREQ-APPID', appID )
			.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(404);
				done();
			});
		});
		
		it('should return a success response to indicate all contexts succesfully retrived', function(done) {
			request(url)
			.get('/context/all')
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
	});
	
	describe('Device',function(){
		var invalidUDID = 'invalid';
		var appIDsha256 =  '2a80f1666442062debc4fbc0055d8ba5efc29232a27868c0a8eb76dec23df794';
		it('should return a success response to indicate device succesfully registred', function(done) {
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
			.set('X-BLGREQ-APPID', appID)
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(200);
				res.body.content.identifier;
				done();
			});
		});
		
		it('should return a success response to indicate device succesfully registred with random udid', function(done) {
			var clientrequest = {
				"info": {
					"os": "Android",
					"version": "4.4.3",
					"sdk_level": 19,
					"manufacturer": "HTC",
					"model": "HTC One_M8",
					"udid": Math.round(Math.random()*1000000)+1000
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
			.set('X-BLGREQ-APPID',1)
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(200);
				res.body.content.identifier;
				done();
			});
		});
		
		it('should return an error response to indicate device succesfully registred, uuid missing from request', function(done) {
			var clientrequest = {
				"info": {
					"os": "Android",
					"version": "4.4.3",
					"sdk_level": 19,
					"manufacturer": "HTC",
					"model": "HTC One_M8",
				
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
			.set('X-BLGREQ-APPID',1)
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(200);
				done();
			});
		});
		
		
		it('should return an error response to indicate device NOT succesfully registred because of missing info', function(done) {
			var clientrequest = {
				"persistent": {
				"type": "android",
				"token": "android pn token"
				}
			}
			request(url)
			.post('/device/register')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', '')
			.set('X-BLGREQ-APPID',1)
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(400);
				done();
			});
		});
		
		it('should return an error response to indicate device NOT succesfully registred because of missing body', function(done) {
			var clientrequest = {}
			request(url)
			.post('/device/register')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', '')
			.set('X-BLGREQ-APPID',1)
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(400);
				done();
			});
		});
		
		
		it('should return an error response to indicate device NOT succesfully registred because of invalid UDID', function(done) {
			var clientrequest = {
				"info": {
					"os": "Android",
					"version": "4.4.3",
					"sdk_level": 19,
					"manufacturer": "HTC",
					"model": "HTC One_M8",
				
				},
				"persistent": {
				"type": "android",
				"token": "android pn token"
				}
			}
			request(url)
			.post('/device/register')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', invalidUDID)
			.set('X-BLGREQ-APPID',1)
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(500);
				done();
			});
		});
		
	});
	
	describe('Object',function(){
		
		var deviceIdentification;
		var invalidUDID = 'invalid';
		var appIDsha256 =  '2a80f1666442062debc4fbc0055d8ba5efc29232a27868c0a8eb76dec23df794';
		var token;
		var authValue;
		
		var subclientrequest = {
			"channel": {
				"id": 1,
				"context": 1,
				"model": "comments",
				"parent": {
					"id": 1,
					"model": "events"
				},
				"user": 2
			},
			"filters": {
				"or": [
					{
						"and": [
							{
							  "is": {
								"gender": "male",
								"age": 23
							  }
							},
							{
							  "range": {
								"experience": {
								  "gte": 1,
								  "lte": 6
								}
							  }
							}
						  ]
						},
						{
						  "and": [
							{
							  "like": {
								"image_url": "png",
								"website": "png"
							  }
							}
						  ]
						}
					  ]
			}
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
			request(url)
			.post('/device/register')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', '')
			.set('X-BLGREQ-APPID',appID)
			.send(clientrequest)
			.end(function(err, res) {
				deviceIdentification =  res.body.content.identifier;	
				var clientrequest = {
					"email": "user5@example.com",
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
					setTimeout(function () {
						request(url)
						.post('/user/login_password')
						.set('Content-type','application/json')
						.set('X-BLGREQ-SIGN', appIDsha256 )
						.set('X-BLGREQ-APPID', appID )
						.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
						.send(clientrequest)
						.end(function(err, res) {
							token = res.body.content.token;
							authValue = 'Bearer ' + token;
							done();
						});
					}, DELAY);
				});
			});
		});

		it('should return an error (400) response to indicate that the client made a bad request', function(done) {
			var clientrequest = {};
			request(url)
			.post('/object/create')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', '')
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(400);
				done();
			});
		});
		
		it('should return an error (401) response to indicate that only authenticated users may access this endpoint', function(done) {
			
			var clientrequest = {
				"model": "something",
				"context": 1,
				"content": {
				}
			}
			request(url)
			.post('/object/create')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', '')
			.set('X-BLGREQ-APPID',appID)
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(401);
				done();
			});
		});
		
		it('should return a success response to indicate that object has been created', function(done) {
			var clientrequest = {
				"model": "comments",
				"context": 1,
				"content": {
					"events_id" :1,
				}
			};
			request(url)
			.post('/object/create')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(202);
				res.body.content.should.be.equal("Created");
				done();
			});
		});
		
		it('should return an error response to indicate that object has NOT been created because of missing authentication', function(done) {
			var clientrequest = {
				"model": "comments",
				"context": 1,
				"content": {
					"events_id" :1,
				}
			};
			request(url)
			.post('/object/create')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(401);
				done();
			});
		});
		
		it('should return an error response to indicate that object has NOT been created because of missing model', function(done) {
			var clientrequest = {
				"context": 1,
				"content": {
					"events_id" :1,
				}
			};
			request(url)
			.post('/object/create')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(404);
				done();
			});
		});
		
		it('should return an error response to indicate that object has NOT been created because of missing context', function(done) {
			var clientrequest = {
				"model": "comments",
				"content": {
					"events_id" :1,
				}
			};
			request(url)
			.post('/object/create')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(400);
				done();
			});
		});
		
		it('should return a success response to indicate the count of a certain filter/subscription', function(done) {
			var clientrequest = {
				"context": 1,
				"model" : "comments"
			}
			request(url)
			.post('/object/count')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(202);
				done();
			});
		});
		
		
		it('should return a success response to indicate that a object has been updated', function(done) {
			var clientrequest = {
				"model": "comments",
				"id": 1,
				"context": 1,
				"patch": [
					{
						"op": "replace",
						"path": "comments/1/text",
						"value": "some edited text"
					},
				],
			}
			request(url)
			.post('/object/update')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(202);
				done();
			});
		});
		
		it('should return a success response to indicate that a object has NOT been updated because of missing authorization ', function(done) {
			var clientrequest = {
				"model": "comments",
				"id": 1,
				"context": 1,
				"patch": [
					{
						"op": "replace",
						"path": "comments/1/text",
						"value": "some edited text"
					},
				],
			}
			request(url)
			.post('/object/update')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(401);
				done();
			});
		});
		
		it('should return a success response to indicate that a object has NOT been updated because of missing id', function(done) {
			var clientrequest = {
				"model": "comments",
				"context": 1,
				"patch": [
					{
						"op": "replace",
						"path": "comments/1/text",
						"value": "some edited text"
					},
				],
			}
			request(url)
			.post('/object/update')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(404);
				done();
			});
		});
		
		it('should return a success response to indicate that a object has NOT been updated because of missing context ', function(done) {
			var clientrequest = {
				"model": "comments",
				"id": 1,
				"patch": [
					{
						"op": "replace",
						"path": "comments/1/text",
						"value": "some edited text"
					},
				],
			}
			request(url)
			.post('/object/update')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(400);
				done();
			});
		});
		
		it('should return a success response to indicate that a object has been subscribed', function(done) {
			var subclientrequest = {
				"channel": {
					"id": 1,
					"context": 1,
					"model": "comments",
					"parent": {
						"id": 1,
						"model": "events"
					},
					 "user": 2
				}
			};
			request(url)
			.post('/object/subscribe')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send()
			.end(function(err, res) {
				res.statusCode.should.be.equal(200);
				done();
			});
		});
		
		it('should return an error response to indicate that a object has NOT been subscribed because of empty body', function(done) {
			var subclientrequest = {};
			request(url)
			.post('/object/subscribe')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send()
			.end(function(err, res) {
				res.statusCode.should.be.equal(400);
				done();
			});
		});
		
		it('should return an error response to indicate that a object has NOT been subscribed because of missing channel', function(done) {
			var subclientrequest = {
					"filters": {
						"or": [
							{
								"and": [
									{
									  "is": {
										"gender": "male",
										"age": 23
									  }
									},
									{
									  "range": {
										"experience": {
										  "gte": 1,
										  "lte": 6
										}
									  }
									}
								  ]
								},
								{
								  "and": [
									{
									  "like": {
										"image_url": "png",
										"website": "png"
									  }
									}
								  ]
								}
							  ]
					}
			};

			request(url)
			.post('/object/subscribe')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send()
			.end(function(err, res) {
				res.statusCode.should.be.equal(400);
				done();
			});
		});
		
		it('should return a success response to indicate that a object has been unsubscribed', function(done) {
			request(url)
			.post('/object/unsubscribe')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send(subclientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(200);
				done();
			});
		})
		
		it('should return a success response to indicate that a object has been deleted', function(done) {
			var clientrequest = {
				"model": "comments",
				"context": 1,
				"id" : 1,
			};
			request(url)
			.post('/object/delete')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(202);
				done();
			});
		});
		
		// it('should return an error response to indicate that a object was NOT deleted', function(done) {
			// this.timeout(10000);
			// setTimeout(function() {
				// var clientrequest = {
					// "model": "comments",
					// "context": 1,
					// "id" : 1,
				// };
			
				// request(url)
				// .post('/object/delete')
				// .set('X-BLGREQ-SIGN', appIDsha256)
				// .set('X-BLGREQ-UDID', deviceIdentification)
				// .set('X-BLGREQ-APPID',1)
				// .set('Authorization', authValue )
				// .send(clientrequest)
				// .end(function(err, res) {
					//console.log(res);
					// res.statusCode.should.be.equal(404);
					// done();
				// });
			// }, 5500);
	
		// });
		
		it('should return an error response to indicate that the object id was missing', function(done) {
			var clientrequest = {
				"model": "comments",
				"context": 1,
				"content": {
				}
			}
			
			request(url)
			.post('/object/delete')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(400);
				done();
			});
		});
		
		it('should return an error response to indicate that the object model was missing', function(done) {
			var clientrequest = {
				"context": 1,
				"id" : 1,
				"content": {
				}
			}
			request(url)
			.post('/object/delete')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(400);
				done();
			});
		});
		
		it('should return an error response to indicate that the object was not deleted because of missing authentication', function(done) {
			var clientrequest = {
				"model": "comments",
				"context": 1,
				"id" : 1,
				"content": {
				}
			}
			request(url)
			.post('/object/delete')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(401);
				done();
			});
		});
		
		it('should return an error response to indicate that the object was not deleted because of missing context', function(done) {
			var clientrequest = {
				"model": "comments",
				"id" : 1,
				"content": {
				}
			}
			request(url)
			.post('/object/delete')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(400);
				done();
			});
		});
	});

	describe('User',function(){
		var deviceIdentification;
		var invalidUDID = 'invalid';
		var appIDsha256 =  '2a80f1666442062debc4fbc0055d8ba5efc29232a27868c0a8eb76dec23df794';
		var authValue;
		var token;
		var userID;
		var userEmail = "user6@example.com";
		var userEmail2 = "user"+ Math.round(Math.random()*1000000)+1000 +"@example.com";
					
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
				}, DELAY);
			});
		});
		
		it('should return an succes response to indicate that the user info was retrived', function(done) {
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
		
		// it('should return an succes response to indicate that the user has logged in via FACEBOOK', function(done) {
			// //TODO
			// var clientrequest = {
				// "user" : "testuser1",
				// "password" : "1234test"				
			// };   
			
			// request(url)
			// .post('/user/login')
			// .set('X-BLGREQ-SIGN', appIDsha256)
			// .set('X-BLGREQ-UDID', deviceIdentification)
			// .set('X-BLGREQ-APPID',1)
			// .send(clientrequest)
			// .end(function(err, res) {
				// res.statusCode.should.be.equal(200);
				// done();
			// });
		// });
		
		it('should return a success response to indicate that the user was updated', function(done) {
			var clientrequest = {
				"email": userEmail,
				"password": "secure_password1337",
				"patches" : [
					{
					"name": "Johnny Smith"
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
				res.statusCode.should.be.equal(200);
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
			var clientrequest = {
				"token" : token		
			};
			request(url)
			.get('/user/logout')
			.set('Content-type','application/json')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.set('Authorization', authValue )
			.send()
			.end(function(err, res) {
				res.statusCode.should.be.equal(200);
				done();
			});
		});
		
		it('should return a success response to indicate that the user has registred', function(done) {
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
		
		it('should return a success response to indicate that the user has NOT registred', function(done) {
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
				"id" : userID,
				"email" : userEmail				
			};
			request(url)
			.post('/user/delete')
			.set('X-BLGREQ-SIGN', appIDsha256)
			.set('X-BLGREQ-UDID', deviceIdentification)
			.set('X-BLGREQ-APPID',appID)
			.send(clientrequest)
			.end(function(err, res) {
				res.statusCode.should.be.equal(202);
				done();
			});
		});
	});	
});