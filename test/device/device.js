var common = require('../common');
var request = common.request;
var should = common.should;
var assert = common.assert;
var crypto = common.crypto;
var url = common.url;
var DELAY = common.DELAY;

var appIDsha256 = common.appIDsha256;

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
  .set('X-BLGREQ-APPID',appID)
  .send(clientrequest)
  .end(function(err, res) {
    res.statusCode.should.be.equal(404);
    done();
  });
});