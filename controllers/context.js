var express = require('express');
var router = express.Router();
var Models = require('octopus-models-api');
var security = require('./security');

router.use(security.keyValidation);

/**
 * @api {post} /context/all GetContexts
 * @apiDescription Get all contexsts
 * @apiName GetContexts
 * @apiGroup Context
 * @apiVersion 0.0.1
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"1": {
 * 			"name": "Episode 1",
 * 			"state": 0,
 * 			"meta": {},
 * 			"type": "context",
 * 			"application_id": "20"
 * 		},
 * 		...
 * 	}
 *
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		message: "Could not get contexts"
 * 	}
 *
 */
router.post('/all', function (req, res) {
	var appId = req.get('X-BLGREQ-APPID');

	Models.Context.getAll(appId, function (err, res1) {
		if (err)
			res.status(500).send({message: 'Could not get contexts'});
		else {
			res.json(res1);
		}
	});
});

/**
 * @api {post} /context GetContext
 * @apiDescription Retrieves a context
 * @apiName GetContext
 * @apiGroup Context
 * @apiVersion 0.0.1
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
 * 		"1": {
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
 * 		message: "Could not get context"
 * 	}
 *
 */
router.post('/', function (req, res) {
	Models.Context(req.body.id, function (err, res1) {
		if (err)
			res.status(500).send({message: 'Could not get context'});
		else {
			res.json(res1);
		}
	});
});

module.exports = router;
