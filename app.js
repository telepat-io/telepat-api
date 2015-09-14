var express = require('express');
var logger = require('morgan');
var bodyParser = require('body-parser');
var colors = require('colors');

async = require('async');
kafka = require('kafka-node');
cb = require('couchbase');
elastic = require('elasticsearch');
Models = require('telepat-models');
redis = require('redis');

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

app.use('/documentation', express.static(__dirname+'/documentation'));

process.title = "octopus-api";

if (process.env.TP_KFK_HOST) {
	app.kafkaConfig = {
		host: process.env.TP_KFK_HOST,
		port: process.env.TP_KFK_PORT,
		clientName: process.env.TP_KFK_CLIENT
	};
} else {
	app.kafkaConfig = require('./config.json').kafka;
}

var redisConfig = {};

if (process.env.TP_REDIS_HOST) {
	redisConfig = {
		host: process.env.TP_REDIS_HOST,
		port: process.env.TP_REDIS_PORT
	};
} else {
	redisConfig = require('./config.json').redis;
}

Models.Application.datasource = new Models.Datasource();
Models.Application.datasource.setMainDatabase(new Models.ElasticSearch(require('./config.json').elasticsearch));

app.set('password_salt', require('./config.json').password_salt);

app.applications = {};

app.use(function(req, res, next) {
	if (dbConnected)
		return next();
	res.type('application/json');
	res.status(503).json({status: 503, message: "API server not available."}).end();
});

var OnServicesConnect = function() {
	dbConnected = true;
	Models.Application.getAll(function(err, results) {
		if (err) {
			console.log("Fatal error: ".red, err);
			return;
		}

		async.each(results, function(item, c){
			app.applications[item.id] = item;
			c();
		});
	});

	app.use(security.corsValidation);
	app.use(security.contentTypeValidation);
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
				stack: err.stack,
				message: err.message
			}));
		});
	}

	// production error handler
	// no stacktraces leaked to user
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.send(JSON.stringify({
			status: err.status || 500,
			message: err.message
		}));
	});

	//signal sent by nodemon when restarting the server
	process.on('SIGUSR2', function() {
		app.kafkaClient.close();
	});

};

async.waterfall([
	function DataBucket(callback) {
		Models.Application.datasource.dataStorage.onReady(function() {
			callback();
		});
	},
	function RedisClient(callback) {
		if (Models.Application.redisClient)
			Models.Application.redisClient = null;

		Models.Application.redisClient = redis.createClient(redisConfig.port, redisConfig.host);
		Models.Application.redisClient.on('error', function(err) {
			console.log('Failed'.bold.red+' connecting to Redis "'+redisConfig.host+'": '+err.message);
			console.log('Retrying...');
		});
		Models.Application.redisClient.on('ready', function() {
			console.log('Client connected to Redis.'.green);
			callback();
		});
	},
	function Kafka(callback) {
		console.log('Waiting for Zookeeper connection...');
		app.kafkaClient = new kafka.Client(app.kafkaConfig.host+':'+app.kafkaConfig.port+'/', app.kafkaConfig.clientName);
		app.kafkaClient.on('ready', function() {
			console.log('Client connected to Zookeeper.'.green);

			app.kafkaProducer = new kafka.HighLevelProducer(app.kafkaClient);
			app.kafkaProducer.on('error', function() {});

			callback();
		});
		app.kafkaClient.on('error', function() {
			console.log('Kafka broker not available.'.red+' Trying to reconnect.');
		});
	}
], OnServicesConnect);

module.exports = app;
