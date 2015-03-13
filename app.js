var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cb = require('couchbase');
var App = require('./models/Application');
var crypto = require('crypto');
var async = require('async');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

app.set('datasources', require('./config/datasources'));

ds = app.get('datasources');
app.set('database', {
	Couchbase: new cb.Cluster('couchbase://'+ds.couchbase.host)
});
db = app.get('database');
db.Couchbase.bucket = db.Couchbase.openBucket(ds.couchbase.bucket);

db.Couchbase.bucket.on('connect', function() {
	async.series([
		function(cb) {
			db.Couchbase.bucket.upsert('blg.application.1', JSON.stringify({"name": "Test app", "keys": ["1bc29b36f623ba82aaf6724fd3b16718"]}), cb);
		},
		function(cb) {
			app.dbApp = new App.Application(app, 1, cb);
		}
	], function(err, results) {
		if (err) {
			console.log(err.message);
		}

		app.use(logger('dev'));
		app.use(bodyParser.json());
		app.use(bodyParser.urlencoded({ extended: false }));
		app.use(cookieParser());

		app.use(function(req, res, next) {
			res.set('Content-type', 'application/json');
			if (req.get('Content-type') !== 'application/json')
				res.status(415).send(JSON.stringify({status: 415, message: {content: "Request content type must pe application/json."}}));
			else if (req.get('X-BLGREQ-SIGN') == undefined)
				res.status(401).send(JSON.stringify({status: 401, message: {content: "Unauthorized. Required authorization header not present."}}));
			else {
				var clientHash = req.get('X-BLGREQ-SIGN');
				var serverHash = null;
				var apiKeys = app.dbApp.get('apiKeys');

				async.detect(apiKeys, function(item ,cb) {
					serverHash = crypto.createHash('sha256').update(item).digest('hex').toLowerCase();
					cb(serverHash === clientHash);
				}, function(result) {
					if (result)
						next();
					else
						res.status(401).send(JSON.stringify({status: 401, message: {content: "Unauthorized. API key is not valid."}}));
				});
			}
		});

		app.use('/', routes);
		app.use('/users', users);

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
	});
});

module.exports = app;
