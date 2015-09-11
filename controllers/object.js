var express = require('express');
var router = express.Router();
var Models = require('telepat-models');
var sizeof = require('object-sizeof');
var security = require('./security');
var microtime = require('microtime-nodejs');

router.use(security.applicationIdValidation);
router.use(security.apiKeyValidation);
router.use(security.deviceIdValidation);

router.use(security.tokenValidation);

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
			error.status = 401;
			callback(error);
		} else
			callback();
	});
};

/**
 * @api {post} /object/subscribe Subscribe
 * @apiDescription Subscribe to an object or a collection of objects (by a filter). Returns a the resulting object(s).
 * Subsequent subscription on the same channel and filter will have no effect but will return the objects.
 * @apiName ObjectSubscribe
 * @apiGroup Object
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiParam {Object} channel Object representing the channel
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
 * 		"status": 200,
 * 		"content": [
 * 			{
 * 				//item properties
 * 			}
 * 		]
 * 	}
 *
 * @apiError 401 <code>NotAuthenticated</code> Only authenticated users may access this endpoint.
 * @apiError 404 <code>NotFound</code> If <code>id</code> was supplied but object not found or device is not registered.
 * @apiError 400 <code>RequestedContextMissing</code> If context id is missing from the request body
 * @apiError 400 <code>RequestedChannelMissing</code> If the channel object is missing from the request body
 * @apiError 400 <code>RequestedModelMissing</code> If the item model is not present from the request body
 */
router.post('/subscribe', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0)
		return res.status(400).json({status: 400, message: "Request body is empty"}).end();

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
		elasticQuery = filters ? true : false;

	if (!context)
		return res.status(400).json({status: 400, message: "Requested context is missing."}).end();

	if (!mdl)
		return res.status(400).json({status: 400, message: "Requested object model is missing."}).end();

	if (!Models.Application.loadedAppModels[appId][mdl])
		return res.status(404).json({status: 404, message: 'Application model "'+mdl+'" does not exist.'}).end();

	var channelObject = new Models.Channel(appId);

	if (id) {
		channelObject.model(mdl, id);
	} else {
		channelObject.model(mdl);

		if (context)
			channelObject.context(context);

		if (parent)
			channelObject.parent(parent);

		if (user)
			channelObject.user(user);

		if (filters)
			channelObject.setFilter(filters);
	}

	if (!channelObject.isValid()) {
		var error = new Error('Could not subscribe to invalid channel');
		error.status = 400;

		return next(error);
	}

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

				callback();
			});
		},
		function(callback) {
			Models.Subscription.add(deviceId, channelObject,  function(err) {
				if (err && err.status === 409)
					return callback();

				callback(err);
			});
		},
		function(callback) {
			if (id) {
				new Models.Model(mdl, context, appId, id, context, function(err, results) {
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
						},
						_source: ['doc.*']
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
						index: 'couchbasereplica',
						type: 'couchbaseDocument',
						body: elasticSearchQuery
					}, function(err, result) {
						if (err) return callback(err);

						callback(null, result.hits.hits);
					});
				//no filters
				} else {
					Models.Model.lookup(channelObject, function(err, results) {
						if (err)
							return callback(err);

						if (results.length) {
							Models.Model.multiGet(mdl, results, appId, context, callback);
						} else {
							callback(null, []);
						}
					});
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
						},
						_source: ['doc.*']
					};

					elasticSearchQuery.query.filtered.filter = Models.utils.parseQueryObject(filters);
					app.get('elastic-db').client.search({
						index: 'couchbasereplica',
						type: 'couchbaseDocument',
						body: elasticSearchQuery
					}, function(err, result) {
						if (err) return callback(err);

						callback(null, result.hits.hits);
					});
				//with no filters
				} else {
					Models.Model.getAll(mdl, appId, context, function(err, results) {
						callback(err, results);
					});
				}
			}
		}/*,
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
		}*/
	], function(err, result) {
		if (err)
			return next(err);

		if(elasticQuery) {
			var elasticsearchResult = [];
			async.each(result, function(item, c) {
				if (item._source.doc)
					elasticsearchResult.push(item._source.doc);
				c();
			}, function(err) {
				if (err)
					return next(err);

				res.json({status: 200, content: elasticsearchResult}).end();
			});
		} else {
			res.json({status: 200, content: result}).end();
		}
	});
});

/**
 * @api {post} /object/unsubscribe Unsubscribe
 * @apiDescription Unsubscribe to an object or a collection of objects (by a filter)
 * @apiName ObjectUnsubscribe
 * @apiGroup Object
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiParam {Object} channel Object representing the channel
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
 * 		"content": "Subscription removed"
 * 	}
 *
 * @apiError 401 <code>NotAuthenticated</code>  Only authenticated users may access this endpoint.
 * @apiError 404 <code>NotFound</code> If device hasn't subscribed to this channel or if application model is not valid (doesn't exist)
 * @apiError 400 <code>RequestedContextMissing</code> If context id is missing from the request body
 * @apiError 400 <code>RequestedChannelMissing</code> If the channel object is missing from the request body
 * @apiError 400 <code>RequestedModelMissing</code> If the item model is not present from the request body
 */
router.post('/unsubscribe', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0)
		return res.status(400).json({status: 400, message: "Request body is empty"}).end();

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
	deviceId = req._telepat.device_id,
	appId = req._telepat.application_id;

	if (!context)
		return res.status(400).json({status: 400, message: "Requested context is missing."}).end();

	if (!mdl)
		return res.status(400).json({status: 400, message: "Requested object model is missing."}).end();

	if (!Models.Application.loadedAppModels[appId][mdl])
		return res.status(404).json({status: 404, message: 'Application model "'+mdl+'" does not exist.'}).end();

	var channelObject = new Models.Channel(appId);

	if (id) {
		channelObject.model(mdl, id);
	} else {
		channelObject.model(mdl);

		if (context)
			channelObject.context(context);

		if (parent)
			channelObject.parent(parent);

		if (user)
			channelObject.user(user);

		if (filters)
			channelObject.setFilter(filters);
	}

	if (!channelObject.isValid()) {
		var error = new Error('Could not subscribe to invalid channel');
		error.status = 400;

		return next(error);
	}

	async.waterfall([
		//verify if context belongs to app
		function(callback) {
			validateContext(appId, context, callback);
		},
		function(callback) {
			Models.Subscription.remove(deviceId, channelObject, function(err, results) {
				if (err)
					callback(err, null);
				else
					callback(null, {status: 200, content: "Subscription removed"});
			});
		}/*,
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
		}*/
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
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiParam {String} model The type of object to subscribe to
 * @apiParam {Object} content Content of the object
 *
 * @apiExample {json} Client Request
 * {
 * 		"model": "comment",
 * 		"context": 1,
 * 		"content": {
 *			//object properties
 * 		}
 * }
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 202,
 * 		"content": "Created"
 * 	}
 *
 * @apiError 401 <code>NotAuthenticated</code>  Only authenticated users may access this endpoint.
 * @apiError 404 <code>NotFound</code> If application object model doesn't exist
 * @apiError 403 <code>PermissionDenied</code> If the model requires other permissions other than the ones provided.
 * @apiError 400 <code>RequestedContextMissing</code> If context id is missing from the request body
 * @apiError 400 <code>RequestedModelMissing</code> If the item model is not present from the request body
 */
router.post('/create', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0)
		return res.status(400).json({status: 400, message: "Request body is empty"}).end();

	var content = req.body.content;
	var mdl = req.body.model;
	var context = parseInt(req.body.context);
	var appId = req._telepat.application_id;
	var isAdmin = req.user.isAdmin;

	if (!context)
		return res.status(400).json({status: 400, message: "Requested context is missing."}).end();

	if (!mdl)
		return res.status(400).json({status: 400, message: "Requested object model is missing."}).end();

	if (!Models.Application.loadedAppModels[appId][mdl])
		return res.status(404).json({status: 404, message: 'Application model "'+mdl+'" does not exist.'}).end();

	content.type = mdl;
	content.context_id = context;
	content.application_id = appId;

	if (Models.Application.loadedAppModels[appId][mdl].belongsTo && Models.Application.loadedAppModels[appId][mdl].belongsTo.length) {
		var parentModel = Models.Application.loadedAppModels[appId][mdl].belongsTo[0].parentModel;
		if (!content[parentModel+'_id']) {
			var error = new Error("'"+parentModel+"_id' is required");
			error.status = 400;

			return next(error);
		} else if (Models.Application.loadedAppModels[appId][mdl].belongsTo[0].relationType == 'hasSome' && content[Models.Application.loadedAppModels[appId][parentModel].hasSome_property+'_index'] === undefined) {
			var error = new Error("'"+Models.Application.loadedAppModels[appId][parentModel].hasSome_property+"_index is required");
			error.status = 400;

			return next(error);
		}
	}

	async.series([
		function(callback) {
			if (isAdmin) {
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
					isAdmin: isAdmin,
					context: context
				})],
				attributes: 0
			}], function(err) {
				if (err)
					err.message = "Failed to send message to aggregation worker.";
				agg_callback(err);
			});
		}/*,
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
		}*/
	], function(err, results) {
		if (err) {
			console.log(req.originalUrl+': '+err.message.red);
			return next(err);
		}

		res.status(202).json({status: 202, content: 'Created'}).end();
	});
});

/**
 * @api {post} /object/update Update
 * @apiDescription Updates an existing object
 * @apiName ObjectUpdate
 * @apiGroup Object
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
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
 * 				"path": "comment/1/text",
 * 				"value": "some edited text"
 * 			},
 * 			...
 * 		],
 * }
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 202,
 * 		"content": "Created"
 * 	}
 *
 * @apiError 401 <code>NotAuthenticated</code>  Only authenticated users may access this endpoint
 * @apiError 404 <code>NotFound</code> If <code>id</code> was supplied but object not found or application model doesn't exist
 * @apiError 403 <code>PermissionDenied</code> If the model requires other permissions other than the ones provided
 * @apiError 400 <code>RequestedContextMissing</code> If context id is missing from the request body
 * @apiError 400 <code>RequestedChannelMissing</code> If the channel object is missing from the request body
 * @apiError 400 <code>RequestedModelMissing</code> If the item model is not present from the request body
 * @apiError 400 <code>PatchNotArray</code> If the patch property of the request body is not an array
 * @apiError 400 <code>NoIdSupplied</code> If the requested item id has not been provided
 */
router.post('/update', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0)
		return res.status(400).json({status: 400, message: "Request body is empty"}).end();

	var modifiedMicrotime = microtime.now();
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

	if (!(Array.isArray(patch))) {
		var error = new Error('Patch must be an array');
		error.status = 400;

		return next(error);
	}

	async.series([
		function(agg_callback) {
			async.each(patch, function(p ,c) {
				app.kafkaProducer.send([{
					topic: 'aggregation',
					messages: [JSON.stringify({
						op: 'update',
						id: id,
						context: context,
						object: p,
						type: mdl,
						applicationId: appId,
						ts: modifiedMicrotime
					})],
					attributes: 0
				}], function(err) {
					if (err)
						err.message = 'Failed to send message to aggregation worker.';
					c(err);
				});
			}, agg_callback);
		}/*,
		function(track_callback) {
			app.kafkaProducer.send([{
				topic: 'track',
				messages: [JSON.stringify({
					op: 'update',
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
		}*/
	], function(err, results) {
		if (err) {
			console.log(req.originalUrl+': '+err.message.red);
			return next(err);
		}

		res.status(202).json({status: 202, content: 'Updated'}).end();
	});
});

/**
 * @api {post} /object/delete Delete
 * @apiDescription Deletes an object
 * @apiName ObjectDelete
 * @apiGroup Object
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
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
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 202,
 * 		"content": "Deleted"
 * 	}
 *
 * @apiError 401 <code>NotAuthenticated</code>  Only authenticated users may access this endpoint.
 * @apiError 403 <code>PermissionDenied</code> If the model requires other permissions other than the ones provided.
 * @apiError 400 <code>RequestedContextMissing</code> If context id is missing from the request body
 * @apiError 400 <code>RequestedChannelMissing</code> If the channel object is missing from the request body
 * @apiError 400 <code>RequestedModelMissing</code> If the item model is not present from the request body
 * @apiError 400 <code>NoIdSupplied</code> If the requested item id has not been provided
 */
router.post('/delete', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0)
		return res.status(400).json({status: 400, message: "Request body is empty"}).end();

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
					object: {path: mdl+'/'+id},
					context: context,
					applicationId: appId
				})],
				attributes: 0
			}], agg_callback);
		}/*,
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
		}*/
	], function(err, results) {
		if (err) return next(err);

		res.status(202).json({status: 202, content: 'Deleted'}).end();
	});
});

/**
 * @api {post} /object/count Count
 * @apiDescription Gets the object count of a certain filter/subscription
 * @apiName ObjectCount
 * @apiGroup Object
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiParam {Object} channel The object reperesenting a channel
 * @apiParam {Object} filters Additional filters to the subscription channel
 *
 * @apiError 401 <code>NotAuthenticated</code>  Only authenticated users may access this endpoint.
 * @apiError 403 <code>PermissionDenied</code> If the model requires other permissions other than the ones provided.
 */
router.post('/count', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0)
		return res.status(400).json({status: 400, message: "Request body is empty"}).end();

	var appId = req._telepat.application_id,
		channel = req.body.channel;

	var channelObject = new Models.Channel(appId);

	if (channel.model)
		channelObject.model(channel.model);

	if (channel.context)
		channelObject.context(channel.context);

	if (channel.parent)
		channelObject.parent(channel.parent);

	if (channel.user)
		channelObject.user(channel.user);

	if (req.body.filters)
		channelObject.setFilter(req.body.filters);

	if (!channelObject.isValid()) {
		var error = new Error('Could not subscribe to invalid channel');
		error.status = 400;

		return next(error);
	}

	Models.Subscription.getObjectCount(channel, function(err, result) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: result}).end();
	});
});

module.exports = router;
