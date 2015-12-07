var express = require('express');
var router = express.Router();
var Models = require('telepat-models');
var security = require('./security');
var microtime = require('microtime-nodejs');

router.use(security.applicationIdValidation);
router.use(security.apiKeyValidation);
router.use(['/subscribe', '/unsubscribe'], security.deviceIdValidation);

router.use(['/subscribe', '/unsubscribe'], security.objectACL('read_acl'));
router.use(['/create', '/update', '/delete'], security.objectACL('write_acl'));
router.use(['/count'], security.objectACL('meta_read_acl'));

var validateContext = function(appId, context, callback) {
	Models.Application.hasContext(appId, context, function(err, result) {
		if (err)
			return callback(err);
		else if (result === false) {
			callback(new Models.TelepatError(Models.TelepatError.errors.InvalidContext, [context, appId]));
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
 * @apiVersion 0.2.7
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from device/register)
 *
 * @apiParam {Object} channel Object representing the channel
 * @apiParam {Object} filters Object representing channel filters
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
 * 		},
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
 * @apiError 400 [027]InvalidChannel When trying to subscribe to an invalid channel
 *
 */
router.post('/subscribe', function(req, res, next) {
	var page = req.body.page ? req.body.page : 1;
	var channel = req.body.channel;
	var sort = req.body.sort;

	var id = channel.id,
		context = channel.context,
		mdl = channel.model,
		parent = channel.parent,// eg: {model: "event", id: 1}
		user = channel.user,
		filters = req.body.filters,
		deviceId = req._telepat.device_id,
		appId = req._telepat.applicationId;

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
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidChannel, [channelObject.errorMessage]));
	}

	var objects = [];

	async.series([
		//verify if context belongs to app
		function(callback) {
			if (context)
				validateContext(appId, context, callback);
			else
				callback();
		},
		function(callback) {
			//only add subscription on initial /subscribe
			if (page && page > 1)
				return callback();
			Models.Subscription.add(appId, deviceId, channelObject,  function(err) {
				if (err && err.status === 409)
					return callback();

				callback(err);
			});
		},
		function(callback) {
			if (id) {
				Models.Model(mdl, appId, context, id, function(err, results) {
					if (err) return callback(err);

					objects.push(results);

					callback();
				});
			} else {
				Models.Model.search(channelObject, sort, page, function(err, results) {
					if (err) return callback(err);

					if (Array.isArray(results))
						objects = objects.concat(results);

					callback();
				});
			}
		}
		/*,
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
	], function(err) {
		if (err)
			return next(err);

		res.status(200).json({status: 200, content: objects});
	});
});

/**
 * @api {post} /object/unsubscribe Unsubscribe
 * @apiDescription Unsubscribe to an object or a collection of objects (by a filter)
 * @apiName ObjectUnsubscribe
 * @apiGroup Object
 * @apiVersion 0.2.7
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from device/register)
 *
 * @apiParam {Object} channel Object representing the channel
 * @apiParam {Object} filters Object representing the filters for the channel
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
 * @apiError 400 [027]InvalidChannel When trying to subscribe to an invalid channel
 */
router.post('/unsubscribe', function(req, res, next) {
	var channel = req.body.channel;

	var id = channel.id,
	context = channel.context,
	mdl = channel.model,
	parent = channel.parent,// eg: {model: "event", id: 1}
	user = channel.user,
	filters = req.body.filters,
	deviceId = req._telepat.device_id,
	appId = req._telepat.applicationId;

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
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidChannel, [channelObject.errorMessage]));
	}

	async.series([
		//verify if context belongs to app
		function(callback) {
			if (context)
				validateContext(appId, context, callback);
			else
				callback();
		},
		function(callback) {
			Models.Subscription.remove(appId, deviceId, channelObject, callback);
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
	], function(err) {
		if (err) {
			return next(err);
		} else {
			res.status(200).json({status: 200, content: 'Subscription removed'});
		}
	});
});

/**
 * @api {post} /object/create Create
 * @apiDescription Creates a new object. The object is not immediately created.
 * @apiName ObjectCreate
 * @apiGroup Object
 * @apiVersion 0.2.7
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
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
 */
router.post('/create', function(req, res, next) {
	var content = req.body.content;
	var mdl = req.body.model;
	var context = req.body.context;
	var appId = req._telepat.applicationId;
	var isAdmin = req.user && req.user.isAdmin;

	if (!context)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['channel.context']));

	if (req.user)
		content.user_id = req.user.id;
	content.type = mdl;
	content.context_id = context;
	content.application_id = appId;

	if (Models.Application.loadedAppModels[appId].schema[mdl].belongsTo &&
				Models.Application.loadedAppModels[appId].schema[mdl].belongsTo.length) {
		var parentModel = Models.Application.loadedAppModels[appId].schema[mdl].belongsTo[0].parentModel;
		if (!content[parentModel+'_id']) {
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, [parentModel+'_id']));
		} else if (Models.Application.loadedAppModels[appId].schema[mdl].belongsTo[0].relationType == 'hasSome' &&
			content[Models.Application.loadedAppModels[appId].schema[parentModel].hasSome_property+'_index'] === undefined) {
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField,
				[Models.Application.loadedAppModels[appId].schema[parentModel].hasSome_property+'_index']));
		}
	}

	async.series([
		function(aggCallback) {
			app.messagingClient.send([JSON.stringify({
				op: 'add',
				object: content,
				applicationId: appId,
				isAdmin: isAdmin,
				context: context
			})], 'aggregation', function(err) {
				if (err){
					err = new Models.TelepatError(Models.TelepatError.errors.ServerFailure, [err.message]);
				}
				aggCallback(err);
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
			return next(err);
		}

		res.status(202).json({status: 202, content: 'Created'});
	});
});

/**
 * @api {post} /object/update Update
 * @apiDescription Updates an existing object. The object is not updated immediately.
 * @apiName ObjectUpdate
 * @apiGroup Object
 * @apiVersion 0.2.7
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
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
 * 		"patches": [
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
 */
router.post('/update', function(req, res, next) {
	var modifiedMicrotime = microtime.now();
	var context = req.body.context;
	var patch = req.body.patches;
	var id = req.body.id;
	var mdl = req.body.model;
	var appId = req._telepat.applicationId;

	if (!id)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['id']));

	if (!context)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['context']));

	if (!Array.isArray(req.body.patches)) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" is not an array']));
	} else if (req.body.patches.length == 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" array is empty']));
	}

	async.series([
		function(aggCallback) {
			async.each(patch, function(p ,c) {
				app.messagingClient.send([JSON.stringify({
					op: 'update',
					id: id,
					context: context,
					object: p,
					type: mdl,
					applicationId: appId,
					ts: modifiedMicrotime
				})], 'aggregation', function(err) {
					if (err){
						err = new Models.TelepatError(Models.TelepatError.errors.ServerFailure, [err.message]);
					}
					c(err);
				});
			}, aggCallback);
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
	], function(err) {
		if (err) {
			return next(err);
		}

		res.status(202).json({status: 202, content: 'Updated'});
	});
});

/**
 * @api {delete} /object/delete Delete
 * @apiDescription Deletes an object. The object is not immediately deleted.
 * @apiName ObjectDelete
 * @apiGroup Object
 * @apiVersion 0.2.7
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
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
 */
router.delete('/delete', function(req, res, next) {
	var id = req.body.id;
	var context = req.body.context;
	var mdl = req.body.model;
	var appId = req._telepat.applicationId;

	if (!id)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['id']));

	if (!context)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['context']));

	async.series([
		function(aggCallback) {
			app.messagingClient.send([JSON.stringify({
				op: 'delete',
				object: {path: mdl+'/'+id},
				context: context,
				applicationId: appId
			})], 'aggregation', aggCallback);
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
	], function(err) {
		if (err) return next(err);

		res.status(202).json({status: 202, content: 'Deleted'});
	});
});

/**
 * @api {post} /object/count Count
 * @apiDescription Gets the object count of a certain filter/subscription
 * @apiName ObjectCount
 * @apiGroup Object
 * @apiVersion 0.2.7
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 *
 * @apiParam {Object} channel The object representing a channel
 * @apiParam {Object} filters Additional filters to the subscription channel
 *
 */
router.post('/count', function(req, res, next) {
	var appId = req._telepat.applicationId,
		channel = req.body.channel;
	var aggregation = req.body.aggregation;

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
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidChannel));
	}

	Models.Model.modelCountByChannel(channelObject, aggregation, function(err, result) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: result});
	});
});

module.exports = router;
