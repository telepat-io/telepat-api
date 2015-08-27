var express = require('express');
var router = express.Router();
var Models = require('telepat-models');
var security = require('./security');

router.use(security.applicationIdValidation);
router.use(security.apiKeyValidation);
router.use(security.deviceIdValidation);
router.use(security.tokenValidation);

/**
 * @api {get} /context/all GetContexts
 * @apiDescription Get all contexsts
 * @apiName GetContexts
 * @apiGroup Context
 * @apiVersion 0.2.0
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": [
 * 			{
 * 				"name": "Episode 1",
 * 				"state": 0,
 * 				"meta": {},
 * 				"type": "context",
 * 				"application_id": "20"
 * 			},
 * 			...
 * 		]
 * 	}
 *
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"message": "Could not get contexts",
 * 		"status": 500
 * 	}
 *
 */
router.get('/all', function (req, res) {
	var appId = req._telepat.application_id;

	Models.Context.getAll(appId, function (err, res1) {
		if (err)
			res.status(500).send({message: 'Could not get contexts'});
		else {
			res.json({status: 200, content: res1});
		}
	});
});

/**
 * @api {post} /context GetContext
 * @apiDescription Retrieves a context
 * @apiName GetContext
 * @apiGroup Context
 * @apiVersion 0.2.0
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
 * 		"content": [
 * 			{
 * 				"name": "Episode 1",
 * 				"state": 0,
 * 				"meta": {},
 * 				"type": "context",
 * 				"application_id": "20"
 * 			}
 * 		]
 * 	}
 *
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"message": "Could not get context"
 * 		"status": 500
 * 	}
 *
 */
router.post('/', function (req, res, next) {
	if (!req.body.id)
		return res.status(400).json({status: 400, message: "Requested context ID is missing"}).end();

	Models.Context(req.body.id, function (err, res1) {
		if (err && err.code === cb.errors.keyNotFound){
			res.status(404).json({status: 404, message: "Context not found"}).end();
		} else if (err)
			next(err);
		else {
			res.status(200).json({status: 200, content: res1}).end();
		}
	});
});

module.exports = router;
