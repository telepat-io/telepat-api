/* jshint maxlen: 120 */

var express = require('express');
var router = express.Router();

var security = require('../security');
var Models = require('telepat-models');

/**
 * @api {post} /admin/login Authenticate
 * @apiDescription Authenticates an admin and returns the authorization token
 * @apiName AdminAuthenticate
 * @apiGroup Admin
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 *
 * @apiParam {String} email (REQUIRED) Email of admin
 * @apiParam {String} password (REQUIRED) Password of admin
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"email": "email@example.com",
 * 		"password": "5f4dcc3b5aa765d61d8327deb882cf99"
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			token: "TOKEN"
 * 		}
 * 	}
 *
 * @apiError Unauthorized If the provided email and password are not correct
 * @apiErrorExample {json} Error Response
 * 	{
 * 		"status": 401,
 * 		"message": "Wrong user or password"
 * 	}
 */
router.post('/login', function (req, res, next) {
	if (!req.body.email)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['email']));

	if (!req.body.password)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['password']));

	async.waterfall([
		function(callback) {
			security.encryptPassword(req.body.password, callback);
		},
		function(hashedPassword) {
			Models.Admin({email: req.body.email}, function(err, admin) {
				if (err && err.status == 404) {
					return next(new Models.TelepatError(Models.TelepatError.errors.AdminBadLogin));
				} else if (err) {
					return next(err);
				}

				if (hashedPassword === admin.password) {
					res.status(200)
						.json({status: 200, content: {
								user: admin,
								token: security.createToken({
									id: admin.id,
									email: req.body.email,
									isAdmin: true
								})}
						}).end();
				} else {
					return next(new Models.TelepatError(Models.TelepatError.errors.AdminBadLogin));
				}
			});
		}
	]);
});

/**
 * @api {post} /admin/add Create
 * @apiDescription Creates a new admin
 * @apiName AdminAdd
 * @apiGroup Admin
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 *
 * @apiParam {String} email Admin e-mail
 * @apiParam {String} password The password
 * @apiParam {String} name Real name of the admin
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"email": "email@example.com",
 * 		"password": "5f4dcc3b5aa765d61d8327deb882cf99",
 * 		"name": "General Specific"
 * 	}
 *
 * @apiError (409) AdminAlreadyExists Admin account with that email address already exists.
 * @apiErrorExample {json} Error Response
 * 	{
 * 		"status": 409,
 * 		"message": "Error adding account"
 * 	}
 *
 * @apiError (500) Error Internal server error.
 * @apiErrorExample {json} Error Response
 * 	{
 * 		"status": 500,
 * 		"message": "message describing the server error"
 * 	}
 */
router.post('/add', function (req, res, next) {
	if (!req.body.email)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['email']));

	if (!req.body.password)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['password']));

	async.waterfall([
		function(callback) {
			security.encryptPassword(req.body.password, callback);
		},
		function(hashedPassword) {
			req.body.password = hashedPassword;

			Models.Admin.create(req.body.email, req.body, function (err) {
				if (err)
					next(err);
				else
					res.status(200).json({status: 200, content: 'Admin added'}).end();
			});
		}
	], function(err) {
		if (err) next(err);
	});
});

router.use('/me', security.tokenValidation);
/**
 * @api {get} /admin/me Me
 * @apiDescription Gets information about the logged admin
 * @apiName AdminMe
 * @apiGroup Admin
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 		  	"id": 3,
 * 		  	"email": "email@example.com",
 * 		  	"password": "5f4dcc3b5aa765d61d8327deb882cf99",
 * 		  	"name": "General Specific",
 * 		  	"isAdmin": true
 * 		}
 * 	}
 */
router.get('/me', function (req, res) {
	res.status(200).json({status: 200, content: req.user}).end();
});

router.use('/update', security.tokenValidation);
/**
 * @api {post} /admin/update Update
 * @apiDescription Updates the currently logged admin.
                   Every property in the request body is used to udpate the admin.
 * @apiName AdminUpdate
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
 * 		"patches": [
 * 			{
 * 				"op": "replace",
 * 				"path": "admin/admin_id/field_name",
 * 				"value": "new value"
 * 			}
 * 		]
 * 	}
 *
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 500,
 * 		"message": "Error description"
 * 	}
 *
 */
router.post('/update', function (req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));
	} else if (!Array.isArray(req.body.patches)) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" is not an array']));
	} else if (req.body.patches.length == 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" array is empty']));
	} else {
		async.each(req.body.patches, function(patch, c) {
			if (patch.path.split('/')[1] != req.user.id)
				c(new Models.TelepatError(Models.TelepatError.errors.InvalidAdmin));
			else
				c();
		}, function(err) {
			if (err) {
				next(err);
			} else {
				Models.Admin.update(req.body.patches, function (err) {
					if (err)
						next(err);
					else
						res.status(200).json({status: 200, content: 'Admin updated'}).end();
				});
			}
		});
	}
});

router.use('/delete', security.tokenValidation);

/**
 * @api {post} /admin/delete Delete
 * @apiDescription Deletes the currently logged admin.
 * @apiName AdminDelete
 * @apiGroup Admin
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 *
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Internal Server Error
 * 	{
 * 		"status": 500,
 * 		"message": "Error description"
 * 	}
 *
 */
router.post('/delete', function(req, res, next) {
	Models.Admin.delete({id: req.user.id}, function(err) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: 'Admin deleted'}).end();
	});
});

router.use('/apps', security.tokenValidation);
/**
 * @api {get} /admin/apps Applications
 * @apiDescription Lists the application for the current admin
 * @apiName AdminApps
 * @apiGroup Admin
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			"20": {
 * 			 	"admin_id": "email@example.com",
 *			 	"icon": "fa-bullhorn",
 *			 	"name": "The Voice",
 *			 	"type": "application",
 *			 	"keys": [
 *			 		"3406870085495689e34d878f09faf52c"
 *			 	]
 * 			},
 * 			...
 *		}
 * 	}
 *
 */
router.get('/apps', function (req, res, next) {
	var adminApps = [];
	async.each(Object.keys(app.applications), function(applicationId, c){
		if (app.applications[applicationId].admins.indexOf(req.user.id) !== -1)
			adminApps.push(app.applications[applicationId]);
		c();
	}, function(err) {
		if (err) return next(err);
		else {
			res.status(200).json({status: 200, content: adminApps}).end();
		}
	});
});

module.exports = router;