var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cb = require('couchbase');
var Models = require('octopus-models-api');
var crypto = require('crypto');
var async = require('async');
var kafka = require('kafka-node');

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
				app.post('/subscribe/'+ mdl.toLowerCase(), function(req, res, next) {
					var id = req.body.id;
					var context = req.body.context;
					/**
					 * {
					 * 		event: id,	(parent)
					 * 		user: id
					 *
					 * }
					 */
					var filters = req.body.filters;

					if (!context)
						res.status(400).json({status: 400, message: "Requested context is not provided."}).end();
					//ia-le pe toate
					else if(!id) {
						if (filters) {
							for (var rel in app.ModelsConfig[mdl].belongsTo) {
								var parentModelId = filters[app.ModelsConfig[mdl].belongsTo[rel].parentModel];
								if (parentModelId !== undefined) {
									var parentModel = app.ModelsConfig[mdl].belongsTo[rel].parentModel;

									Models.Model.lookup(mdl, context, filters.user, {model: parentModel, id: parentModelId}, function(err, results) {
										if (!results) {
											res.json({status: 200, message: {}}).end();
										} else {
											results = results.slice(0, 10);

											Models.Model.multiGet(mdl, results, context, function(err, results1) {
												res.json({status: 200, message: results1}).end();
											});
										}
									});
								}
							}
						} else {
							Models.Model.getAll(mdl, context, function(err, results) {
								res.json({status: 200, message: results}).end();
							});
						}
					} else {
						Models.Model.get(mdl, id, context, function(err, results) {
							var message = {};
							message[id] = results.value;

							res.json({status: 200, message: message}).end();
						});
					}
				});

				app.post('/unsubscribe/'+ m.toLowerCase(), function(req, res, next) {

				});

				app.post('/create/'+ m.toLowerCase(), function(req, res, next) {

				});

				app.put('/update/'+ m.toLowerCase(), function(req, res, next) {

				});

			})(m);
		}
	}

	app.post('/testroute/get', function(req, res, next) {
		var id = req.body.id;
		var context = req.body.context;
		var model = req.body.model;

		new Models.Model(model, id, context, function(err, results) {
			if(err) return next(err);

			res.json(results).end();
		});
	});

	app.post('/testroute/getAll', function(req, res, next) {
		var id = req.body.id;
		var context = req.body.context;
		var model = req.body.model;

		Models.Model.getAll(model, context, function(err, results) {
			if(err) return next(err);

			res.json(results).end();
		});
	});

	app.post('/testroute/lookup', function(req, res, next) {
		var id = req.body.id;
		var context = req.body.context;
		var model = req.body.model;
		var user_id = req.body.user_id;
		var parent = req.body.parent;
		var key = req.body.answerKey;

		Models.Model.lookupWithKey(model, context, key, user_id, parent, function(err, results) {
			if(err) return next(err);

			res.json(results).end();
		});
	});

	app.post('/testroute/delete', function(req, res, next) {
		var id = req.body.id;
		var context = req.body.context;
		var model = req.body.model;
		var user_id = req.body.user_id;
		var parent = req.body.parent;

		Models.Model.delete(model, context, id, user_id, parent, function(err, results) {
			if(err) return next(err);

			res.json(results).end();
		});
	});

	app.post('/testroute/delete', function(req, res, next) {
		var id = req.body.id;
		var context = req.body.context;
		var model = req.body.model;
		var user_id = req.body.user_id;
		var parent = req.body.parent;

		Models.Model.getAll(model, context, id, user_id, parent, function(err, results) {
			if(err) return next(err);

			res.json(results).end();
		});
	});

	app.post('/testroute/count', function(req, res, next) {
		var id = req.body.id;
		var context = req.body.context;
		var model = req.body.model;
		var user_id = req.body.user_id;
		var parent = req.body.parent;

		Models.Model.count(model, function(err, results) {
			if(err) return next(err);

			res.json(results).end();
		});
	});

	app.post('/testroute/delete', function(req, res, next) {
		var id = req.body.id;
		var context = req.body.context;
		var model = req.body.model;
		var user_id = req.body.user_id;
		var parent = req.body.parent;

		Models.Model.delete(model, context, id, user_id, parent, function(err, results) {
			if(err) return next(err);

			res.json(results).end();
		});
	});

	app.post('/testroute/create', function(req, res, next) {
		var props = req.body.props;
		var context = req.body.context;
		var model = req.body.model;
		var user_id = req.body.user_id;
		var parent = req.body.parent;

		Models.Model.getAll(model, context, props, user_id, parent, function(err, results) {
			if(err) return next(err);

			res.json(results).end();
		});
	});

	app.post('/testroute/update', function(req, res, next) {
		var id = req.body.id;
		var props = req.body.props;
		var context = req.body.context;
		var model = req.body.model;
		var user_id = req.body.user_id;
		var parent = req.body.parent;

		Models.Model.getAll(model, context, props, user_id, parent, function(err, results) {
			if(err) return next(err);

			res.json(results).end();
		});
	});

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

db.Couchbase.bucket.on('error', function ErrorConnect(error) {
	console.error('Could not connect to '+ds.couchbase.host+': '+error.toString()+' ('+error.code+')');
	app.use(function(req, res) {
		res.type('application/json');
		res.status(500).json({status: 500, message: "Server failed to connect to database."});
	});
});

module.exports = app;
