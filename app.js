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

app.set('port', process.env.PORT || 3000);

app.kafkaConfig = require('./config/kafka.json');
app.kafkaClient = new kafka.Client(app.kafkaConfig.host+':'+app.kafkaConfig.port+'/', app.kafkaConfig.clientName);
app.kafkaProducer = new kafka.HighLevelProducer(app.kafkaClient);

app.kafkaClient.on('error', function(err) {
	console.log(err)
});

app.kafkaClient.on('state', function (state) {
	console.log(state);
});

app.kafkaProducer.on('error', function(err) {
	console.log(err)
});

app.set('datasources', require('./config/datasources'));
app.ModelsConfig = Models.getModels();

ds = app.get('datasources');
app.set('database', {
	Couchbase: new cb.Cluster('couchbase://'+ds.couchbase.host)
});
db = app.get('database');
db.Couchbase.bucket = db.Couchbase.openBucket(ds.couchbase.bucket);
db.Couchbase.stateBucket = db.Couchbase.openBucket(ds.couchbase.stateBucket);

Models.Application.setBucket(db.Couchbase.bucket);
Models.Application.setStateBucket(db.Couchbase.stateBucket);
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
				app.post('/subscribe/'+ mdl.toLowerCase(), function(req, res, next) {
					var id = req.body.id;
					var context = req.body.context;
					var deviceId = req.body.device_id;
					var userId = req.body.user_id;
					var userToken = req.body.user_token;
					/**
					 * {
					 * 		parent: {model: event, id: 1}
					 * 		user: 1
					 *
					 * }
					 */
					var filters = req.body.filters;

					if (!context)
						res.status(400).json({status: 400, message: "Requested context is not provided."}).end();
					else if (!deviceId)
						res.status(400).json({status: 400, message: "Requested deviceID is not provided."}).end();
					//ia-le pe toate
					else {
						async.waterfall([
							//see if device exists
							function(callback) {
								Models.Subscription.getDevice(deviceId, function(err, results) {
									if (err) {
										if (err.code == 13) {
											return callback(null, false);
										} else
											return callback(err, null);
									}

									callback(null, results);
								});
							},
							//create it if it doesn't
							function(deviceResult, callback) {
								if (deviceResult === false) {
									Models.Subscription.addDevice({id: deviceId, user_id: userId, user_token: userToken}, function(err, result) {
										callback(err, null);
									});
								} else {
									callback(null, null);
								}
							},
							//finally, add subscription
							function(result, callback) {
								var parent = {};
								var user = null;
								if (filters.parent) {
									parent.model = app.ModelsConfig[filters.parent.name].namespace;
									parent.id = filters.parent.id;
								}
								if (filters.user)
									user = filters.user;

								Models.Subscription.add(context, deviceId, {model: app.ModelsConfig[mdl].namespace, id: id}, user, parent,  callback);
							}
						], function(err, result) {
							if (err)
								return next(err);

							if(!id) {
								if (filters) {
									for (var rel in app.ModelsConfig[mdl].belongsTo) {
										var parentModelId = filters[app.ModelsConfig[mdl].belongsTo[rel].parentModel+'_id'];
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
								new Models.Model(mdl, id, context, function(err, results) {
									var message = {};
									message[id] = results.value;

									res.json({status: 200, message: message}).end();
								});
							}
						});
					}
				});

				app.post('/unsubscribe/'+ mdl.toLowerCase(), function(req, res, next) {
					var id = req.body.id;
					var context = req.body.context;
					var deviceId = req.body.device_id;
					var filters = req.body.filters;

					if (!context)
						res.status(400).json({status: 400, message: "Requested context is not provided."}).end();
					else {
						Models.Subscription.remove(context, deviceId, {model: app.ModelsConfig[mdl].namespace, id: id}, filters, function(err, results) {
							if (err && err.code == cb.errors.keyNotFound)
								res.status(404).json({status: 404, message: "Subscription not found"}).end();
							else if (err)
								return next(err);
							else
								res.status(200).json({status: 200, message: "Subscription removed"}).end();
						});
					}
				});

				app.post('/create/'+ mdl.toLowerCase(), function(req, res, next) {
					var content = req.body.content;

					content.type = mdl.toLowerCase();
					content.context_id = req.body.context;
					content.user_id = req.body.user_id;

					app.kafkaProducer.send([{
						topic: 'aggregation',
						messages: [JSON.stringify({
							op: 'add',
							object: content,
							applicationId: req.get('X-BLGREQ-APPID')
						})],
						attributes: 0
					}], function(err) {
						if (err) return next(err);

						res.status(201).json({status: 201, message: 'Created'}).end();
					});
				});

				app.post('/update/'+ mdl.toLowerCase(), function(req, res, next) {
					var context = req.body.context;
					var patch = req.body.patch;
					var id = req.body.id;

					if (! (patch instanceof Array)) {
						var error = new Error('Patch must be an array');
						error.status = 400;

						return next(error);
					}

					app.kafkaProducer.send([{
						topic: 'aggregation',
						messages: [JSON.stringify({
							op: 'edit',
							id: id,
							context: context,
							object: patch,
							type: mdl,
							applicationId: req.get('X-BLGREQ-APPID')
						})],
						attributes: 1
					}], function(err) {
						if (err) return next(err);

						res.status(200).json({status: 200, message: 'Updated'}).end();
					});
				});

				app.post('/delete/'+mdl.toLowerCase(), function(req, res, next) {
					var id = req.body.id;
					//var userId = req.body.user_id;
					var context = req.body.context;

					app.kafkaProducer.send([{
						topic: 'aggregation',
						messages: [JSON.stringify({
							op: 'delete',
							object: {id: id, type: mdl, context: context},
							applicationId: req.get('X-BLGREQ-APPID')
						})],
						attributes: 1
					}], function(err) {
						if (err) return next(err);

						res.status(200).json({status: 200, message: 'Deleted'}).end();
					});
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
