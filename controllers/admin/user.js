/* jshint maxlen: 120 */

var express = require('express');
var router = express.Router();

var security = require('../security');
var Models = require('telepat-models');

router.use('/all',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/user/all GetAppUsers
 * @apiDescription Gets all users of the application
 * @apiName AdminGetUsers
 * @apiGroup Admin
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiExample {json} Client Request
 *
 * {
 * 		"page": 1
 * }
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
	var page = req.body.page ? req.body.page : 1;

	Models.User.getAll(appId, page, function(err, results) {
		if (err) return next(err);

		results.forEach(function(item, index, originalArray) {
			delete originalArray[index].password;
		});

		res.status(200).json({status: 200, content: results}).end();
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
 * @apiVersion 0.2.3
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
	} else if (!req.body.email) {
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['email']));
	}

	var patches = req.body.patches;

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
					callback(new Models.TelepatError(Models.TelepatError.errors.UserNotFound));
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

router.use('/delete',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/user/delete UserDelete
 * @apiDescription Deletes an user from an application
 * @apiName AdminDeleteUser
 * @apiGroup Admin
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {String} email The email address of an user from an application
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
 * @apiError 404 [023]UserNotFound If the user doesn't exist.
 */
router.post('/delete', function(req, res, next) {
	if (!req.body.email) {
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['email']));
	}

	var appId = req._telepat.applicationId;
	var userEmail = req.body.email;

	async.waterfall([
		function(callback) {
			Models.User(userEmail, appId, callback);
		},
		function(user, callback) {
			Models.User.delete(userEmail, appId, callback);
		}
	], function(error, results) {
		if (error && error.status == 404)
			return next(new Models.TelepatError(Models.TelepatError.errors.UserNotFound));
		else if (error) return next(error);

		if (results) {
			async.each(results, function(item, c) {
				var context = item.context_id;
				var mdl = item.value.type;
				var id = item.value.id;

				app.messagingClient.send([JSON.stringify({
					op: 'delete',
					object: {path: mdl+'/'+id},
					context: context,
					applicationId: appId
				})], 'aggregation', c);
			});
		}

		res.status(200).json({status: 200, content: 'User deleted'}).end();
	});
});

module.exports = router;
