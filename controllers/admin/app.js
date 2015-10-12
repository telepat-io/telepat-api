/* jshint maxlen: 120 */

var express = require('express');
var router = express.Router();

var security = require('../security');
var Models = require('telepat-models');

router.use('/add', security.tokenValidation);
/**
 * @api {post} /admin/app/add AppCreate
 * @apiDescription Creates a application for the admin.
                   The request body should contain the application itself.
 * @apiName AdminAppAdd
 * @apiGroup Admin
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"icon": "fa-bullhorn",
 *		"name": "The Voice",
 *		"keys": [
 *			"3406870085495689e34d878f09faf52c"
 *		]
 * 	}
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			 "admin_id": "email@example.com",
 *			 "icon": "fa-bullhorn",
 *			 "name": "The Voice",
 *			 "type": "application",
 *			 "keys": [
 *			 	"3406870085495689e34d878f09faf52c"
 *			 ]
 * 		}
 * 	}
 *
 */
router.post('/add', function (req, res, next) {
	var newApp = req.body;

	if (!newApp.name)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['name']));

	newApp['admins'] = [req.user.id];
	Models.Application.create(newApp, function (err, res1) {
		if (err)
			next(err);
		else {
			Models.Application.loadedAppModels[res1.id] = res1;
			res.status(200).json({status: 200, content: res1});
		}
	});
});

router.use('/remove',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {delete} /admin/app/remove RemoveApp
 * @apiDescription Removes an application from the admin.
 * @apiName AdminAppRemove
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
 * 		"content": "App removed"
 * 	}
 *
 * 	@apiError (404) [011]ApplicationNotFound Application with that ID doesn't exist.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"code": "011",
 * 		"status": 404,
 * 		"message": "Application with ID $APPID does not exist."
 * 	}
 *
 */
router.delete('/remove', function (req, res, next) {
	var appId = req._telepat.applicationId;

	Models.Application.delete(appId, function (err, res1) {
		if (err)
			next(err);
		else {
			delete Models.Application.loadedAppModels[appId];
			res.status(200).json({status: 200, content: 'App removed'}).end();
		}
	});
});

router.use('/update',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/app/update UpdateApp
 * @apiDescription Updates an app
 * @apiName AdminAppUpdate
 * @apiGroup Admin
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} appId ID of the app to update
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"patches": [
 * 			{
 * 				"op": "replace",
 * 				"path": "application/application_id/field_name",
 * 				"value": "new value"
 * 			}
 *		 ]
 * 	}
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": "Updated"
 * 	}
 *
 * 	@apiError (404) [011]ApplicationNotFound Application with that ID doesn't exist.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"code": "011",
 * 		"status": 404,
 * 		"message": "Application with ID $APPID does not exist."
 * 	}
 *
 */
router.post('/update', function (req, res, next) {
	var appId = req._telepat.applicationId;

	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));
	} else if (!Array.isArray(req.body.patches)) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" is not an array']));
	} else if (req.body.patches.length == 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" array is empty']));
	} else {
		Models.Application.update(appId, req.body.patches, function (err, result) {
			if (err)
				return next(err);
			else {
				Models.Application.loadedAppModels[appId] = result;
				res.status(200).json({status: 200, content: 'Updated'}).end();
			}
		});
	}
});

router.use('/authorize',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);

/**
 * @api {post} /admin/app/authorize AuthorizeAdmin
 * @apiDescription Authorizes an admin to an application
 * @apiName AdminAuthorize
 * @apiGroup Admin
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
 The authorization token obtained in the login endpoint.
 Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {string} email Email address of the admin to authorize for the application
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"email": "admin@telepat.io"
 * 	}
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": "Admin added to application"
 * 	}
 *
 * 	@apiError (404) [011]ApplicationNotFound Application with that ID doesn't exist.
 * 	@apiError (404) [033]AdminNotFound Admin with that email address does not exist
 * 	@apiError (409) [017]AdminAlreadyAuthorized Admin with email address already authorized for application
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"code": "011",
 * 		"status": 404,
 * 		"message": "Application with ID $APPID does not exist."
 * 	}
 */
router.post('/authorize', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));
	} else if (!req.body.email) {
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['email']));
	}

	var appId = req._telepat.applicationId;
	var adminEmail = req.body.email;

	async.waterfall([
		function(callback) {
			Models.Admin({email: adminEmail}, callback);
		},
		function(admin, callback) {
			if (Models.Application.loadedAppModels[appId].admins.indexOf(admin.id) !== -1) {
				return callback(new Models.TelepatError(Models.TelepatError.errors.AdminAlreadyAuthorized));
			}

			var patches = [Models.Delta.formPatch(Models.Application.loadedAppModels[appId], 'append', {admins: admin.id})];
			Models.Application.update(appId, patches, callback);
		}
	], function(err, application) {
		if (err) return next(err);

		Models.Application.loadedAppModels[appId] = application;

		res.status(200).json({status: 200, content: 'Admin added to application'}).end();
	});
});

router.use('/deauthorize',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);

/**
 * @api {post} /admin/app/deauthorize DeauthorizeAdmin
 * @apiDescription Deauthorizes an admin from an application
 * @apiName AdminDeauthorize
 * @apiGroup Admin
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
 The authorization token obtained in the login endpoint.
 Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {string} email Email address of the admin to deauthorize from the application
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"email": "admin@telepat.io"
 * 	}
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": "Admin removed from application"
 * 	}
 *
 * 	@apiError (404) [011]ApplicationNotFound Application with that ID doesn't exist.
 * 	@apiError (404) [033]AdminNotFound Admin with that email address does not exist.
 * 	@apiError (404) [019]AdminNotFoundInApplication Admin does not belong to this application.
 * 	@apiError (409) [018]AdminDeauthorizeLastAdmin Admin with email address cannot be deauthorized because he's the
 * 	only one left. We can't have "orphan" applications.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"code": "011",
 * 		"status": 404,
 * 		"message": "Application with ID $APPID does not exist."
 * 	}
 *
 */
router.post('/deauthorize', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));
	} else if (!req.body.email) {
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['email']));
	}

	var appId = req._telepat.applicationId;
	var adminEmail = req.body.email;

	if (adminEmail == req.user.email && Models.Application.loadedAppModels[appId].admins.indexOf(req.user.id) == 0
		&& Models.Application.loadedAppModels[appId].admins.length == 1) {
		return next(new Models.TelepatError(Models.TelepatError.errors.AdminDeauthorizeLastAdmin));
	}

	async.waterfall([
		function(callback) {
			Models.Admin({email: adminEmail}, callback);
		},
		function(admin, callback) {
			if (Models.Application.loadedAppModels[appId].admins.indexOf(admin.id) === -1) {
				return callback(Models.TelepatError(Models.TelepatError.errors.AdminNotFoundInApplication, [adminEmail]));
			} else {
				var patches = [Models.Delta.formPatch(Models.Application.loadedAppModels[appId], 'remove', {admins: admin.id})];
				Models.Application.update(appId, patches, callback);
			}
		}
	], function(err, application) {
		if (err) return next(err);

		Models.Application.loadedAppModels[appId] = application;

		res.status(200).json({status: 200, content: 'Admin removed from application'}).end();
	});
});

module.exports = router;
