var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cb = require('couchbase');
var Models = require('octopus-models-api');
var crypto = require('crypto');
var async = require('async');

var app = express();

app.set('datasources', require('./config/datasources'));
app.ModelsConfig = Models.getModels();

ds = app.get('datasources');
app.set('database', {
	Couchbase: new cb.Cluster('couchbase://'+ds.couchbase.host)
});
db = app.get('database');
db.Couchbase.bucket = db.Couchbase.openBucket(ds.couchbase.bucket);

Models.Application.setBucket(db.Couchbase.bucket);
Models.Model.load(app);
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

	app.use(logger('dev'));
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(cookieParser());

	app.use(function ClientValidation(req, res, next) {
		res.type('application/json');
		if (req.get('Content-type') !== 'application/json')
			res.status(415).json({status: 415, message: {content: "Request content type must pe application/json."}}).end();
		else if (req.get('X-BLGREQ-SIGN') == undefined)
			res.status(401).json({status: 401, message: {content: "Unauthorized. Required authorization header not present."}}).end();
		else if (!req.get('X-BLGREQ-APPID'))
			res.status(400).json({staus: 400, message: {content: "Requested App ID not found."}}).end();
		else {
			var clientHash = req.get('X-BLGREQ-SIGN').toLowerCase();
			var serverHash = null;
			var apiKeys = app.applications[req.get('X-BLGREQ-APPID')].keys;

			async.detect(apiKeys, function(item ,cb) {
				serverHash = crypto.createHash('sha256').update(item).digest('hex').toLowerCase();
				cb(serverHash === clientHash);
			}, function(result) {
				if (result)
					next();
				else
					res.status(401).json({status: 401, message: {content: "Unauthorized. API key is not valid."}}).end();
			});
		}
	});

	for (var m in app.ModelsConfig) {
		if (app.ModelsConfig.hasOwnProperty(m) && m != 'Application' && m != 'Context') {
			(function(mdl) {
				/**
				 * {
					 * 		id: 1, //id of the model
					 * 		user_id: 1,
					 *
					 * }
				 */
				app.post('subscribe/'+ m.toLowerCase(), function(req, res, next) {
					var id = req.body.id;

					//ia-le pe toate
					/*if(!id) {
						Models.Model.getAll
					} else {

					}*/

					/*var model = Models.Model.get(mdl, app, function(err, result) {
						if (err)
							return next(err);



						res.json(result.value).end();
					});*/
				});

				app.post('create/'+ m.toLowerCase(), function(req, res, next) {

				});

			})(m);
		}
	}

	app.post('/get/contexts', function(req, res, next) {
		var id = req.body.id;

		if (!id) {
			Models.Context.getAll(function(err, results) {
				if (err)
					return next(err);

				res.json({status: 200, message: results}).end();
			});
		} else {
			Models.Context.getOne(id, function(err, result) {
				if (err) return next(err);

				var responseBody = {status: 200, message: {}};
				responseBody.message[id] = result.value;

				res.json(responseBody).end();
			});
		}
	});

	/*app.post('/event/:id', function(req, res, next) {
	 var ev = new Models.Event(db.Couchbase.bucket, req.params.id, function(err, result) {
	 if (err) next();

	 res.json({status: 200, content: ev.toObject()}).end();
	 });
	 });
	 app.post('/event/:id/answers', function(req, res, next) {
	 var ev = new Models.Event(db.Couchbase.bucket, req.params.id, function(err, result) {
	 if (err)  {
	 next(err);

	 return;
	 }

	 Models.Event.getAllAnswers(ev.get('id'), function(err, results) {
	 if (err) {
	 next(err);
	 return ;
	 }

	 res.json({status: 200, content: results.value}).end();
	 });
	 });
	 });*/

	/*app.use(function(req, res, next) {

	});*/

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

	async.series([
		function(cb) {

		}
	], function(err, results) {
		if (err) {
			console.log(err.message);
		}


	});
});

module.exports = app;
