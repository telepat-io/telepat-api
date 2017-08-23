/* jshint maxlen: 120 */

var express = require('express');
var router = express.Router();

var security = require('../security');
var async = require('async');
var tlib = require('telepat-models');
var uuid = require('uuid');

router.use('/add', security.tokenValidation);
/**
 * @api {post} /admin/app/add AppCreate
 * @apiDescription Creates a application for the admin.
                   The request body should contain the application itself.
 * @apiName AdminAppAdd
 * @apiGroup Admin
 * @apiVersion 0.4.0
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

	if (!newApp.name) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['name']));
	} 
	if (!newApp.keys || newApp.keys.length == 0) {
		newApp['keys'] = [uuid.v4()];
	}

	newApp['admins'] = [req.user.id];
	tlib.apps.new(newApp, function (err, res1) {
		if (err)
			next(err);
		else {
		
			tlib.services.messagingClient.sendSystemMessages('_all', 'update_app', [{ appId: res1.id, appObject: tlib.apps[res1.id] }], function (err) {
				if (err)
					tlib.services.logger.error('There was an error trying to send system message: ' + err.message);
			});
			
			res.status(200).json({ status: 200, content: res1.properties });
		}
	});
});

router.use('/remove',
	security.tokenValidation);
/**
 * @api {delete} /admin/app/remove RemoveApp
 * @apiDescription Removes an application from the admin.
 * @apiName AdminAppRemove
 * @apiGroup Admin
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
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
	var appId = req.body.id;

	if (!appId)
		return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredFields, ['id']));

	if (!tlib.apps[appId]) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.ApplicationNotFound,
			[appId]));
	}

	if (tlib.apps[appId].admins.indexOf(req.user.id) === -1) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.ApplicationForbidden));
	}

	tlib.apps[appId].delete(function (err, res1) {
		if (err)
			next(err);
		else {
			tlib.services.messagingClient.sendSystemMessages('_all', 'delete_app', [{ id: appId }], function (err) {
				if (err)
					tlib.services.logger.error('There was an error trying to send system message: ' + err.message);
			});

			res.status(200).json({ status: 200, content: 'App removed' });
		}
	});
});

router.use('/update',
	security.tokenValidation);
/**
 * @api {post} /admin/app/update UpdateApp
 * @apiDescription Updates an app
 * @apiName AdminAppUpdate
 * @apiGroup Admin
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
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
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.RequestBodyEmpty));
	} else if (!Array.isArray(req.body.patches)) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.InvalidFieldValue,
			['"patches" is not an array']));
	} else if (req.body.patches.length == 0) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.InvalidFieldValue,
			['"patches" array is empty']));
	} else {

		var errors = false;
		var appId = null;

		req.body.patches.forEach(function (patch) {
			if (!patch.path || errors)
				return;

			appId = patch.path.split('/')[1];

			if (!appId) {
				errors = true;
				return next(new tlib.TelepatError(tlib.TelepatError.errors.InvalidPatch, ['missing ID in path']));
			}

			if (!tlib.apps[appId]) {
				return next(new tlib.TelepatError(tlib.TelepatError.errors.ApplicationNotFound,
					[appId]));
			}

			if (!tlib.apps[appId].admins && tlib.apps[appId].admins.indexOf(req.user.id) === -1) {
				errors = true;
				return next(new tlib.TelepatError(tlib.TelepatError.errors.ApplicationForbidden));
			}
		});

		if (errors)
			return;

		tlib.apps[appId].update(req.body.patches, function (err, result) {
			if (err)
				return next(err);
			else {
				tlib.services.messagingClient.sendSystemMessages('_all', 'update_app', [{ appId: result.id, appObject: result }], function (err) {
					if (err)
						return tlib.services.logger.error('There was an error trying to send system message: ' + err.message);
				});

				res.status(200).json({ status: 200, content: 'Updated' });
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
 * @apiVersion 0.4.0
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
router.post('/authorize', function (req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.RequestBodyEmpty));
	} else if (!req.body.email) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['email']));
	}

	var appId = req._telepat.applicationId;
	var adminEmail = req.body.email;

	async.waterfall([
		function (callback) {
			tlib.admins.get({ email: adminEmail }, callback);
		},
		function (admin, callback) {
			if (tlib.apps[appId].admins.indexOf(admin.id) !== -1) {
				return callback(new tlib.TelepatError(tlib.TelepatError.errors.AdminAlreadyAuthorized));
			}

			var patches = [tlib.delta.formPatch(tlib.apps[appId], 'append', { admins: admin.id })];
			tlib.apps[appId].update(patches, callback);
		}
	], function (err, application) {
		if (err) return next(err);

		if (!(application instanceof tlib.Application)) {
			application = new tlib.Application(application);
		}

		tlib.apps[appId] = application;

		res.status(200).json({ status: 200, content: 'Admin added to application' });
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
 * @apiVersion 0.4.0
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
router.post('/deauthorize', function (req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.RequestBodyEmpty));
	} else if (!req.body.email) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.MissingRequiredField, ['email']));
	}

	var appId = req._telepat.applicationId;
	var adminEmail = req.body.email;

	if (adminEmail == req.user.email && tlib.apps[appId].admins.indexOf(req.user.id) == 0
		&& tlib.apps[appId].admins.length == 1) {
		return next(new tlib.TelepatError(tlib.TelepatError.errors.AdminDeauthorizeLastAdmin));
	}

	async.waterfall([
		function (callback) {
			tlib.admins.get({ email: adminEmail }, callback);
		},
		function (admin, callback) {
			if (tlib.apps[appId].admins.indexOf(admin.id) === -1) {
				return callback(new tlib.TelepatError(tlib.TelepatError.errors.AdminNotFoundInApplication, [adminEmail]));
			} else {
				var patches = [tlib.delta.formPatch(tlib.apps[appId], 'remove', { admins: admin.id })];
				tlib.apps[appId].update(patches, callback);
			}
		}
	], function (err, application) {
		if (err) return next(err);
		if (!(application instanceof tlib.Application)) {
			application = new tlib.Application(application);
		}

		tlib.apps[appId] = application;

		res.status(200).json({ status: 200, content: 'Admin removed from application' });
	});
});

module.exports = router;
