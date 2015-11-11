var common = require('../common');
var request = common.request;
var should = common.should;
var url = common.url;
var DELAY = common.DELAY;

var appIDsha256 = common.appIDsha256;
var contextID;
var authValue;
var appID;

var token;
var clientrequest = {
	username: 'user'+Math.round(Math.random()*1000000)+'@example.com',
	password: 'secure_password1337',
	name: 'John Smith'
};

var adminEmail = 'admin'+Math.round(Math.random()*1000000)+'@example.com';
var adminPassword = '5f4dcc3b5aa765d61d8327deb882cf99';

var admin = {
	email: adminEmail,
	password: adminPassword
};

before(function(done){

	this.timeout(100*DELAY);

	var clientrequest = {
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
					authValue = 'Bearer ' + token;

					request(url)
						.post('/admin/app/add')
						.set('Content-type','application/json')
						.set('Authorization', authValue)
						.send(clientrequest)
						.end(function(err, res) {
							appID =  res.body.content.id;
							done();
						});
				});
		});
});

before(function(done){

	this.timeout(100*DELAY);

	var clientrequest = {
		name: "context",
		meta: {info: "some meta info"},
	};

	request(url)
		.post('/admin/context/add')
		.set('Content-type','application/json')
		.set('Authorization', authValue )
		.set('X-BLGREQ-APPID', appID )
		.send(clientrequest)
		.end(function(err, res) {

			contextID = res.body.content.id;
			done();
		});
});

it('2.1 should return a success response to indicate context successfully retrieved', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		id: contextID
	};

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

it('2.2 should return an error response to indicate context was NOT successfully retrieved because of missing context ID', function(done) {

	this.timeout(100*DELAY);

	request(url)
		.post('/context')
		.set('Content-type','application/json')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.set('Authorization', authValue )
		.send()
		.end(function(err, res) {

			res.body.code.should.be.equal('004');
			res.statusCode.should.be.equal(400);
			done();
		});
});

it('2.3 should return an error response to indicate context NOT successfully retrieved because of bad context ID', function(done) {

	this.timeout(100*DELAY);

	var clientrequest = {
		id: Math.round(Math.random()*1000000)+1000
	};

	request(url)
		.post('/context')
		.set('X-BLGREQ-SIGN', appIDsha256 )
		.set('X-BLGREQ-APPID', appID )
		.set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
		.set('Authorization', authValue )
		.send(clientrequest)
		.end(function(err, res) {

			res.body.code.should.be.equal('020');
			res.statusCode.should.be.equal(404);
			done();
		});
});

it('2.4 should return a success response to indicate all contexts successfully retrieved', function(done) {

	this.timeout(100*DELAY);

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
