var express = require('express');
var logger = require('morgan');
var bodyParser = require('body-parser');

async = require('async');
kafka = require('kafka-node');
cb = require('couchbase');
elastic = require('elasticsearch');
Models = require('octopus-models-api');

var security = require('./controllers/security');
var adminRoute = require('./controllers/admin');
var objectRoute = require('./controllers/object');
var userRoute = require('./controllers/user');
var contextRoute = require('./controllers/context');
var deviceRoute = require('./controllers/device');

var dbConnected = false;
app = express();

app.set('port', process.env.PORT || 3000);

app.disable('x-powered-by');

app.use('/documentation', express.static('documentation'));

if (process.env.TP_KFK_HOST) {
	app.kafkaConfig = {
		host: process.env.TP_KFK_HOST,
		port: process.env.TP_KFK_PORT,
		clientName: process.env.TP_KFK_CLIENT
	};
} else {
	app.kafkaConfig = require('./config/kafka.json');
}

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
db = app.get('couchbase-db');

app.applications = {};

app.use(function(req, res, next) {
	if (dbConnected)
		return next();
	res.type('application/json');
	res.status(503).json({status: 503, message: "API server not available."}).end();
});

var OnServicesConnect = function() {
	dbConnected = true;
	Models.Application.setBucket(db.Couchbase.bucket);
	Models.Application.setStateBucket(db.Couchbase.stateBucket);
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

async.waterfall([
	function DataBucket(callback) {
		if (db.Couchbase.bucket)
			delete db.Couchbase.bucket;
		db.Couchbase.bucket = db.Couchbase.openBucket(ds.couchbase.bucket);
		db.Couchbase.bucket.on('error', function(err) {
			console.log('Failed connecting to Data Bucket on couchbase "'+ds.couchbase.host+'": '+err.message);
			console.log('Retrying...');
			setTimeout(function () {
				DataBucket(callback);
			}, 1000);
		});
		db.Couchbase.bucket.on('connect', function() {
			console.log('Connected to Data bucket on couchbase.');
			callback();
		});
	},
	function StateBucket(callback) {
		if (db.Couchbase.stateBucket)
			delete db.Couchbase.stateBucket;
		db.Couchbase.stateBucket = db.Couchbase.openBucket(ds.couchbase.stateBucket);
		db.Couchbase.stateBucket.on('error', function(err) {
			console.log('Failed connecting to State Bucket on couchbase "'+ds.couchbase.host+'": '+err.message);
			console.log('Retrying...');
			setTimeout(function () {
				StateBucket(callback);
			}, 1000);
		});
		db.Couchbase.stateBucket.on('connect', function() {
			console.log('Connected to State bucket on couchbase.');
			callback();
		});
	},
	function Elasticsearch(callback) {
		if (app.get('elastic-db'))
			app.disable('elastic-db');

		app.set('elastic-db', {
			client: new elastic.Client({host: ds.elasticsearch.host+':'+ds.elasticsearch.port})
		});
		app.get('elastic-db').client.ping({
			requestTimeout: Infinity
		}, function(err) {
			if (err) {
				console.log('Failed connecting to Elasticsearch "'+ds.elasticsearch.host+'": '+err.message);
				console.log('Retrying...');
				setTimeout(function () {
					Elasticsearch(callback);
				}, 1000);
			} else {
				console.log('Connected to Elasticsearch.');
				callback();
			}
		});
	},
	function Kafka(callback) {
		if (app.kafkaProducer)
			delete app.kafkaProducer;

		app.kafkaProducer = new kafka.HighLevelProducer(app.kafkaClient);
		app.kafkaClient = new kafka.Client(app.kafkaConfig.host+':'+app.kafkaConfig.port+'/', app.kafkaConfig.clientName);

		app.kafkaProducer.on('error', function(err) {
			console.log('Failed connecting to Kafka "'+app.kafkaConfig.host+'": '+err.message);
			console.log('Retrying...');
			setTimeout(function () {
				Kafka(callback);
			}, 1000);
			app.kafkaClient.close();
		});

		app.kafkaProducer.on('ready', function() {
			console.log('Connected to Kafka.');
			callback();
		});
	}
], OnServicesConnect);

module.exports = app;
