/* jshint maxlen: 120 */

var express = require('express');
var router = express.Router();

var adminRoute = require('./admin/admin');
var appRoute = require('./admin/app');
var contextRoute = require('./admin/context');
var schemaRoute = require('./admin/schema');
var userRoute = require('./admin/user');

var security = require('./security');
var Models = require('telepat-models');

router.use('/', adminRoute);
router.use('/app', appRoute);
router.use('/context', contextRoute);
router.use('/schema', schemaRoute);
router.use('/user', userRoute);

router.use('/contexts',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);

var getContexts = function (req, res, next) {
	var offset = req.body ? req.body.offset : undefined;
	var limit = req.body ? req.body.limit : undefined;

	Models.Context.getAll(req._telepat.applicationId, offset, limit, function (err, res1) {
		if (err)
			next(err);
		else {
			res.status(200).json({status: 200, content: res1});
		}
	});
};

/**
 * @api {post} /admin/contexts GetContexts
 * @apiDescription Get all contexts
 * @apiName AdminGetContexts
 * @apiGroup Admin
 * @apiVersion 0.3.0
 * @deprecated
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
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
router.post('/contexts', getContexts);

/**
 * @api {get} /admin/contexts GetContexts (Deprecated)
 * @apiDescription Get all contexts. This is deprecated as it doesn't offer any limit/offset params.
 * @apiName AdminGetContextsDeprecated
 * @apiGroup Admin
 * @apiVersion 0.3.0
 * @deprecated
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
router.get('/contexts', getContexts);

router.use('/schemas',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/schemas GetSchemas
 * @apiDescription Gets the model schema for an application
 * @apiName AdminGetSchemas
 * @apiGroup Admin
 * @apiVersion 0.3.0
 * @deprecated
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
 *   			"properties": {},
 *   			"belongsTo": [
 *     				{
 *       				"parentModel": "event",
 *       				"relationType": "hasSome"
 *     				}
 *   			],
 *   			"read_acl": 6,
 *   			"write_acl": 6,
 *   			"meta_read_acl": 6
 * 			},
 * 		...
 * 		}
 * 	}
 *
 */
router.get('/schemas', function(req, res, next) {
	Models.Application.getAppSchema(req._telepat.applicationId, function(err, result) {
		if (err){
			next(err);
		} else {
			res.status(200).json({status: 200, content: result});
		}
	});
});


router.use('/users',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/users GetAppusers
 * @apiDescription Gets all users of the application
 * @apiName AdminGetUsers
 * @apiGroup Admin
 * @apiVersion 0.3.0
 * @deprecated
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
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
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content" : [
 * 			{//user props}, ...
 * 		]
 * 	}
 *
 */

router.post('/users', function(req, res, next) {
	var offset = req.body.offset;
	var limit = req.body.limit;

	Models.User.getAll(req._telepat.applicationId, limit, offset, function(err, results) {
		if (err) return next(err);

		results.forEach(function(item, index, originalArray) {
			delete originalArray[index].password;
		});

		res.status(200).json({status: 200, content: results});
	});
});

module.exports = router;
