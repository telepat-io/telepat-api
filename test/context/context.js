var common = require('../common');
var request = common.request;
var should = common.should;
var assert = common.assert;
var crypto = common.crypto;
var url = common.url;
var DELAY = common.DELAY;
var appIDsha256 = common.appIDsha256;

var token;
var clientrequest = {
  "email": "example@appscend.com",
  "password": "secure_password1337",
  "name": "John Smith"
};
var authValue;

before(function(done){
	this.timeout(10*DELAY);
	//console.log(appID);
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
		 // console.log(err);
		   // console.log(res);
        token = res.body.content.token;
        authValue = 'Bearer ' + token;
        done();
      });
    }, 5*DELAY);
  });
});
  
  before(function(done){
      var clientrequest = {
      "name": "context",
      "meta": {"info": "some meta info"},
    }
    request(url)
    .post('/admin/context/add')
    .set('Content-type','application/json')
    .set('Authorization', adminAuth )
    .set('X-BLGREQ-APPID', appID )
    .send(clientrequest)
    .end(function(err, res) {
      var objectKey = Object.keys(res.body.content)[0];
      contextID = res.body.content.id;

      done();
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