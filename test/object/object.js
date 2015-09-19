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
	this.timeout(13*DELAY);
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
    .set('X-BLGREQ-UDID', deviceIdentification )
    .send(clientrequest)
    .end(function(err, res) {
      setTimeout(function () {
        request(url)
        .post('/user/login_password')
        .set('Content-type','application/json')
        .set('X-BLGREQ-SIGN', appIDsha256 )
        .set('X-BLGREQ-APPID', appID )
        .set('X-BLGREQ-UDID', deviceIdentification )
        .send(clientrequest)
        .end(function(err, res) {
          token = res.body.content.token;
          authValue = 'Bearer ' + token;
          done();
        });
      }, 6*DELAY);
    });
  });
});

it('should return an error (400) response to indicate that the client made a bad request', function(done) {
  var clientrequest = {};
  request(url)
  .post('/object/create')
  .set('X-BLGREQ-SIGN', appIDsha256)
  .set('X-BLGREQ-UDID', deviceIdentification )
  .set('X-BLGREQ-APPID',appID)
  .set('Authorization', authValue )
  .send(clientrequest)
  .end(function(err, res) {
	  //console.log(res);
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
  .set('X-BLGREQ-UDID', deviceIdentification)
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