var common = require('../common');
var request = common.request;
var should = common.should;
var assert = common.assert;
var crypto = common.crypto;
var url = common.url;
var DELAY = common.DELAY;

var deviceIdentification;
var invalidUDID = 'invalid';
var appIDsha256 = common.appIDsha256;
var token;
var appID;
var authValue;
var contextID;

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

var adminEmail = 'admin'+Math.round(Math.random()*1000000)+'@example.com';
var adminPassword = '5f4dcc3b5aa765d61d8327deb882cf99';

var admin = {
  email: adminEmail,
  password: adminPassword
};

var invalidUDID = 'invalid';

before(function(done){
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
        authValue = 'Bearer ' + token;
        request(url)
        .post('/admin/app/add')
        .set('Content-type','application/json')
        .set('Authorization', authValue)
        .send(clientrequest)
        .end(function(err, res) {
          appID =  res.body.content.id;
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
                "read_acl": 6,
                "write_acl": 6,
                "meta_read_acl": 6
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
            var clientrequest = {
              "name": "context"
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
              done();
            });
          });
        });
      });
    }, 3*DELAY);
  });
});

before(function(done){
	this.timeout(10*DELAY);
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
      "email": 'admin'+Math.round(Math.random()*1000000)+'@example.com',
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
      }, 4*DELAY);
    });
  });
});

it('should return an error (400) response to indicate that the client made a bad request', function(done) {
  this.timeout(10*DELAY);
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
    "context": contextID,
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
    "context": contextID,
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
    "context": contextID,
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
    "context": contextID,
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
    "channel": {
      "context": contextID,
      "model": "comments"
    }
  };
  request(url)
  .post('/object/count')
  .set('X-BLGREQ-SIGN', appIDsha256)
  .set('X-BLGREQ-UDID', deviceIdentification)
  .set('X-BLGREQ-APPID',appID)
  .set('Authorization', authValue )
  .send(clientrequest)
  .end(function(err, res) {
    res.statusCode.should.be.equal(200);
    done();
  });
});


it('should return a success response to indicate that a object has been updated', function(done) {
  var clientrequest = {
    "model": "comments",
    "id": 1,
    "context": contextID,
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
    "context": contextID,
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
    "context": contextID,
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
      "context": contextID,
      "model": "comments"
    }
  };
  request(url)
  .post('/object/subscribe')
  .set('Content-type','application/json')
  .set('X-BLGREQ-SIGN', appIDsha256)
  .set('X-BLGREQ-UDID', deviceIdentification)
  .set('X-BLGREQ-APPID',appID)
  .set('Authorization', authValue )
  .send(subclientrequest)
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
  var subclientrequest = {
    "channel": {
      "context": contextID,
      "model": "comments"
    }
  };
  request(url)
  .post('/object/unsubscribe')
  .set('X-BLGREQ-SIGN', appIDsha256)
  .set('X-BLGREQ-UDID', deviceIdentification)
  .set('X-BLGREQ-APPID',appID)
  .set('Authorization', authValue)
  .send(subclientrequest)
  .end(function(err, res) {
    res.statusCode.should.be.equal(200);
    done();
  });
})

it('should return a success response to indicate that a object has been deleted', function(done) {
  var clientrequest = {
    "model": "comments",
    "context": contextID,
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
      // res.statusCode.should.be.equal(404);
      // done();
    // });
  // }, 5500);

// });

it('should return an error response to indicate that the object id was missing', function(done) {
  var clientrequest = {
    "model": "comments",
    "context": contextID,
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
    "context": contextID,
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
    "context": contextID,
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