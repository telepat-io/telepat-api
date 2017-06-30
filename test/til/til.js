var common = require('../common');
var request = common.request;
var should = common.should;
var url = common.url;
var DELAY = common.DELAY;


it('6.1 should return a success response to indicate that a member was added to list', function(done) {
    
    this.timeout(100*DELAY);
    var clientrequest = {
    	listName: "object_id",
 		indexedProperty: "fid",
  		memberObject: {
  			fid_1: "0",
            fid_2: "1"
  		}
    }
    request(url)
        .post('/til/append')
		.set('Content-type', 'application/json')
        .send(clientrequest)
        .end(function(err, res) {
            res.status.should.be.equal(200);
            done();
        });
});

it('6.2 should return an error response to indicate that a member was NOT added to list because of a missing required field', function(done) {
    
    this.timeout(100*DELAY);
    var clientrequest = {
 		indexedProperty: "fid",
  		memberObject: {
  			fid_1: "0",
            fid_2: "1"
  		}
    }
    request(url)
        .post('/til/append')
		.set('Content-type', 'application/json')
        .send(clientrequest)
        .end(function(err, res) {
            res.status.should.be.equal(400);
            res.body.code.should.be.equal('004');
            done();
        });
});

it('6.3 should return an error response to indicate that a member was NOT added to list because of a missing required field', function(done) {
    
    this.timeout(100*DELAY);
    var clientrequest = {
    	listName: "object_id",
  		memberObject: {
  			fid_1: "0",
            fid_2: "1"
  		}
    }
    request(url)
        .post('/til/append')
		.set('Content-type', 'application/json')
        .send(clientrequest)
        .end(function(err, res) {
            res.status.should.be.equal(400);
            res.body.code.should.be.equal('004');
            done();
        });
});
it('6.4 should return an error response to indicate that a member was NOT added to list because of a missing required field', function(done) {
    
    this.timeout(100*DELAY);
    var clientrequest = {
    	listName: "object_id",
 		indexedProperty: "fid"
    }
    request(url)
        .post('/til/append')
		.set('Content-type', 'application/json')
        .send(clientrequest)
        .end(function(err, res) {
            res.status.should.be.equal(400);
            res.body.code.should.be.equal('004');
            done();
        });
});


it('6.5 should return a success response and a list with members from a specific list', function(done) {
    var clientrequest = {
  		"listName": "object_id",
  		"indexedProperty": "fid",
  		"members": ["fid_1", "fid_2", "fid_3"]
    }
    request(url)
        .post('/til/get')
		.set('Content-type', 'application/json')
        .send(clientrequest)
        .end(function(err, res) {
            res.status.should.be.equal(200);
            done();
        });

});


it('6.6 should return an error response to indicate that a list can NOT be verified because of a missing required field', function(done) {
    var clientrequest = {
  		"indexedProperty": "fid",
  		"members": ["fid_1", "fid_2", "fid_3"]
    }
    request(url)
        .post('/til/get')
		.set('Content-type', 'application/json')
        .send(clientrequest)
        .end(function(err, res) {
            res.status.should.be.equal(400);
            res.body.code.should.be.equal('004');
            done();
        });

});

it('6.7 should return an error response to indicate that a list can NOT be verified because of a missing required field', function(done) {
    var clientrequest = {
  		"listName": "object_id",
  		"members": ["fid_1", "fid_2", "fid_3"]
    }
    request(url)
        .post('/til/get')
		.set('Content-type', 'application/json')
        .send(clientrequest)
        .end(function(err, res) {
            res.status.should.be.equal(400);
            res.body.code.should.be.equal('004');
            done();
        });

});

it('6.8 should return an error response to indicate that a list can NOT be verified because of a missing required field', function(done) {
    var clientrequest = {
  		"listName": "object_id",
  		"indexedProperty": "fid"
    }
    request(url)
        .post('/til/get')
		.set('Content-type', 'application/json')
        .send(clientrequest)
        .end(function(err, res) {
            res.status.should.be.equal(400);
            res.body.code.should.be.equal('004');
            done();
        });

});

it('6.9 should return a success response to indicate that a member was removed', function(done) {
    
    this.timeout(100*DELAY);

    var clientrequest = {
        listName: "object_id",
  		indexedProperty: "fid",
        members: ["fid_1"]
    }
    request(url)
        .post('/til/removeMember')
        .send(clientrequest)
        .end(function(err, res) {
            res.status.should.be.equal(200);
            done();
        });

});

it('6.10 should return an error response to indicate that a member was NOT removed because of a missing required field', function(done) {
    
    this.timeout(100*DELAY);

    var clientrequest = {
  		indexedProperty: "fid",
        members: ["fid_1"]
    }
    request(url)
        .post('/til/removeMember')
        .send(clientrequest)
        .end(function(err, res) {
            res.status.should.be.equal(400);
            res.body.code.should.be.equal('004');
            done();
        });

});

it('6.11 should return an error response to indicate that a member was NOT removed because of a missing required field', function(done) {
    
    this.timeout(100*DELAY);

    var clientrequest = {
        listName: "object_id",
        members: ["fid_1"]
    }
    request(url)
        .post('/til/removeMember')
        .send(clientrequest)
        .end(function(err, res) {
            res.status.should.be.equal(400);
            res.body.code.should.be.equal('004');
            done();
        });


});

it('6.12 should return an error response to indicate that a member was NOT removed because of a missing required field', function(done) {
    
    this.timeout(100*DELAY);

    var clientrequest = {
        listName: "object_id",
  		indexedProperty: "fid"
    }
    request(url)
        .post('/til/removeMember')
        .send(clientrequest)
        .end(function(err, res) {
            res.status.should.be.equal(400);
            res.body.code.should.be.equal('004');
            done();
        });

});


it('6.14 should return a success response to indicate that a list was removed', function(done){
    var clientrequest = {
        listName: "object_id"
    }

    request(url)
        .post('/til/removeList')
        .send(clientrequest)
        .end(function(err, res) {
            res.status.should.be.equal(200);
            done();
        });
});

it('6.15 should return a success response to indicate that a list was NOT removed because of a missing required field', function(done){


    request(url)
        .post('/til/removeList')
        .send()
        .end(function(err, res) {
            res.status.should.be.equal(400);
            res.body.code.should.be.equal('004');
            done();
        });
});