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
router.get('/all', function (req, res) {
	var appId = req._telepat.applicationId;

	Models.Context.getAll(appId, function (err, res1) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not get contexts'});
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
router.post('/', function (req, res) {
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

router.use('/add', 
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
router.post('/add', function (req, res) {
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

router.use('/remove', 
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
router.post('/remove', function (req, res) {
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

router.use('/update', 
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
router.post('/update', function (req, res) {
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

module.exports = router;