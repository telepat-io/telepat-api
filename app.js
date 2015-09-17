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

var envVariables = {
	TP_KFK_HOST: process.env.TP_KFK_HOST,
	TP_KFK_PORT: process.env.TP_KFK_PORT,
	TP_KFK_CLIENT: process.env.TP_KFK_CLIENT,
	TP_REDIS_HOST: process.env.TP_REDIS_HOST,
	TP_REDIS_PORT: process.env.TP_REDIS_PORT,
	TP_MAIN_DB: process.env.TP_MAIN_DB,
	TP_PW_SALT: process.env.TP_PW_SALT
};

var validEnvVariables = true;
var mainConfiguration = {};
var redisConfig = {};
var mainDatabase = null;

for(var varName in envVariables) {
	if (envVariables[varName] === undefined) {
		console.log('Missing'.yellow+' environment variable "'+varName+'". Trying configuration file.');
		try {
			mainConfiguration = require('./config.json');
		} catch (e) {
			if (e.code == 'MODULE_NOT_FOUND') {
				console.log('Fatal error:'.red+' configuration file is missing or not accessible. Please add a configuration file from the example.');
				process.exit(-1);
			} else
				throw e;
		}

		validEnvVariables = false;
		break;
	}
}

if (validEnvVariables) {
	app.kafkaConfig = {
		host: envVariables.TP_KFK_HOST,
		port: envVariables.TP_KFK_PORT,
		clientName: envVariables.TP_KFK_CLIENT
	};
	redisConfig = {
		host: envVariables.TP_REDIS_HOST,
		port: envVariables.TP_REDIS_PORT
	};
	mainDatabase = envVariables.TP_MAIN_DB;
	//is null just so the adapter constructor will try to check envVariables
	mainConfiguration[mainDatabase] = null;
} else {
	app.kafkaConfig = mainConfiguration.kafka;
	redisConfig = mainConfiguration.redis;
	mainDatabase = mainConfiguration.main_database;
}

Models.Application.datasource = new Models.Datasource();
Models.Application.datasource.setMainDatabase(new Models[mainDatabase](mainConfiguration[mainDatabase]));

app.set('password_salt', mainConfiguration.password_salt);

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
			res.json({
				status: err.status || 500,
				stack: err.stack,
				message: err.message
			}).end();
		});
	}

	// production error handler
	// no stacktraces leaked to user
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.json({
			status: err.status || 500,
			message: err.message
		}).end();
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
