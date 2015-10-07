/* jshint maxlen: 120 */

var express = require('express');
var router = express.Router();

var security = require('../security');
var Models = require('telepat-models');

router.use('/',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {get} /admin/context/all GetContexts
 * @apiDescription Get all contexts
 * @apiName AdminGetContexts
 * @apiGroup Admin
 * @apiVersion 0.2.3
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
 */
router.get('/all', function (req, res, next) {
	var appId = req._telepat.applicationId;

	Models.Context.getAll(appId, function (err, res1) {
		if (err)
			next(err);
		else {
			res.status(200).json({status: 200, content: res1});
		}
	});
});

/**
 * @api {post} /admin/context GetContext
 * @apiDescription Retrieves a context
 * @apiName AdminGetContext
 * @apiGroup Admin
 * @apiVersion 0.2.3
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
 * 	@apiError 404 [020]ContextNotFound ContextNotFound
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 *		"code": "020",
 *		"status": 404,
 *		"message": "Context not found"
 * 	}
 *
 */
router.post('/', function (req, res, next) {
	if (!req.body.id) {
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['id']));
	}

	Models.Context(req.body.id, function (err, res1) {
		if (err && err.status == 404)
			next(new Models.TelepatError(Models.TelepatError.errors.ContextNotFound));
		else if (err)
			next(err);
		else {
			res.status(200).json({status: 200, content: res1}).end();
		}
	});
});

router.use('/add',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/context/add CreateContext
 * @apiDescription Creates a new context
 * @apiName AdminCreateContext
 * @apiGroup Admin
 * @apiVersion 0.2.3
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
 */
router.post('/add', function (req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0)
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));

	var newContext = req.body;
	newContext['application_id'] = req._telepat.applicationId;
	Models.Context.create(newContext, function (err, res1) {
		if (err)
			next(err);
		else {
			res.status(200).json({status: 200, content: res1}).end();
		}
	});
});

router.use('/remove',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/context/remove RemoveContext
 * @apiDescription Removes a context and all associated objects
 * @apiName AdminRemoveContext
 * @apiGroup Admin
 * @apiVersion 0.2.3
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
 * 	@apiError 404 [020]ContextNotFound ContextNotFound
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 *		"code": "020",
 *		"status": 404,
 *		"message": "Context not found"
 * 	}
 *
 */
router.post('/remove', function (req, res, next) {
	if (!req.body.id) {
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['id']));
	}

	Models.Context.delete(req.body.id, function (err, res1) {
		if (err && err.status == 404)
			next(new Models.TelepatError(Models.TelepatError.errors.ContextNotFound));
		else if (err)
			next(err);
		else {
			res.status(200).json({status: 200, content: 'Context removed'});
		}
	});
});

router.use('/update',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/context/update UpdateContext
 * @apiDescription Updates the context object
 * @apiName AdminUpdateContext
 * @apiGroup Admin
 * @apiVersion 0.2.3
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
 * 	@apiError 404 [020]ContextNotFound ContextNotFound
 * 	@apiError 403 [021]ContextNotAllowed This context doesn't belong to you
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 *		"code": "020",
 *		"status": 404,
 *		"message": "Context not found"
 * 	}
 *
 */
router.post('/update', function (req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));
	} else if (!Array.isArray(req.body.patches)) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" is not an array']));
	} else if (req.body.patches.length == 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" array is empty']));
	} else if (!req.body.id) {
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['id']));
	} else {
		async.waterfall([
			function(callback) {
				Models.Context(req.body.id, callback);
			},
			function(context, callback) {
				if (Models.Application.loadedAppModels[context.application_id].admins.indexOf(req.user.id) === -1) {
					callback(new Models.TelepatError(Models.TelepatError.errors.ContextNotAllowed));
				} else {
					Models.Context.update(req.body.id, req.body.patches, callback);
				}
			}
		], function (err, result) {
			if (err && err.status == 404)
				next(new Models.TelepatError(Models.TelepatError.errors.ContextNotFound));
			else {
				res.status(200).json({status: 200, content: 'Context updated'}).end();
			}
		});
	}
});

module.exports = router;
