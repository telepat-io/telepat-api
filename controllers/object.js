var express = require('express');
var router = express.Router();
var Models = require('octopus-models-api');
var sizeof = require('object-sizeof');
var security = require('./security');

router.use(security.keyValidation);

/**
 * Middleware used to load application model schema
 */
router.use(function(req, res, next) {
	//roughly 67M - it self cleares so it doesn't get too big
	if (sizeof(Models.Application.loadedAppModels) > (1 << 26)) {
		delete Models.Application.loadedAppModels;
		Models.Application.loadedAppModels = {};
	}

	if (!Models.Application.loadedAppModels[req._telepat.application_id]) {
		Models.Application.loadAppModels(req._telepat.application_id, next);
	} else
		next();
});

router.use(['/subscribe', '/unsubscribe'], security.objectACL('read_acl'));
router.use(['/create', '/update', '/delete'], security.objectACL('write_acl'));
router.use(['/count'], security.objectACL('meta_read_acl'));

var validateContext = function(appId, context, callback) {
	Models.Application.hasContext(appId, context, function(err, result) {
		if (err && err.code == cb.errors.keyNotFound) {
			var error = new Error('Application with id "'+appId+'" does not exist.');
			error.status = 404;
			callback(error);
		} else if (err) return callback(err)
		else if (result === false) {
			var error = new Error('Context with id "'+context+'" does not belong to app with id "'+appId+'"');
			error.status = 404;
			callback(error);
		} else
			callback();
	});
};

/**
 * @api {post} /object/subscribe Subscribe
 * @apiDescription Subscribe to an object or a collection of objects (by a filter)
 * @apiName ObjectSubscribe
 * @apiGroup Object
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} id ID of the object (optional)
 * @apiParam {Number} context Context of the object
 * @apiParam {String} model The type of object to subscribe to
 * @apiParam {Object} filters Author or parent model filters by ID.
 *
 * @apiExample {json} Client Request
 * {
 * 		"channel": {
 * 			"id": 1,
 * 			"context": 1,
 *			"model": "comment",
 *			"parent": {
 *				"id": 1,
 *				"model": "event"
 *			},
 *			"user": 2
 * 		}
 *		"filters": {
*			"or": [
*				{
*					"and": [
*						{
*						  "is": {
*							"gender": "male",
*							"age": 23
*						  }
*						},
*						{
*						  "range": {
*							"experience": {
*							  "gte": 1,
*							  "lte": 6
*							}
*						  }
*						}
*					  ]
*					},
*					{
*					  "and": [
*						{
*						  "like": {
*							"image_url": "png",
*							"website": "png"
*						  }
*						}
*					  ]
*					}
*				  ]
 *		}
 * }
 *
 *	@apiSuccessExample {json} Success Response
 * 	{
 * 		"1": {
 * 			//item properties
 * 		}
 * 	}
 *
 * @apiError 402 NotAuthenticated  Only authenticated users may access this endpoint.
 * @apiError 404 NotFound If <code>id</code> was supplied but object not found or device is not registered.
 * @apiError 400 RequestedContextMissing If context id has been provided
 */
router.post('/subscribe', function(req, res, next) {
	var channel = req.body.channel;

	if (!channel) {
		return res.status(400).json({status: 400, message: "Requested channel field is missing."}).end();
	}

	var id = channel.id,
		context = channel.context,
		mdl = channel.model,
		parent = channel.parent,// eg: {model: "event", id: 1}
		user = channel.user,
		filters = req.body.filters,
		userEmail = req.user.email,
		deviceId = req._telepat.device_id,
		appId = req._telepat.application_id,
		elasticQuery = false,
		elasticQueryResult = null;

	if (!context)
		return res.status(400).json({status: 400, message: "Requested context is missing."}).end();

	if (!mdl)
		return res.status(400).json({status: 400, message: "Requested object model is missing."}).end();

	if (!Models.Application.loadedAppModels[appId][mdl])
		return res.status(404).json({status: 404, message: 'Application model "'+mdl+'" does not exist.'}).end();

	async.waterfall([
		//verify if context belongs to app
		function(callback) {
			validateContext(appId, context, callback);
		},
		//see if device exists
		function(callback) {
			Models.Subscription.getDevice(deviceId, function(err, results) {
				if (err) {
					if (err.code == 13) {
						var error = new Error('Device is not registered');
						error.status = 404;
						return callback(error);
					} else
						return callback(err);
				}

				callback(null, results);
			});
		},
		function(subscriptions, callback) {
			Models.Subscription.add(appId, deviceId, channel, filters,  function(err) {
				if (err && err.status === 409)
					return callback();

				callback(err);
			});
		},
		function(callback) {
			if (id) {
				new Models.Model(mdl, appId, id, context, function(err, results) {
					if (err) return callback(err, null);

					var message = {};
					message[id] = results.value;

					callback(null, message)
				});
				return;
			}

			//we have a channel
			if (parent || user) {
				//with filters
				if (filters) {
					elasticQuery = true;
					var userQuery = {};
					var parentQuery = {};
					var elasticSearchQuery = {
						query: {
							filtered: {
								query: {
									bool: {
										must: [
											{term: {'doc.type': mdl}},
											{term: {'doc.context_id': context}}
										]
									}
								}
							}
						}
					};

					if (user) {
						userQuery['doc.user_id'] = user;
						elasticSearchQuery.query.filtered.query.bool.must.push({term: userQuery});
					}

					if(parent) {
						parentQuery['doc.'+parent.model+'_id'] = parent.id;
						elasticSearchQuery.query.filtered.query.bool.must.push({term: parentQuery});
					}

					elasticSearchQuery.query.filtered.filter = Models.utils.parseQueryObject(filters);
					app.get('elastic-db').client.search({
						index: 'default',
						type: 'couchbaseDocument',
						body: elasticSearchQuery
					}, function(err, result) {
						if (err) return callback(err);

						elasticQueryResult = result.hits.hits;
						callback();
					});
				//no filters
				} else {
					if (Models.Application.loadedAppModels[appId][mdl].belongsTo) {
						if (Models.Application.loadedAppModels[appId][mdl].belongsTo[0].parentModel !== parent.model) {
							Models.Model.lookup(mdl, appId, context, user, parent, function(err, results) {
								if (!results) {
									callback(err, results);
								} else {
									Models.Model.multiGet(mdl, results, appId, context, callback);
								}
							});
						}
					}
				}
			//no channel (AKA all items)
			} else {
				//with filters
				if (filters) {
					var elasticSearchQuery = {
						query: {
							filtered: {
								query: {
									bool: {
										must: [
											{term: {'doc.type': mdl}},
											{term: {'doc.context_id': context}}
										]
									}
								}
							}
						}
					};

					elasticSearchQuery.query.filtered.filter = Models.utils.parseQueryObject(filters);
					app.get('elastic-db').client.search({
						index: 'default',
						type: 'couchbaseDocument',
						body: elasticSearchQuery
					}, function(err, result) {
						if (err) return callback(err);

						elasticQueryResult = result.hits.hits;
						callback();
					});
				//with no filters
				} else {
					Models.Model.getAll(mdl, appId, context, function(err, results) {
						callback(err, results);
					});
				}
			}
		},
		function(results, callback) {
			app.kafkaProducer.send([{
				topic: 'track',
				messages: [JSON.stringify({
					op: 'sub',
					object: {device_id: deviceId, user_id: userEmail, channel: channel, filters: filters},
					applicationId: appId
				})],
				attributes: 0
			}], function(err) {
				if (err)
					err.message = "Failed to send message to track worker.";
				callback(err, results);
			});
		}
	], function(err, result) {
		if (err)
			return next(err);

		if(elasticQuery) {
			result = {};
			async.each(elasticQueryResult.applicationId.hits.hits, function(item, c) {
				result[item._source.doc.id] = item._source.doc;
				c();
			}, function(err) {
				res.json({status: 200, message: result}).end();
			});
		} else {
			res.json({status: 200, message: result}).end();
		}
	});
});

/**
 * @api {post} /object/unsubscribe Unsubscribe
 * @apiDescription Unsubscribe to an object or a collection of objects (by a filter)
 * @apiName ObjectUnsubscribe
 * @apiGroup Object
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} id ID of the object (optional)
 * @apiParam {Number} context Context of the object
 * @apiParam {String} model The type of object to subscribe to
 * @apiParam {Object} filters Author or parent model filters by ID.
 *
 * @apiExample {json} Client Request
 * {
 * 		//exactly the same as with the subscribe method
 * }
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"message": "Subscription removed"
 * 	}
 *
 * @apiError 402 NotAuthenticated  Only authenticated users may access this endpoint.
 * @apiError 404 NotFound If subscription doesn't exist.
 */
router.post('/unsubscribe', function(req, res, next) {
	var channel = req.body.channel;

	if (!channel) {
		return res.status(400).json({status: 400, message: "Requested channel field is missing."}).end();
	}

	var id = channel.id,
	context = channel.context,
	mdl = channel.model,
	filters = req.body.filters,
	deviceId = req._telepat.device_id,
	appId = req._telepat.application_id;

	if (!context)
		return res.status(400).json({status: 400, message: "Requested context is missing."}).end();

	if (!mdl)
		return res.status(400).json({status: 400, message: "Requested object model is missing."}).end();

	if (!Models.Application.loadedAppModels[appId][mdl])
		return res.status(404).json({status: 404, message: 'Application model "'+mdl+'" does not exist.'}).end();

	async.waterfall([
		//verify if context belongs to app
		function(callback) {
			validateContext(appId, context, callback);
		},
		function(callback) {
			Models.Subscription.remove(appId, deviceId, channel, filters, function(err, results) {
				if (err && err.code == cb.errors.keyNotFound) {
					var error = new Error("Subscription not found");
					error.status = 404;

					callback(error, null);
				}	else if (err)
					callback(err, null);
				else
					callback(null, {status: 200, message: "Subscription removed"});
			});
		},
		function(result, callback) {
			app.kafkaProducer.send([{
				topic: 'track',
				messages: [JSON.stringify({
					op: 'unsub',
					object: {device_id: deviceId, channel: channel, filters: filters},
					applicationId: appId
				})],
				attributes: 0
			}], function(err, data) {
				if (err)
					err.message = "Failed to send message to track worker.";

				callback(err, result);
			});
		}
	], function(err, results) {
		if (err) return next(err);

		res.status(200).json(results).end();
	});
});

/**
 * @api {post} /object/create Create
 * @apiDescription Creates a new object
 * @apiName ObjectCreate
 * @apiGroup Object
 * @apiVersion 0.0.1
 *
 * @apiParam {String} model The type of object to subscribe to
 * @apiParam {Object} content Content of the object
 *
 * @apiExample {json} Client Request
 * {
 * 		"model": "comment",
 * 		"content": {
 *			//object properties
 * 		}
 * }
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 201,
 * 		"message": "Created"
 * 	}
 *
 * @apiError NotAuthenticated  Only authenticated users may access this endpoint.
 * @apiError NotFound If <code>id</code> was supplied but object not found.
 * @apiError PermissionDenied If the model requires other permissions other than the ones provided.
 */
router.post('/create', function(req, res, next) {
	var content = req.body.content;
	var mdl = req.body.model;
	var context = req.body.context;
	var appId = req._telepat.application_id;
	var isAdmin = false;

	if (!context)
		return res.status(400).json({status: 400, message: "Requested context is missing."}).end();

	if (!mdl)
		return res.status(400).json({status: 400, message: "Requested object model is missing."}).end();

	if (!Models.Application.loadedAppModels[appId][mdl])
		return res.status(400).json({status: 400, message: 'Application model "'+mdl+'" does not exist.'}).end();

	content.type = mdl;
	content.context_id = context;

	if (Models.Application.loadedAppModels[appId][mdl].belongs_to) {
		var parentModel = Models.Application.loadedAppModels[appId][mdl].belongs_to[0].parentModel;
		if (!content[parentModel+'_id']) {
			var error = new Error("'"+parentModel+"_id' is required");
			error.status = 400;

			return next(error);
		}
	}

	async.series([
		function(callback) {
			if (req.user.isAdmin) {
				Models.Admin(req.user.email, function(err, result) {
					if (err) return callback(err);
					content.user_id = result.id;
					isAdmin = true;
					callback();
				});
			} else {
				Models.User(req.user.email, function(err, result) {
					if (err) return callback(err);
					content.user_id = result.id;
					callback();
				});
			}
		},
		function(agg_callback) {
			app.kafkaProducer.send([{
				topic: 'aggregation',
				messages: [JSON.stringify({
					op: 'add',
					object: content,
					applicationId: appId,
					isAdmin: isAdmin
				})],
				attributes: 0
			}], function(err) {
				if (err)
					err.message = "Failed to send message to aggregation worker.";
				agg_callback(err);
			});
		},
		function(track_callback) {
			app.kafkaProducer.send([{
				topic: 'track',
				messages: [JSON.stringify({
					op: 'add',
					object: content,
					applicationId: appId,
					isAdmin: isAdmin
				})],
				attributes: 0
			}], function(err) {
				if (err)
					err.message = "Failed to send message to track worker.";
				track_callback(err);
			});
		}
	], function(err, results) {
		if (err) {
			console.log(req.originalUrl+': '+err.message.red);
			return next(err);
		}

		res.status(201).json({status: 201, message: 'Created'}).end();
	});
});

/**
 * @api {post} /object/update Update
 * @apiDescription Updates an existing object
 * @apiName ObjectUpdate
 * @apiGroup Object
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} id ID of the object (optional)
 * @apiParam {Number} context Context of the object
 * @apiParam {String} model The type of object to subscribe to
 * @apiParam {Array} patch An array of patches that modifies the object
 *
 * @apiExample {json} Client Request
 * {
 * 		"model": "comment",
 * 		"id": 1,
 * 		"context": 1,
 * 		"patch": [
 * 			{
 * 				"op": "replace",
 * 				"path": "text",
 * 				"value": "some edited text"
 * 			},
 * 			...
 * 		],
 * }
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 201,
 * 		"message": "Created"
 * 	}
 *
 * @apiError NotAuthenticated  Only authenticated users may access this endpoint.
 * @apiError NotFound If <code>id</code> was supplied but object not found.
 * @apiError PermissionDenied If the model requires other permissions other than the ones provided.
 */
router.post('/update', function(req, res, next) {
	var context = req.body.context;
	var patch = req.body.patch;
	var id = req.body.id;
	var mdl = req.body.model;
	var appId = req._telepat.application_id;

	if (!id)
		return res.status(400).json({status: 400, message: "Requested item id is missing."}).end();

	if (!context)
		return res.status(400).json({status: 400, message: "Requested context is missing."}).end();

	if (!mdl)
		return res.status(400).json({status: 400, message: "Requested object model is missing."}).end();

	if (!Models.Application.loadedAppModels[appId][mdl])
		return res.status(400).json({status: 400, message: 'Application model "'+mdl+'" does not exist.'}).end();

	if (! (patch instanceof Array)) {
		var error = new Error('Patch must be an array');
		error.status = 400;

		return next(error);
	}

	async.series([
		function(agg_callback) {
			app.kafkaProducer.send([{
				topic: 'aggregation',
				messages: [JSON.stringify({
					op: 'edit',
					id: id,
					context: context,
					object: patch,
					type: mdl,
					applicationId: appId
				})],
				attributes: 0
			}], function(err) {
				if (err)
					err.message = 'Failed to send message to aggregation worker.';
				agg_callback(err);
			});
		},
		function(track_callback) {
			app.kafkaProducer.send([{
				topic: 'track',
				messages: [JSON.stringify({
					op: 'edit',
					id: id,
					context: context,
					object: patch,
					type: mdl,
					applicationId: appId
				})],
				attributes: 0
			}], function(err) {
				if (err)
					err.message = 'Failed to send message to track worker.';
				track_callback(err);
			});
		}
	], function(err, results) {
		if (err) {
			console.log(req.originalUrl+': '+err.message.red);
			return next(err);
		}

		res.status(200).json({status: 200, message: 'Updated'}).end();
	});
});

/**
 * @api {post} /object/delete Delete
 * @apiDescription Deletes an object
 * @apiName ObjectDelete
 * @apiGroup Object
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} id ID of the object (optional)
 * @apiParam {Number} context Context of the object
 * @apiParam {String} model The type of object to delete
 *
 * @apiExample {json} Client Request
 * {
 * 		"model": "comment",
 * 		"id": 1,
 * 		"context": 1
 * }
 *
 * @apiError NotAuthenticated  Only authenticated users may access this endpoint.
 * @apiError NotFound If <code>id</code> was supplied but object not found.
 * @apiError PermissionDenied If the model requires other permissions other than the ones provided.
 */
router.post('/delete', function(req, res, next) {
	var id = req.body.id;
	var context = req.body.context;
	var mdl = req.body.model;
	var appId = req._telepat.application_id;

	if (!id)
		return res.status(400).json({status: 400, message: "Requested item id is missing."}).end();

	if (!context)
		return res.status(400).json({status: 400, message: "Requested context is missing."}).end();

	if (!mdl)
		return res.status(400).json({status: 400, message: "Requested object model is missing."}).end();

	if (!Models.Application.loadedAppModels[appId][mdl])
		return res.status(400).json({status: 400, message: 'Application model "'+mdl+'" does not exist.'}).end();

	async.series([
		function(agg_callback) {
			app.kafkaProducer.send([{
				topic: 'aggregation',
				messages: [JSON.stringify({
					op: 'delete',
					object: {id: id, type: mdl, context: context},
					applicationId: appId
				})],
				attributes: 0
			}], agg_callback);
		},
		function(track_callback) {
			app.kafkaProducer.send([{
				topic: 'track',
				messages: [JSON.stringify({
					op: 'delete',
					object: {op: 'remove', path: mdl+'/'+id},
					applicationId: appId
				})],
				attributes: 0
			}], track_callback);
		}
	], function(err, results) {
		if (err) return next(err);

		res.status(200).json({status: 200, message: 'Deleted'}).end();
	});
});

/**
 * @api {post} /object/count Count
 * @apiDescription Gets the object count of a certain filter/subscription
 * @apiName ObjectCount
 * @apiGroup Object
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} context Context of the object
 * @apiParam {String} model The type of object to subscribe to
 * @apiParam {Object} channel asdsadas
 *
 * @apiError NotAuthenticated  Only authenticated users may access this endpoint.
 * @apiError NotFound If <code>id</code> was supplied but object not found.
 * @apiError PermissionDenied If the model requires other permissions other than the ones provided.
 */
router.post('/count', function(req, res, next) {
	var appId = req._telepat.application_id,
		channel = req.body.channel,
		filters = req.body.filters;

	Models.Subscription.getObjectCount(appId, channel, filters, function(err, result) {
		if (err) return next(err);

		res.status(200).json({status: 200, message: result}).end();
	});
});

module.exports = router;
