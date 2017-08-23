/* jshint maxlen: 120 */
var express = require('express');
var router = express.Router();
var security = require('./security');
var async = require('async');
var tlib  = require('telepat-models')
router.use(security.applicationIdValidation);
router.use(security.apiKeyValidation);

var contextGetAll = function (req, res, next) {
	var appId = req._telepat.applicationId;

	tlib.contexts.getAll(appId, (err, res1) => {
		if (err)
			next(err);
		else {
			res.status(200).json({status: 200, content: res1});
		}
	});
};

/**
 * @api {post} /context/all GetContexts
 * @apiDescription Get all contexts
 * @apiName GetContexts
 * @apiGroup Context
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 *
 * @apiParam {Number} offset (optional) Starting offset (default: 0)
 * @apiParam {Number} limit (optional) Number of objects to return (default: depends on API configuration)
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"offset": 0,
 * 		"limit": 64
 * 	}
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
 */
router.post('/all', contextGetAll);

/**
 * @api {get} /context/all GetContexts (Deprecated)
 * @apiDescription Get all contexts. This is deprecated as it doesn't offer any limit/offset params.
 * @apiName GetContextsDeprecated
 * @apiGroup Context
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
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
 */
router.get('/all', contextGetAll);

/**
 * @api {post} /context GetContext
 * @apiDescription Retrieves a context
 * @apiName GetContext
 * @apiGroup Context
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
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
 * 	@apiError (404) [020]ContextNotFound Context not found
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"code": "020",
 * 		"message": "Context not found",
 * 		"status": 404
 * 	}
 *
 */
router.post('/', function (req, res, next) {
	if (!req.body.id) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['id']));
	}

	tlib.contexts.get(req.body.id,  (err, res1) => {
		if (err && err.status == 404){
			return next(new tlib.TelepatError(tlib.TelepatError.errors.ContextNotFound));
		} else if (err)
			next(err);
		else {
			res.status(200).json({status: 200, content: res1});
		}
	});
});

module.exports = router;
