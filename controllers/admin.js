/* jshint maxlen: 120 */

var express = require('express');
var router = express.Router();

var adminRoute = require('./admin/admin');
var appRoute = require('./admin/app');

var security = require('./security');
var Models = require('telepat-models');
var crypto = require('crypto');

var unless = function(paths, middleware) {
	return function(req, res, next) {
		var excluded = false;
		for (var i=0; i<paths.length; i++) {
			if (paths[i] === req.path) {
				excluded = true;
			}
		}
		if (excluded) {
			return next();
		} else {
			return middleware(req, res, next);
		}
	};
};

router.use('/', adminRoute);
router.use('/app', appRoute);

router.use('/contexts', 
	security.tokenValidation, 
	security.applicationIdValidation, 
	security.adminAppValidation);
/**
 * @api {get} /admin/contexts GetContexts
 * @apiDescription Get all contexsts
 * @apiName AdminGetContexts
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization 
                       The authorization token obtained in the login endpoint. 
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": [{
 * 			"name": "Episode 1",
 * 			"state": 0,
 * 			"meta": {},
 * 			"type": "context",
 * 			"application_id": "20"
 * 		},
 * 		...
 * 		]
 * 	}
 *
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 500,
 * 		"message": "Could not get contexts"
 * 	}
 *
 */
router.get('/contexts', function (req, res) {
	var appId = req._telepat.applicationId;

	Models.Context.getAll(appId, function (err, res1) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not get contexts'});
		else {
			res.status(200).json({status: 200, content: res1});
		}
	});
});

router.use('/context', 
	security.tokenValidation, 
	security.applicationIdValidation, 
	security.adminAppValidation);
/**
 * @api {post} /admin/context GetContext
 * @apiDescription Retrieves a context
 * @apiName AdminGetContext
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization 
                       The authorization token obtained in the login endpoint. 
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} id ID of the context to get
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"id": 1
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			"name": "Episode 1",
 * 			"state": 0,
 * 			"meta": {},
 * 			"type": "context",
 * 			"application_id": "20"
 * 		}
 * 	}
 *
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 500,
 * 		"message": "Could not get context"
 * 	}
 *
 */
router.post('/context', function (req, res) {
	if (!req.body.id) {
		return res.status(400).json({status: 400, message: 'Requested context ID is missing'}).end();
	}

	Models.Context(req.body.id, function (err, res1) {
		if (err && err.status == 404)
			res.status(404).json({status: 404, message: 'Context not found'}).end();
		else if (err)
			res.status(500).send({status: 500, message: 'Could not get context'});
		else {
			res.status(200).json({status: 200, content: res1}).end();
		}
	});
});

router.use('/context/add', 
	security.tokenValidation, 
	security.applicationIdValidation, 
	security.adminAppValidation);
/**
 * @api {post} /admin/context/add CreateContext
 * @apiDescription Creates a new context
 * @apiName AdminCreateContext
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization 
                       The authorization token obtained in the login endpoint. 
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} appId ID of the application
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"name": "Episode 2",
 * 		"meta": {"info": "some meta info"}
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			"name": "Episode 2",
 * 			"state": 0,
 * 			"meta": {"info": "some meta info"},
 * 			"type": "context",
 * 			"application_id": "20"
 * 		}
 * 	}
 *
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status" 500,
 * 		"message": "Could not add context"
 * 	}
 *
 */
router.post('/context/add', function (req, res) {
	if (Object.getOwnPropertyNames(req.body).length === 0)
		return res.status(400).json({status: 400, message: 'Request body is empty'}).end();

	var newContext = req.body;
	newContext['application_id'] = req._telepat.applicationId;
	Models.Context.create(newContext, function (err, res1) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not add context'});
		else {
			res.status(200).json({status: 200, content: res1}).end();
		}
	});
});

router.use('/context/remove', 
	security.tokenValidation, 
	security.applicationIdValidation, 
	security.adminAppValidation);
/**
 * @api {post} /admin/context/remove RemoveContext
 * @apiDescription Removes a context and all associated objects
 * @apiName AdminRemoveContext
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization 
                       The authorization token obtained in the login endpoint. 
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} id ID of the context to remove
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"id": 1
 * 	}
 *
 * 	@apiError (500) Error Context not found or internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status" 500,
 * 		"message": "Could not remove context"
 * 	}
 *
 */
router.post('/context/remove', function (req, res) {
	if (!req.body.id) {
		res.status(400).json({status: 400, message: 'Requested context ID is missing'}).end();
		return;
	}

	Models.Context.delete(req.body.id, function (err, res1) {
		if (err && err.status == 404)
			res.status(404).json({status: 404, message: 'Context does not exist'}).end();
		else if (err)
			res.status(500).send({status: 500, message: err.message});
		else {
			res.status(200).json({status: 200, content: 'Context removed'});
		}
	});
});

router.use('/context/update', 
	security.tokenValidation, 
	security.applicationIdValidation, 
	security.adminAppValidation);
/**
 * @api {post} /admin/context/update UpdateContext
 * @apiDescription Updates the context object
 * @apiName AdminUpdateContext
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization 
                       The authorization token obtained in the login endpoint. 
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} id ID of the context to update
 * @apiParam {Array} patches An array of patches
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"id": 1,
 * 		"patches": [
 * 			{
 * 				"op": "replace",
 * 				"path": "context/context_id/field_name",
 * 				"value" "New value"
 * 			}
 * 		]
 * 	}
 *
 * 	@apiError (500) Error Context not found or internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 500,
 * 		"message": "Could not update context"
 * 	}
 *
 */
router.post('/context/update', function (req, res) {
	if (!req.body.id) {
		res.status(400)
				.json({status: 400, message: 'Requested context ID is missing'}).end();
		return;
	}

	if (!req.body.patches) {
		res.status(400)
				.json({status: 400, message: 'Requested patches array is missing'}).end();
		return;
	}

	async.waterfall([
		function(callback) {
			Models.Context(req.body.id, callback);
		},
		function(context, callback) {
			if (app.applications[context.application_id].admins.indexOf(req.user.id) === -1) {
				res.status(403).send({status: 403, message: 'This context does not belong to you'}).end();
				callback();
			} else {
				Models.Context.update(req.body.id, req.body.patches, function (err, res1) {
					if (err && err.status == 404)
						res.status(404)
							.send({status: 404, message: 'Context with id \''+req.body.id+'\' does not exist'}).end();
					else if (err)
						res.status(500).send({status: 500, message: 'Could not update context'}).end();
					else {
						res.status(200).json({status: 200, content: 'Context updated'}).end();
					}
					callback();
				});
			}
		}
	], function (err, result) {
			if (err) {
				res.status(404)
						.send({status: 404, message: 'Context with id \''+req.body.id+'\' does not exist'}).end();
			}
	});
});

router.use('/schemas', 
	security.tokenValidation, 
	security.applicationIdValidation, 
	security.adminAppValidation);
/**
 * @api {post} /admin/schemas GetSchemas
 * @apiDescription Gets the model schema for an application
 * @apiName AdminGetSchemas
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization 
                       The authorization token obtained in the login endpoint. 
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content" :{
 * 			"answer": {
 *   		"namespace": "answers",
 *   		"type": "answer",
 *   		"properties": {},
 *   		"belongsTo": [
 *     			{
 *       			"parentModel": "event",
 *       			"relationType": "hasSome"
 *     			}
 *   		],
 *   		"read_acl": 6,
 *   		"write_acl": 6,
 *   		"meta_read_acl": 6
 * 		},
 * 		...
 * 		}
 * 	}
 *
 */
router.get('/schemas', function(req, res, next) {
	var appId = req._telepat.applicationId;

	Models.Application.getAppSchema(appId, function(err, result) {
		if (err){
			next(err);
		} else {
			res.status(200).json({status: 200, content: result}).end();
		}
	});
});

router.use('/schema/update', 
	security.tokenValidation, 
	security.applicationIdValidation, 
	security.adminAppValidation);
/**
 * @api {post} /admin/schema/update UpdateSchema
 * @apiDescription Updates the model schema
 * @apiName AdminUpdateSchema
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization 
                       The authorization token obtained in the login endpoint. 
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Object} schema Updated schema object
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"schema": "see example at /schemas"
 * 	}
 *
 * @apiError 404 NotFound If the App ID doesn't exist
 */
router.post('/schema/update', function(req, res, next) {
	if (!req.body.schema) {
		res.status(400)
				.json({status: 400, message: 'Requested schema object is missing'}).end();
		return;
	}

	var appId = req._telepat.applicationId;
	var schema = req.body.schema;

	Models.Application.updateSchema(appId, schema, function(err, result) {
		if (err){
			next(err);
		} else {
			app.applications[appId].schema = schema;
			res.status(200).json({status: 200, content: 'Schema updated'}).end();
		}
	});
});

router.use('/schema/remove_model', 
	security.tokenValidation, 
	security.applicationIdValidation, 
	security.adminAppValidation);
/**
 * @api {post} /admin/schema/remove_model RemoveAppModel
 * @apiDescription Removes a model from the application (all items of this type will be deleted)
 * @apiName AdminRemoveAppModel
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization 
                       The authorization token obtained in the login endpoint. 
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Object} schema Updated schema object
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"model_name": "events"
 * 	}
 *
 * @apiError 404 NotFound If the App ID doesn't exist
 * @apiError 404 NotFound If the App does not have a model with that name
 */
router.post('/schema/remove_model', function(req, res, next) {
	if (!req.body.model_name) {
		res.status(400).json({status: 400, message: 'Requested model name object is missing'}).end();
		return;
	}

	var appId = req._telepat.applicationId;
	var modelName = req.body.model_name;

	if (!app.applications[appId].schema[modelName]) {
		res.status(404)
			.json({
				status: 404, 
				message: 'Application with ID '+appId+' does not have a model named '+modelName
			}).end();
		return;
	}

	Models.Application.deleteModel(appId, modelName, function(err) {
		if (err){
			next(err);
		} else {
			delete app.applications[appId].schema[modelName];
			res.status(200).json({status: 200, content: 'Schema updated'}).end();
		}
	});
});

router.use('/users', 
	security.tokenValidation, 
	security.applicationIdValidation, 
	security.adminAppValidation);
/**
 * @api {get} /admin/users GetAppusers
 * @apiDescription Gets all users of the app
 * @apiName AdminGetUsers
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization 
                       The authorization token obtained in the login endpoint. 
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content" : [
 * 			{//user props}, ...
 * 		]
 * 	}
 *
 * @apiError 404 NotFound If the App ID doesn't exist
 */

router.get('/users', function(req, res, next) {
	var appId = req._telepat.applicationId;

	Models.User.getAll(appId, function(err, results) {
		if (err) return next(err);

		results.forEach(function(item, index, originalArray) {
			delete originalArray[index].password;
		});

		res.status(200).json({status: 200, content: results}).end();
	});
});

router.use('/user/update', 
	security.tokenValidation, 
	security.applicationIdValidation, 
	security.adminAppValidation);
/**
 * @api {post} /admin/user/update EditUser
 * @apiDescription Updates an user from an app
 * @apiName AdminUpdateUser
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization 
                       The authorization token obtained in the login endpoint. 
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Object} user The object that contains the user (must contain the email to identify him)
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"patches": [
 * 			{
 * 				"op": "replace",
 * 				"path": "user/user_id/field_name",
 * 				"value": "new value
 * 			}
 * 		]
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content" : [
 * 			{//user props}, ...
 * 		]
 * 	}
 *
 */
router.post('/user/update', function(req, res, next) {
	var patches = req.body.patches;

	if (!patches) {
		res.status(400)
				.json({status: 400, message: 'Patches array missing from request body'}).end();
		return;
	}

	if (!req.body.email) {
		res.status(400).json({status: 400, message: 'Email missing from request body'}).end();
		return;
	}

	async.series([
		function(callback) {
			var i = 0;
			async.each(patches, function(patch, c) {
				if (patches[i].path.split('/')[2] == 'password') {
					security.encryptPassword(patches[i].value, function(err, hash) {
						if (err) return c(err);
						patches[i].value = hash;
						i++;
						c();
					});
				} else {
					i++;
					c();
				}
			}, callback);
		},
		function(callback) {
			Models.User.update(req.body.email, req._telepat.applicationId, patches, function(err) {
				if (err && err.status == 404) {
					var error = new Error('User not found');
					error.status = 404;
					callback(error);
				} else if (err)
					return callback(err);
				else
					callback();

			});
		}
	], function(err) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: 'User has been updated'}).end();
	});
});

router.use('/user/delete', 
	security.tokenValidation, 
	security.applicationIdValidation, 
	security.adminAppValidation);
/**
 * @api {post} /admin/user/delete Deleteuser
 * @apiDescription Deketes an user from an app
 * @apiName AdminDeleteUser
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization 
                       The authorization token obtained in the login endpoint. 
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {String} email The email address of an user from an app
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"email": "user@example.com"
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content" : "User deleted"
 * 	}
 *
 * @apiError 404 NotFound If the App ID doesn't exist
 * @apiError 404 NotFound If the User does not belong to this application
 */
router.post('/user/delete', function(req, res, next) {
	if (!req.body.email) {
		res.status(400).json({status: 400, message: 'Requested email address is missing'}).end();
		return;
	}

	var appId = req._telepat.applicationId;
	var userEmail = req.body.email;

	async.waterfall([
		function(callback) {
			Models.User(userEmail, appId, callback);
		},
		function(user, callback) {
			if (user.application_id != appId) {
				var error = new Error('User does not belong to this application');
				error.code = 404;

				return callback(error);
			} else {
				Models.User.delete(userEmail, appId, callback);
			}
		}
	], function(error, results) {
		if (error && error.status == 404)
			return res.status(404).json({status: 404, message: 'User not found'}).end();
		else if (error) return next(error);

		if (results) {
			async.each(results, function(item, c) {
				var context = item.context_id;
				var mdl = item.value.type;
				var id = item.value.id;

				app.kafkaProducer.send([{
					topic: 'aggregation',
					messages: [JSON.stringify({
						op: 'delete',
						object: {path: mdl+'/'+id},
						context: context,
						applicationId: appId
					})],
					attributes: 0
				}], c);
			});
		}

		res.status(202).json({status: 202, content: 'User deleted'}).end();
	});
});

module.exports = router;