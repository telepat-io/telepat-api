var express = require('express');
var logger = require('morgan');
var bodyParser = require('body-parser');
var fs = require('fs');

var tests = require('./controllers/tests');
var security = require('./controllers/security');

var adminRoute = require('./controllers/admin');
var objectRoute = require('./controllers/object');
var userRoute = require('./controllers/user');
var contextRoute = require('./controllers/context');
var deviceRoute = require('./controllers/device');

async = require('async');
kafka = require('kafka-node');
cb = require('couchbase');
elastic = require('elasticsearch');

var dbConnected = false;

Models = require('octopus-models-api');
app = express();

app.set('port', process.env.PORT || 3000);

app.disable('x-powered-by');

if (process.env.TP_KFK_HOST) {
	app.kafkaConfig = {
		host: process.env.TP_KFK_HOST,
		port: process.env.TP_KFK_PORT,
		clientName: process.env.TP_KFK_CLIENT
	};
} else {
	app.kafkaConfig = require('./config/kafka.json');
}

app.kafkaClient = new kafka.Client(app.kafkaConfig.host+':'+app.kafkaConfig.port+'/', app.kafkaConfig.clientName);
app.kafkaProducer = new kafka.HighLevelProducer(app.kafkaClient);

app.kafkaClient.on('error', function(err) {
	console.log(err)
});

app.kafkaProducer.on('error', function(err) {
	console.log(err)
});

app.datasources = {};

if (process.env.TP_CB_HOST) {
	app.datasources.couchbase = {
		host: process.env.TP_CB_HOST,
		bucket: process.env.TP_CB_BUCKET,
		stateBucket: process.env.TP_CB_STATE_BUCKET
	};
} else {
	app.datasources.couchbase = require('./config/datasources').couchbase;
}
if (process.env.TP_ES_HOST) {
	app.datasources.elasticsearch = {
		host: process.env.TP_ES_HOST,
		port: process.env.TP_ES_PORT
	}
} else {
	app.datasources.elasticsearch = require('./config/datasources').elasticsearch;
}

ds = app.datasources;
app.set('couchbase-db', {
	Couchbase: new cb.Cluster('couchbase://'+ds.couchbase.host)
});
app.set('elastic-db', {
	Elastic: new elastic.Client({host: ds.elasticsearch.host+':'+ds.elasticsearch.port})
});
db = app.get('couchbase-db');
//main data bucket
db.Couchbase.bucket = db.Couchbase.openBucket(ds.couchbase.bucket);
db.Couchbase.stateBucket = db.Couchbase.openBucket(ds.couchbase.stateBucket);

Models.Application.setBucket(db.Couchbase.bucket);
Models.Application.setStateBucket(db.Couchbase.stateBucket);
app.applications = {};

app.use(function(req, res, next) {
	if (dbConnected)
		return next();
	res.type('application/json');
	res.status(500).json({status: 500, message: "Server failed to connect to database."}).end();
});

var OnBucketConnect = function() {
	dbConnected = true;
	Models.Application.getAll(function(err, results) {
		if (err) {
			console.log("Fatal error: ", err);
			return;
		}

		async.each(results, function(item, c){
			var appId = item.id.split(':').slice(-1)[0];
			app.applications[appId] = item.value;
			c();
		});
	});

	app.use(security.corsValidation);
	app.use(logger('dev'));
	/*Automatically parses request body from json string to object*/
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use('/admin', adminRoute);
	app.use('/object', objectRoute);
	app.use('/user', userRoute);
	app.use('/context', contextRoute);
	app.use('/device', deviceRoute);

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

	//signal sent by nodemon when restarting the server
	process.on('SIGUSR2', function() {
		db.Couchbase.bucket.disconnect();
		db.Couchbase.stateBucket.disconnect();
		app.kafkaClient.close();
	});

};

db.Couchbase.bucket.on('connect', OnBucketConnect);

var ErrorConnect = function ErrorConnect(error) {
	console.error('Could not connect to '+ds.couchbase.host+': '+error.toString()+' ('+error.code+')');
	setTimeout(function() {
		console.log('Retrying...');

		app.set('couchbase-db', {
			Couchbase: new cb.Cluster('couchbase://'+ds.couchbase.host)
		});

		db.Couchbase.bucket = db.Couchbase.openBucket(ds.couchbase.bucket);
		db.Couchbase.stateBucket = db.Couchbase.openBucket(ds.couchbase.stateBucket);

		Models.Application.setBucket(db.Couchbase.bucket);
		Models.Application.setStateBucket(db.Couchbase.stateBucket);

		db.Couchbase.bucket.on('connect', OnBucketConnect);
		db.Couchbase.bucket.on('error', ErrorConnect);
	}, 1000);
	db.Couchbase.bucket.disconnect();
};

db.Couchbase.bucket.on('error', ErrorConnect);

module.exports = app;
