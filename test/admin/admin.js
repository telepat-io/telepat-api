var common = require('../common');
var request = common.request;
var should = common.should;
var assert = common.assert;
var crypto = common.crypto;
var url = common.url;
var DELAY = common.DELAY;

var authValue;
var appID;
var appIDsha256 = common.appIDsha256;
var appKey;

var adminEmail = 'admin'+Math.round(Math.random()*1000000)+'@example.com';
var adminPassword = '5f4dcc3b5aa765d61d8327deb882cf99';

var admin = {
  email: adminEmail,
  password: adminPassword
};

var admin2 = {
  email: 'admin'+Math.round(Math.random()*1000000)+'@example.com',
  password: adminPassword
}
    
describe('Admin', function() {
  
  it('should return a 200 code to indicate success when creating a new admin', function(done) {
		this.timeout(10000);

		request(url)
		.post('/admin/add')
		.send(admin)
		.end(function(err, res) {
			if (err) {
				throw err;
				done(err);
			}
			res.statusCode.should.be.equal(200);
			setTimeout(done, 3*DELAY);
		});
  });

  it('should return a 409 code to indicate failure when admin already exists', function(done) {
	  
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
    var randEmail = 'adminx@example.com';
    var admin = {
      email: randEmail,
      password: adminPassword
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
      adminAuth = authValue;
      res.statusCode.should.be.equal(200);
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
  
  it('should return an error response indicating the admin account has NOT been updated because of missing credentials', function(done) {
    var randEmail = 'adminx@example.com';
    var admin = {
      email: randEmail,
      password: adminPassword
    };
    request(url)
    .post('/admin/update')
    .set('Content-type','application/json')
    .send(admin)
    .end(function(err, res) {
      res.statusCode.should.be.equal(401);
      done();
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

  it('should return an error response indicating the admin account has NOT been deleted because of missing credentials', function(done) {
    var randEmail = 'adminx@example.com';
    var admin = {
      email: randEmail,
      password: adminPassword
    };
    request(url)
    .post('/admin/delete')
    .set('Content-type','application/json')
    .send()
    .end(function(err, res) {
      res.statusCode.should.be.equal(401);
      done();
    }); 
  });
  
  it('should return a succes response indicating the admin account has been deleted', function(done) {
    this.timeout(10*DELAY);
    request(url)
    .post('/admin/delete')
    .set('Content-type','application/json')
    .set('Authorization', authValue)
    .send()
    .end(function(err, res) {
      res.statusCode.should.be.equal(200);
      setTimeout(function() {
        request(url)
        .post('/admin/add')
        .send(admin)
        .end(function(err, res) {
          res.statusCode.should.be.equal(200);
          setTimeout(function () {
            request(url)
            .post('/admin/login')
            .send(admin)
            .end(function(err, res) {
              authValue = 'Bearer ' + res.body.content.token;
              adminAuth = authValue;
              res.statusCode.should.be.equal(200);
              done();
            });
          }, 4*DELAY);
        });
      }, 4*DELAY);
    });
  });

});

describe('App', function() {  
  it('should return a success response to indicate app succesfully created', function(done) {
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
    }
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
      "keys": [ appKey ]
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
      "keys": [ appKey ]
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
  var token2;
  var authValue2;
  var deletedcontextID;

  /////////////////////////////////////////////////////////////
  
  before(function(done){
    this.timeout(10000);
    var clientrequest = {
      "name": "test-app",
      "keys": [ common.appKey ]
    };
    request(url)
    .post('/admin/app/add')
    .set('Content-type','application/json')
    .set('Authorization', authValue)
    .send(clientrequest)
    .end(function(err, res) {
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
        }, 3*DELAY);
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
      res.statusCode.should.be.equal(400);
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
      "patches": [
        {
          "op": "replace",
          "path": "context/"+contextID+"/name",
          "value": "New name"
        }
      ]
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

  it('should return an error response to indicate context was NOT updated because patches are missing', function(done) {
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
      res.statusCode.should.be.equal(400);
      done();
    });
  });
  
  it('should return an error response to indicate context was NOT updated because context does not exist', function(done) {
    var clientrequest = {
      "id": Math.round(Math.random()*1000000)+100,
      "patches": []
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
    .set('Authorization', authValue2)
    .set('X-BLGREQ-APPID', appID)
    .send(clientrequest)
    .end(function(err, res) {
      res.statusCode.should.be.equal(401);
      done();
    });
  });
  
  it('should return an error response to indicate context was NOT removed because of invalid context id', function(done) {
    var clientrequest = {
      "id": 1
    }
    request(url)
    .post('/admin/context/remove')
    .set('Content-type','application/json')
    .set('Authorization', authValue)
    .set('X-BLGREQ-APPID', appID)
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
    .set('X-BLGREQ-APPID', appID )
    .send(clientrequest)
    .end(function(err, res) {
      res.statusCode.should.be.equal(404);
      res.body.message.should.be.equal("Context not found");
      done();
    });
  });
  
  it('should return all contexts', function(done) {
	this.timeout(9*DELAY);
	setTimeout(function () {
		request(url)
		.get('/admin/contexts')
		.set('Content-type','application/json')
		.set('Authorization', authValue)
		.set('X-BLGREQ-APPID', appID)
		.send()
		.end(function(err, res) {
		  res.statusCode.should.be.equal(200);
		  res.body.content.should.have.length(1);
		  done();
		});
	}, 6*DELAY);

  });

  it('should return a success response to indicate context was removed', function(done) {
    var clientrequest = {
      "id": contextID
    }
    request(url)
    .post('/admin/context/remove')
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

describe('Schema', function() {
  it('should return a success response to indicate schema succesfully updated', function(done) {
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
});

describe('User', function() {
  var userEmail = 'user'+Math.round(Math.random()*1000000)+'@example.com';
  var clientrequest = {
    "email": userEmail,
    "password": "secure_password1337",
    "name": "John Smith"
  };

  before(function(done){
		this.timeout(11*DELAY);
		request(url)
		.post('/user/register')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.send(clientrequest)
		.end(function(err, res) {

		  setTimeout(done, 3*DELAY);
		});
  });
  
  it('should return a success response to indicate that an user was updated', function(done) {
	  this.timeout(10*DELAY);
	 
    var clientrequest = {
    	"email" : userEmail,
    	"patches": [
    		{
    			"op": "replace",
    			"path": "user/"+userEmail+"/name",
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
      setTimeout(done, 6*DELAY);
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
      }, 2*DELAY);
    });

  }); 
  
  // it('should return a success response indicating that a user has NOT been deleted, user does not belong to application', function(done) {
  //  this.timeout(25000);
  //  var userEmail = "user3@example.com";
  //  var clientrequest = {
  //    "email": userEmail,
  //    "password": "secure_password1337",
  //    "name": "John Smith"
  //  };
  //  request(url)
  //  .post('/user/register')
  //  .set('Content-type','application/json')
  //  .set('X-BLGREQ-SIGN', appIDsha256 )
  //  .set('X-BLGREQ-APPID', appID )
  //  .set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
  //  .send(clientrequest)
  //  .end(function(err, res) {
  //    var userEmail = "user2@example.com";
  //    var clientrequest = {
  //      "email": userEmail,
  //      "password": "secure_password1337",
  //      "name": "John Smith"
  //    };
  //    setTimeout(function() {
  //      request(url)
  //      .post('/admin/user/delete')
  //      .set('Content-type','application/json')
  //      .set('X-BLGREQ-SIGN', appIDsha256 )
  //      .set('X-BLGREQ-APPID', appID )
  //      .set('Authorization', authValue )
  //      .set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
  //      .send(clientrequest)
  //      .end(function(err, res) {
  //        res.statusCode.should.be.equal(500);
  //        done();
  //      });
  //    }, DELAY);
  //  });
  // });  
  
  it('should return a error response indicating that a user has NOT been deleted because of missing email address', function(done) {
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
    .set('X-BLGREQ-APPID',   Math.round(Math.random()*1000000)+1000 )
    .set('Authorization', authValue )
    .set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
    .send(clientrequest)
    .end(function(err, res) {
      res.statusCode.should.be.equal(404);
      done();
    });
  }); 
  
  it('should return an error response to indicate that an user was NOT found when trying to update', function(done) {
    var clientrequest = {
      "email" : "wrong@example.com",
      "patches": [
        {
          "op": "replace",
          "path": "user/"+userEmail+"/name",
          "value": "new value"
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