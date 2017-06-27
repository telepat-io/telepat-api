/* jshint maxlen: 120 */

var express = require('express');
var async = require('async');
var router = express.Router();

var security = require('../security');
var Models = require('telepat-models');
var microtime = require('microtime-nodejs');

router.use('/all',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/user/all GetAppUsers
 * @apiDescription Gets all users of the application
 * @apiName AdminGetUsers
 * @apiGroup Admin
 * @apiVersion 0.4.0
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
 * @apiError 404 [011]ApplicationNotFound If the application doesn't exist
 */

router.post('/all', function(req, res, next) {
	var appId = req._telepat.applicationId;
	var offset = req.body.offset;
	var limit = req.body.limit;

	Models.User.getAll(appId, offset, limit, function(err, results) {
		if (err) return next(err);

		results.forEach(function(item, index, originalArray) {
			delete originalArray[index].password;
		});

		res.status(200).json({status: 200, content: results});
	});
});

router.use('/search',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);

/**
 * @api {post} /admin/user/search SearchAppUsers
 * @apiDescription Search app users by any field
 * @apiName AdminSearchUsers
 * @apiGroup Admin
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
 The authorization token obtained in the login endpoint.
 Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Object} fields The fields after which to filter the results. It will search for text that contains the exact string
 * @apiParam {Number} offset (optional) Starting offset (default: 0)
 * @apiParam {Number} limit (optional) Number of objects to return (default: depends on API configuration)
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"fields": {
 * 			"username": "nit"
 * 		},
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
 * @apiError 404 [011]ApplicationNotFound If the application doesn't exist
 */
router.post('/search', function(req, res, next) {
	var appId = req._telepat.applicationId;
	var offset = req.body.offset;
	var limit = req.body.limit;
	var fields = req.body.fields || {};

	if (!(fields instanceof Object))
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue, ['"fields" must be an object']));

	Models.User.search(appId, fields, offset, limit, function(err, result) {
		if (err) {
			next(err);
		} else {
			res.status(200).json({status: 200, content: result});
		}
	});
});

router.use('/update',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/user/update UserUpdate
 * @apiDescription Updates an user from an application
 * @apiName AdminUpdateUser
 * @apiGroup Admin
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Object[]} patches Array of patches containing describing the updates
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
 * 		"content" : "User has been updated"
 * 	}
 *
 * @apiError 404 [023]UserNotFound If the user doesn't exist.
 *
 */
router.post('/update', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));
	} else if (!Array.isArray(req.body.patches)) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" is not an array']));
	} else if (req.body.patches.length == 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" array is empty']));
	}

	var patches = req.body.patches;
	var timestamp = microtime.now();

	async.series([
		function(callback) {
			async.forEachOf(patches, function(patch, i, c) {
				if (patches[i].path.split('/')[2] == 'password') {
					security.encryptPassword(patches[i].value, function(err, hash) {
						if (err) return c(err);
						patches[i].value = hash;
						c();
					});
				} else
					c();
			}, callback);
		},
		function(callback) {
			Models.User.update(patches, function(err) {
				if (err && err.status == 404) {
					callback(new Models.TelepatError(Models.TelepatError.errors.UserNotFound));
				} else if (err)
					return callback(err);
				else
					callback();
			});
		},
		function(callback) {
			app.messagingClient.send([JSON.stringify({
				op: 'update',
				patches: patches,
				application_id: req._telepat.applicationId,
				instant: true,
				timestamp: timestamp
			})], 'aggregation', function(err) {
				if (err)
					Models.Application.logger.warning('Could not send message to aggregation workers: '+err.message);
			});
			callback();
		}
	], function(err) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: 'User has been updated'});
	});
});

router.use('/delete',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {delete} /admin/user/delete UserDelete
 * @apiDescription Deletes an user from an application
 * @apiName AdminDeleteUser
 * @apiGroup Admin
 * @apiVersion 0.4.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {String} username The username of an user from an application
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"id": "98404bf3-f810-43a6-b6c2-ee18ac2061fe"
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 202,
 * 		"content" : "User deleted"
 * 	}
 *
 */
router.delete('/delete', function(req, res, next) {
	if (!req.body.id) {
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['id']));
	}

	var appId = req._telepat.applicationId;
	var id = req.body.id;
	var user = null;
	var timestamp = microtime.now();

	async.series([
		function(callback) {
			app.messagingClient.send([JSON.stringify({
				op: 'delete',
				object: {id: id, model: 'user'},
				application_id: appId,
				timestamp: timestamp
			})], 'aggregation', function(err) {
				if (err)
					Models.Application.logger.warning('Could not send message to aggregation workers: '+err.message);
			});
			callback();
		}
		// function(callback) {
		// 	Models.User.delete(req.body.id, appId, function(err, res2){
		// 		if (err) {
		// 			return next(err);
		// 		} else {
		// 			res.status(202).json({status: 202, content: "User deleted"});
		// 		}
		// 	});
		// }
	], function(error) {
		if (error)
			return next(error);
		else
			res.status(202).json({status: 202, content: 'User deleted'});
	});
});

module.exports = router;
