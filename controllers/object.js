var express = require('express');
var router = express.Router();
var Models = require('telepat-models');
var security = require('./security');
var microtime = require('microtime-nodejs');
var clone = require('clone');
var async = require('async');

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
 * @apiVersion 0.4.0
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
 * @apiParam {Object} sort Object representing the sort order by a field
 * @apiParam {Number} offset (optional) Starting offset (default: 0)
 * @apiParam {Number} limit (optional) Number of objects to return (default: depends on API configuration)
 * @apiParam {Boolean} no_subscribe (optional) If set to truethful value the device will not be subscribed, only objects
 * will be returned.
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
 *		},
 *		"sort": {
 *			"points": "desc"
 *		},
 *		"offset": 0,
 *		"limit": 64
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
	var offset = req.body.offset;
	var limit = req.body.limit;
	var channel = req.body.channel;
	var sort = req.body.sort;
	var noSubscribe = req.body.no_subscribe;

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


	//only valid for application objects
	if (Models.Channel.builtInModels.indexOf(mdl) === -1 && !(req.user && req.user.isAdmin)) {
		var appSchema = Models.Application.loadedAppModels[appId].schema;

		if (appSchema[mdl]['read_acl'] & 8) {
			if ((appSchema[mdl]['write_acl'] & 8) && !req.user) {
				return next(new Models.TelepatError(Models.TelepatError.errors.OperationNotAllowed));
			}

			addAuthorFilters(channelObject, appSchema, mdl, req.user.id);
		}
	}

	if (!channelObject.isValid()) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidChannel, [channelObject.errorMessage]));
	}

	var objects = [];

	if (mdl === 'breakingnews') {
		console.log(Date.now(), '====== (CONTROLLER) DEVICE  ' + req._telepat.device_id + ' SUBSCRIBED TO BREAKINGNEWS', req.body);
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
			//only add subscription on initial /subscribe
			if ((offset && offset > 0) || noSubscribe)
				return callback();
			Models.Subscription.add(appId, deviceId, channelObject,  function(err) {
				if (err && err.status === 409)
					return callback();

				callback(err);
			});
		},
		function(callback) {
			if (id) {
				Models.Model(id, function(err, results) {
					if (err) return callback(err);

					objects.push(results);

					callback();
				});
			} else {
				Models.Model.search(channelObject, sort, offset, limit, function(err, results) {
					if (err) return callback(err);

					if (Array.isArray(results))	{
						if (mdl == 'user') {
							results = results.map(function(userResult) {
								delete userResult.password;

								if (!(req.user && req.user.isAdmin)) {
									delete userResult.email;
									delete userResult.username;
								}

								return userResult;
							});
						}
						objects = objects.concat(results);
					}

					callback();
				});
			}
		}
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
 * @apiVersion 0.4.0
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

	if (mdl === 'breakingnews') {
		console.log(Date.now(), '====== (CONTROLLER) DEVICE  ' + req._telepat.device_id + ' UNSUBSCRIBED TO BREAKINGNEWS', req.body);
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
 * @apiVersion 0.4.0
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
	var modifiedMicrotime = microtime.now();
	var content = req.body.content;
	var mdl = req.body.model;
	var context = req.body.context;
	var appId = req._telepat.applicationId;

	if (!context)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['context']));
	if (!content)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['content']));

	if (req.user)
		content.user_id = req.user.id;
	content.type = mdl;
	content.context_id = context;
	content.application_id = appId;

	if (Models.Application.loadedAppModels[appId].schema[mdl].belongsTo &&
				Models.Application.loadedAppModels[appId].schema[mdl].belongsTo.length) {

		var parentValidation = false;

		for (var parent in Models.Application.loadedAppModels[appId].schema[mdl].belongsTo) {
			var parentModel = Models.Application.loadedAppModels[appId].schema[mdl].belongsTo[parent].parentModel;

			if (content[parentModel+'_id']) {
				parentValidation = true;

				if (Models.Application.loadedAppModels[appId].schema[mdl].belongsTo[0].relationType == 'hasSome' &&
					content[Models.Application.loadedAppModels[appId].schema[parentModel].hasSome_property+'_index'] === undefined ||
					content[Models.Application.loadedAppModels[appId].schema[parentModel].hasSome_property+'_index'] === null) {
					return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField,
						[Models.Application.loadedAppModels[appId].schema[parentModel].hasSome_property+'_index']));
				}

				break;
			}
		}

		if (!parentValidation)
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['a field with the parent ID is missing']));

	}

	var hasSomeProperty = Models.Application.loadedAppModels[appId].schema[mdl].hasSome_property;

	if(hasSomeProperty && !content[hasSomeProperty])
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, [hasSomeProperty]));

	async.series([
		function(aggCallback) {
			app.messagingClient.send([JSON.stringify({
				op: 'create',
				object: content,
				application_id: appId,
				timestamp: modifiedMicrotime
			})], 'aggregation', function(err) {
				if (err){
					err = new Models.TelepatError(Models.TelepatError.errors.ServerFailure, [err]);
				}
				aggCallback(err);
			});
		}
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
 * @apiVersion 0.4.0
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
	var patch = req.body.patches;
	var appId = req._telepat.applicationId;

	if (!Array.isArray(req.body.patches)) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" is not an array']));
	} else if (req.body.patches.length == 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" array is empty']));
	}

	var appSchema = Models.Application.loadedAppModels[appId].schema;

	var obj = {
		op: 'update',
		patches: patch,
		application_id: appId,
		timestamp: modifiedMicrotime
	};

	if (!(req.user && req.user.isAdmin)) {
		for(var p in patch) {
			var objectMdl = patch[p].path.split('/')[0];

			if (patch[p].path.split('/')[2] == 'user_id') {
				return next(Models.TelepatError(Models.TelepatError.errors.InvalidPatch, ['"user_id" cannot be modified"']));
			}
			if ((appSchema[objectMdl]['write_acl'] & 8) && !req.user) {
				return next(new Models.TelepatError(Models.TelepatError.errors.OperationNotAllowed));
			} else if (appSchema[objectMdl]['write_acl'] & 8) {
				patch[p].user_id = req.user.id;
			}
		}
	}

	async.series([
		function(aggCallback) {
			app.messagingClient.send([JSON.stringify(obj)], 'aggregation', function(err) {
				if (err){
					err = new Models.TelepatError(Models.TelepatError.errors.ServerFailure, [err.message]);
				}
				aggCallback(err);
			});
		}
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
 * @apiVersion 0.4.0
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
	var modifiedMicrotime = microtime.now();
	var id = req.body.id;
	var mdl = req.body.model;
	var appId = req._telepat.applicationId;

	if (!id)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['id']));

	var appSchema = Models.Application.loadedAppModels[appId].schema;

	var obj = {
		op: 'delete',
		object: {
			model: mdl,
			id: id
		},
		application_id: appId,
		timestamp: modifiedMicrotime
	};

	if (!(req.user && req.user.isAdmin)) {
		if ((appSchema[mdl]['write_acl'] & 8) && !req.user) {
			return next(new Models.TelepatError(Models.TelepatError.errors.OperationNotAllowed));
		} else if (appSchema[mdl]['write_acl'] & 8) {
			obj.user_id = req.user.id;
		}
	}

	async.series([
		function(aggCallback) {
			app.messagingClient.send([JSON.stringify(obj)], 'aggregation', aggCallback);
		}
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
 * @apiVersion 0.4.0
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
		channel = req.body.channel,
		mdl = channel.model;

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

	var appSchema = Models.Application.loadedAppModels[appId].schema;

	if (mdl !== 'user' && appSchema[mdl]['read_acl'] & 8) {
		if (!req.user.id) {
			return next(Models.TelepatError(Models.TelepatError.errors.OperationNotAllowed));
		}

		addAuthorFilters(channelObject, appSchema, mdl, req.user.id);
	}

	if (!channelObject.isValid()) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidChannel));
	}

	Models.Model.modelCountByChannel(channelObject, aggregation, function(err, result) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: result});
	});
});

function addAuthorFilters(channelObject, appSchema, mdl, userId) {
	if (channelObject.filter) {
		if (!channelObject.filter.and && !channelObject.filter.or) {
			channelObject.filter.and = [];
		}

		var operator = Object.keys(channelObject.filter || {})[0] || null;

		//we need to wrap this in an and in order for the author filter to work correctly
		if (operator == 'or') {
			var filterClone = clone(channelObject.filter);
			channelObject.filter = {and: [filterClone]};
		}
	} else {
		channelObject.filter = {and: []};
	}

	var idx = channelObject.filter.and.push({or: []}) - 1;

	var authorFields = (appSchema[mdl].author_fields || []).concat(['user_id']);

	authorFields.forEach(function(field) {
		var isFilter = {is: {}};
		isFilter.is[field] = userId;
		channelObject.filter.and[idx].or.push(isFilter);
	});
}

module.exports = router;
