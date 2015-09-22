/* jshint maxlen: 120 */

var express = require('express');
var router = express.Router();

var security = require('../security');
var Models = require('telepat-models');

router.use('/add', security.tokenValidation);
/**
 * @api {post} /admin/app/add AppCreate
 * @apiDescription Creates a app for the admin.
                   The request body should contain the app itself.
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
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 500,
 * 		"message": "Could not add app"
 * 	}
 *
 */
router.post('/add', function (req, res) {
	var newApp = req.body;

	if (!newApp.name)
		return res.status(400).json({status: 400, message: '\'name\' field is missing'}).end();

	newApp['admins'] = [req.user.id];
	Models.Application.create(newApp, function (err, res1) {
		if (err) {
			res.status(500).send({status: 500, message: 'Could not add app'});
		}
		else {
			app.applications[res1.id] = res1;
			res.status(200).json({status: 200, content: res1});
		}
	});
});

router.use('/remove',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/app/remove RemoveApp
 * @apiDescription Removes an app from the admin.
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
 * 	@apiError (404) Error Application with that ID doesn't exist.
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 500,
 * 		"message": "Could not remove app"
 * 	}
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 404,
 * 		"message": "Application with ID $APPID doest not exist."
 * 	}
 *
 */
router.post('/remove', function (req, res) {
	var appId = req._telepat.applicationId;

	Models.Application.delete(appId, function (err, res1) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not remove app'});
		else {
			delete app.applications[appId];
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
 * 	@apiError (404) Error Application with that ID doesn't exist
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 404,
 * 		"message": "Application with ID $APPID doest not exist."
 * 	}
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 500,
 * 		"message": "internal server error description"
 * 	}
 *
 */
router.post('/update', function (req, res, next) {
	var appId = req._telepat.applicationId;

	if (Object.getOwnPropertyNames(req.body).length === 0) {
		res.status(400)
			.json({status: 400, message: 'Missing request body'})
			.end();
	} else if (!Array.isArray(req.body.patches)) {
		res.status(400)
			.json({status: 400, message: 'patches is not an array or is missing'})
			.end();
	} else if (req.body.patches.length == 0) {
		res.status(400)
			.json({status: 400, message: 'patches array is empty'})
			.end();
	} else {
		Models.Application.update(appId, req.body.patches, function (err, result) {
			if (err)
				return next(err);
			else {
				app.applications[appId] = result;
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
 * 	@apiError (400) EmptyBodyError
 * 	@apiError (400) MissingRequestedField "email" field is missing
 * 	@apiError (404) Error Application with that ID doesn't exist
 * 	@apiError (404) Error Admin with that email address does not exist
 * 	@apiError (409) AdminAlreadyAuthorized Admin with email address already authorized for application
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 404,
 * 		"message": "Application with ID $APPID doest not exist."
 * 	}
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 500,
 * 		"message": "internal server error description"
 * 	}
 *
 */
router.post('/authorize', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		res.status(400)
			.json({status: 400, message: 'Missing request body'})
			.end();
	} else if (!req.body.email) {
		res.status(400)
			.json({status: 400, message: 'Request admin email address is missing'})
			.end();
	}

	var appId = req._telepat.applicationId;
	var adminEmail = req.body.email;

	if (app.applications[appId].admins.indexOf(adminEmail) !== -1) {
		var error = new Error('Admin with that email address is already authorized in this application');
		error.status = 409;

		return next(error);
	}

	async.waterfall([
		function(callback) {
			Models.Admin({email: adminEmail}, callback);
		},
		function(admin, callback) {
			var patches = [{
				op: 'append',
				path: 'application/'+appId+'/admins',
				value: admin.id
			}];
			Models.Application.update(appId, patches, callback);
		}
	], function(err, application) {
		if (err) return next(err);

		app.applications[appId] = application;

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
 * 	@apiError (400) EmptyBodyError
 * 	@apiError (400) MissingRequestedField "email" field is missing
 * 	@apiError (404) Error Application with that ID doesn't exist
 * 	@apiError (404) Error Admin with that email address does not exist or does not belong to the application
 * 	@apiError (409) CannotDeauthorizeLastAdmin Admin with email address cannot be deauthorized because he's the only one
 * 	left. We can't have "orphan" applications.
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 404,
 * 		"message": "Application with ID $APPID doest not exist."
 * 	}
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 500,
 * 		"message": "internal server error description"
 * 	}
 *
 */
router.post('/deauthorize', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		res.status(400)
			.json({status: 400, message: 'Missing request body'})
			.end();
	} else if (!req.body.email) {
		res.status(400)
			.json({status: 400, message: 'Request admin email address is missing'})
			.end();
	}

	var appId = req._telepat.applicationId;
	var adminEmail = req.body.email;

	if (adminEmail == req.user.email && app.applications[appId].admins.indexOf(req.user.id) == 0
		&& app.applications[appId].admins.length == 1) {
		var error = new Error('Cannot remove yourself from the application because you\'re the only authorized admin');
		error.status = 409;

		return next(error);
	}

	async.waterfall([
		function(callback) {
			Models.Admin({email: adminEmail}, callback);
		},
		function(admin, callback) {
			if (app.applications[appId].admins.indexOf(admin.id) === -1) {
				var error = new Error('Admin with email address "'+adminEmail+'" not found in application');
				error.status = 404;

				return next(error);
			} else {
				var patches = [{
					op: 'remove',
					path: 'application/'+appId+'/admins',
					value: admin.id
				}];
				Models.Application.update(appId, patches, callback);
			}
		}
	], function(err, application) {
		if (err) return next(err);

		app.applications[appId] = application;

		res.status(200).json({status: 200, content: 'Admin removed from application'}).end();
	});
});

module.exports = router;
