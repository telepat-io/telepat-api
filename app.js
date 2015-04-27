var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');

var tests = require('./controllers/tests');
var security = require('./controllers/security');
var admin = require('./controllers/admin');
var objectRoute = require('./controllers/object');
var userRoute = require('./controllers/user');
var expressjwt = require('express-jwt');

async = require('async');
kafka = require('kafka-node');
cb = require('couchbase');
Models = require('octopus-models-api');
app = express();

app.set('port', process.env.PORT || 3000);

app.disable('x-powered-by');

app.kafkaConfig = require('./config/kafka.json');
app.kafkaClient = new kafka.Client(app.kafkaConfig.host+':'+app.kafkaConfig.port+'/', app.kafkaConfig.clientName);
app.kafkaProducer = new kafka.HighLevelProducer(app.kafkaClient);

app.kafkaClient.on('error', function(err) {
	console.log(err)
});

app.kafkaProducer.on('error', function(err) {
	console.log(err)
});

app.set('datasources', require('./config/datasources'));

ds = app.get('datasources');
app.set('database', {
	Couchbase: new cb.Cluster('couchbase://'+ds.couchbase.host)
});
db = app.get('database');
db.Couchbase.bucket = db.Couchbase.openBucket(ds.couchbase.bucket);
db.Couchbase.stateBucket = db.Couchbase.openBucket(ds.couchbase.stateBucket);

Models.Application.setBucket(db.Couchbase.bucket);
Models.Application.setStateBucket(db.Couchbase.stateBucket);
app.applications = {};

db.Couchbase.bucket.on('connect', function OnBucketConnect() {
	Models.Application.getAll(function(err, results) {
		async.each(results, function(item, c){
			var appId = item.id.split(':').slice(-1)[0];
			app.applications[appId] = item.value;
			c();
		}, function(err) {
			//console.log(app.applications);
		});

	});

	app.use(function(req, res, next) {
	  res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
	  if ('OPTIONS' == req.method) {
	      res.send(200);
	    }
	  else {
	    next();
	  }
	});
	app.use(logger('dev'));
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use('/authenticate', security);
	app.use('/admin', admin);
	app.use('/object', objectRoute);
	app.use('/user', userRoute);
	app.use('/testroute', tests);

	app.use(['/get', '/object', '/user', '/testroute'], security.keyValidation);

	app.use(['/get/contexts', '/delete/context'], expressjwt({secret: security.authSecret}));

	app.post('/get/contexts', function(req, res, next) {
		var id = req.body.id;
		var app_id = req.get('X-BLGREQ-APPID');

		if (!id) {
			Models.Context.getAll(app_id, function(err, results) {
				if (err)
					return next(err);

				res.json({status: 200, message: results}).end();
			});
		} else {
			new Models.Context(id, function(err, result) {
				if (err) return next(err);

				var responseBody = {status: 200, message: {}};
				responseBody.message[id] = result.value;

				res.json(responseBody).end();
			});
		}
	});

	app.post('/delete/context', function(req, res, next) {
		var id = req.body.id;

		app.kafkaProducer.send([{
			topic: 'aggregation',
			messages: [JSON.stringify({
				op: 'delete',
				object: {id: id},
				context: true,
				applicationId: req.get('X-BLGREQ-APPID')
			})],
			attributes: 0
		}], function(err, result) {
			if (err) return next(err);

			res.status(200).json({status: 200, message: "Context deleted"}).end();
		});
	});

	// error handlers
	// catch 404 and forward to error handler
	app.use(function(req, res, next) {
		var err = new Error('Not Found');
		err.status = 404;
		next(err);
	});

	// development error handler
	// will print stacktrace
	if (app.get('env') === 'development') {
		app.use(function(err, req, res, next) {
			res.status(err.status || 500);
			res.send(JSON.stringify({
				status: err.status || 500,
				message: {
					content: err.message,
					stack: err.stack
				}
			}));
		});
	}

	// production error handler
	// no stacktraces leaked to user
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.send(JSON.stringify({
			status: err.status || 500,
			message: {
				content: err.message
			}
		}));
	});

	process.on('SIGUSR2', function() {
		db.Couchbase.bucket.disconnect();
		db.Couchbase.stateBucket.disconnect();
		app.kafkaClient.close();
	});

});

db.Couchbase.bucket.on('error', function ErrorConnect(error) {
	console.error('Could not connect to '+ds.couchbase.host+': '+error.toString()+' ('+error.code+')');
	app.use(function(req, res) {
		res.type('application/json');
		res.status(500).json({status: 500, message: "Server failed to connect to database."});
	});
});

process.on('beforeExit', function() {
	console.log('exiting');
});

module.exports = app;
