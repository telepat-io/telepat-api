var express = require('express');
var router = express.Router();

var security = require('./security');
var Models = require('telepat-models');
var crypto = require('crypto');

var unless = function(paths, middleware) {
	return function(req, res, next) {
		var excluded = false;
		for (var i=0; i<paths.length; i++) {
			if (paths[i] === req.path) {
				excluded = true;
			}
		}
		if (excluded) {
			return next();
		} else {
			return middleware(req, res, next);
		}
	};
};

/**
 * @api {post} /admin/login Authenticate
 * @apiDescription Authenticates an admin and returns the authorization token
 * @apiName AdminAuthenticate
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 *
 * @apiParam {String} email Email of admin
 * @apiParam {String} password Password of admin
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
 * 			token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhYmlAYXBwc2NlbmQuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaWF0IjoxNDMyOTA2ODQwLCJleHAiOjE0MzI5MTA0NDB9.knhPevsK4cWewnx0LpSLrMg3Tk_OpchKu6it7FK9C2Q"
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
		return res.status(400).json({status: 400, message: "Missing email address"}).end();

	if (!req.body.password)
		return res.status(400).json({status: 400, message: "Missing password"}).end();

	async.waterfall([
		function(callback) {
			security.encryptPassword(req.body.password, callback);
		},
		function(hashedPassword) {
			Models.Admin(req.body.email, function(err, admin) {
				if (err && err.status == 404) {
					res.status(401).json({status: 401, message: 'Wrong user or password'}).end();

					return;
				} else if (err) {
					return next(err);
				}

				if (hashedPassword == admin.password) {
					res.status(200).json({status: 200, content: {user: admin, token: security.createToken({id: admin.id, email: req.body.email, isAdmin: true})}}).end();
				} else {
					res.status(401).json({status: 401, message: 'Wrong user or password'}).end();
				}
			})
		}
	]);
});

/**
 * @api {post} /admin/add Create
 * @apiDescription Creates a new admin
 * @apiName AdminAdd
 * @apiGroup Admin
 * @apiVersion 0.2.2
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
	if (!req.body.email) {
		res.status(400).json({status: 400, message: "Missing requested email address"}).end();
		return;
	}
	if (!req.body.password) {
		res.status(400).json({status: 400, message: "Missing requested password"}).end();
		return;
	}

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
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
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
 * @apiDescription Updates the currently logged admin. Every property in the request body is used to udpate the admin.
 * @apiName AdminUpdate
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"email": "email@example.com",
 * 		"password": "d1e6b0b6b76039c9c42541f2da5891fa"
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
	if (Object.getOwnPropertyNames(req.body).length == 0) {
		res.status(400).json({status: 400, message: "Missing request body"}).end();
	} else {
		Models.Admin.update(req.user.email, req.body, function (err, res1) {
			if (err)
				next(err);
			else
				res.status(200).json({status: 200, content: "Admin updated"}).end();
		})
	}
});

router.use('/delete', security.tokenValidation);

/**
 * @api {post} /admin/delete Delete
 * @apiDescription Deletes the currently logged admin.
 * @apiName AdminDelete
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
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
router.delete('/delete', function(req, res, next) {
	var emailAddress = req.user.email;

	Models.Admin.delete(emailAddress, function(err) {
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
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
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
router.get('/apps', function (req, res) {
	var adminApps = [];
	async.each(Object.keys(app.applications), function(applicationId, c){
		if (app.applications[applicationId].admins.indexOf(req.user.id) != -1)
			adminApps.push(app.applications[applicationId]);
		c();
	}, function(err) {
		if (err) {
			res.status(500).send({status: 500, message: "Server issue"});
		}
		else {
			res.status(200).json({status: 200, content: adminApps}).end();
		}
	});
});

router.use('/app/add', security.tokenValidation);
/**
 * @api {post} /admin/app/add AppCreate
 * @apiDescription Creates a app for the admin. The request body should contain the app itself.
 * @apiName AdminAppAdd
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
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
router.post('/app/add', function (req, res) {
	var newApp = req.body;

	if (!newApp.name)
		return res.status(400).json({status: 400, message: "'name' field is missing"}).end();

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

router.use('/app/remove', security.tokenValidation, security.applicationIdValidation, security.adminAppValidation);
/**
 * @api {post} /admin/app/remove RemoveApp
 * @apiDescription Removes an app from the admin.
 * @apiName AdminAppRemove
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
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
router.post('/app/remove', function (req, res) {
	var appId = req._telepat.application_id;

	Models.Application.delete(appId, function (err, res1) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not remove app'});
		else {
			delete app.applications[appId];
			res.status(200).json({status: 200, content: "App removed"}).end();
		}
	});
});

router.use('/app/update', security.tokenValidation, security.applicationIdValidation, security.adminAppValidation);
/**
 * @api {post} /admin/app/update UpdateApp
 * @apiDescription Updates an app
 * @apiName AdminAppUpdate
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} appId ID of the app to update
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"name": "New name"
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
 * 		"message": "Could not update app"
 * 	}
 *
 */
router.post('/app/update', function (req, res) {
	var appId = req._telepat.application_id;

	Models.Application.update(appId, req.body, function (err, result) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not update app'});
		else {
			app.applications[appId] = result;
			res.status(200).json({status: 200, content: 'Updated'}).end();
		}
	});
});

router.use('/contexts', security.tokenValidation, security.applicationIdValidation, security.adminAppValidation);
/**
 * @api {post} /admin/contexts GetContexts
 * @apiDescription Get all contexsts
 * @apiName AdminGetContexts
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
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
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 500,
 * 		"message": "Could not get contexts"
 * 	}
 *
 */
router.get('/contexts', function (req, res) {
	var appId = req._telepat.application_id;

	Models.Context.getAll(appId, function (err, res1) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not get contexts'});
		else {
			res.status(200).json({status: 200, content: res1});
		}
	});
});

router.use('/context', security.tokenValidation, security.applicationIdValidation, security.adminAppValidation);
/**
 * @api {post} /admin/context GetContext
 * @apiDescription Retrieves a context
 * @apiName AdminGetContext
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
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
 * 		"content": {
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
 * 		"status": 500,
 * 		"message": "Could not get context"
 * 	}
 *
 */
router.post('/context', function (req, res) {
	if (!req.body.id) {
		res.status(400).json({status: 400, message: 'Requested context ID is missing'}).end();
	}

	Models.Context(req.body.id, function (err, res1) {
		if (err && err.status == 404)
			res.status(404).json({status: 404, message: 'Context not found'}).end();
		else if (err)
			res.status(500).send({status: 500, message: 'Could not get context'});
		else {
			res.status(200).json({status: 200, content: res1}).end();
		}
	});
});

router.use('/context/add', security.tokenValidation, security.applicationIdValidation, security.adminAppValidation);
/**
 * @api {post} /admin/context/add CreateContext
 * @apiDescription Creates a new context
 * @apiName AdminCreateContext
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} appId ID of the application
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"name": "Episode 2",
 * 		"meta": {"info": "some meta info"}
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			"name": "Episode 2",
 * 			"state": 0,
 * 			"meta": {"info": "some meta info"},
 * 			"type": "context",
 * 			"application_id": "20"
 * 		}
 * 	}
 *
 * 	@apiError (500) Error Internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status" 500,
 * 		"message": "Could not add context"
 * 	}
 *
 */
router.post('/context/add', function (req, res) {
	if (Object.getOwnPropertyNames(req.body).length === 0)
		return res.status(400).json({status: 400, message: "Request body is empty"}).end();

	var newContext = req.body;
	newContext['application_id'] = req._telepat.application_id;
	Models.Context.create(newContext, function (err, res1) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not add context'});
		else {
			res.status(200).json({status: 200, content: res1}).end();
		}
	});
});

router.use('/context/remove', security.tokenValidation, security.applicationIdValidation, security.adminAppValidation);
/**
 * @api {post} /admin/context/remove RemoveContext
 * @apiDescription Removes a context and all associated objects
 * @apiName AdminRemoveContext
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} id ID of the context to remove
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"id": 1
 * 	}
 *
 * 	@apiError (500) Error Context not found or internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status" 500,
 * 		"message": "Could not remove context"
 * 	}
 *
 */
router.post('/context/remove', function (req, res) {
	if (!req.body.id) {
		res.status(400).json({status: 400, message: "Requested context ID is missing"}).end();
		return;
	}

	Models.Context.delete(req.body.id, function (err, res1) {
		if (err && err.status == 404)
			res.status(404).json({status: 404, message: 'Context does not exist'}).end();
		else if (err)
			res.status(500).send({status: 500, message: err.message});
		else {
			res.status(200).json({status: 200, content: "Context removed"});
		}
	});
});

router.use('/context/update', security.tokenValidation, security.applicationIdValidation, security.adminAppValidation);
/**
 * @api {post} /admin/context/update UpdateContext
 * @apiDescription Updates the context object
 * @apiName AdminUpdateContext
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} id ID of the context to update
 * @apiParam {Array} patches An array of patches
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"id": 1,
 * 		"patches": [
 * 			{
 * 				"op": "replace",
 * 				"path": "context/context_id/field_name",
 * 				"value" "New value"
 * 			}
 * 		]
 * 	}
 *
 * 	@apiError (500) Error Context not found or internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		"status": 500,
 * 		"message": "Could not update context"
 * 	}
 *
 */
router.post('/context/update', function (req, res) {
	if (!req.body.id) {
		res.status(400).json({status: 400, message: "Requested context ID is missing"}).end();
		return;
	}

	if (!req.body.patches) {
		res.status(400).json({status: 400, message: "Requested patches array is missing"}).end();
		return;
	}

	async.waterfall([
		function(callback) {
			Models.Context(req.body.id, callback);
		},
		function(context, callback) {
			if (app.applications[context.application_id].admins.indexOf(req.user.id) == -1) {
				res.status(403).send({status: 403, message: 'This context does not belong to you'}).end();
				callback();
			} else {
				Models.Context.update(req.body.id, req.body.patches, function (err, res1) {
					if (err && err.status == 404)
						res.status(404).send({status: 404, message: 'Context with id \''+req.body.id+'\' does not exist'}).end();
					else if (err)
						res.status(500).send({status: 500, message: 'Could not update context'}).end();
					else {
						res.status(200).json({status: 200, content: 'Context updated'}).end();
					}
					callback();
				});
			}
		}
	]);
});

router.use('/schemas', security.tokenValidation, security.applicationIdValidation, security.adminAppValidation);
/**
 * @api {post} /admin/schemas GetSchemas
 * @apiDescription Gets the model schema for an application
 * @apiName AdminGetSchemas
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content" :{
 * 			"answer": {
 *   		"namespace": "answers",
 *   		"type": "answer",
 *   		"properties": {},
 *   		"belongsTo": [
 *     			{
 *       			"parentModel": "event",
 *       			"relationType": "hasSome"
 *     			}
 *   		],
 *   		"read_acl": 6,
 *   		"write_acl": 6,
 *   		"meta_read_acl": 6
 * 		},
 * 		...
 * 		}
 * 	}
 *
 */
router.get('/schemas', function(req, res, next) {
	var appId = req._telepat.application_id;

	Models.Application.getAppSchema(appId, function(err, result) {
		if (err){
			next(err);
		} else {
			res.status(200).json({status: 200, content: result}).end();
		}
	});
});

router.use('/schema/update', security.tokenValidation, security.applicationIdValidation, security.adminAppValidation);
/**
 * @api {post} /admin/schema/update UpdateSchema
 * @apiDescription Updates the model schema
 * @apiName AdminUpdateSchema
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Object} schema Updated schema object
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"schema": "see example at /schemas"
 * 	}
 *
 * @apiError 404 NotFound If the App ID doesn't exist
 */
router.post('/schema/update', function(req, res, next) {
	if (!req.body.schema) {
		res.status(400).json({status: 400, message: "Requested schema object is missing"}).end();
		return;
	}

	var appId = req._telepat.application_id;
	var schema = req.body.schema;

	Models.Application.updateSchema(appId, schema, function(err, result) {
		if (err){
			next(err);
		} else {
			app.applications[appId].schema = schema;
			res.status(200).json({status: 200, content: "Schema updated"}).end();
		}
	});
});

router.use('/schema/remove_model', security.tokenValidation, security.applicationIdValidation, security.adminAppValidation);
/**
 * @api {post} /admin/schema/remove_model RemoveAppModel
 * @apiDescription Removes a model from the application (all items of this type will be deleted)
 * @apiName AdminRemoveAppModel
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Object} schema Updated schema object
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"model_name": "events"
 * 	}
 *
 * @apiError 404 NotFound If the App ID doesn't exist
 * @apiError 404 NotFound If the App does not have a model with that name
 */
router.post('/schema/remove_model', function(req, res, next) {
	if (!req.body.model_name) {
		res.status(400).json({status: 400, message: "Requested model name object is missing"}).end();
		return;
	}

	var appId = req._telepat.application_id;
	var modelName = req.body.model_name;

	if (!app.applications[appId].schema[modelName]) {
		res.status(404).json({status: 404, message: "Application with ID '"+appId+"' does not have a model named '"+modelName+"'"}).end();
		return;
	}

	Models.Application.deleteModel(appId, modelName, function(err) {
		if (err){
			next(err);
		} else {
			delete app.applications[appId].schema[modelName];
			res.status(200).json({status: 200, content: "Schema updated"}).end();
		}
	});
});

router.use('/users', security.tokenValidation, security.applicationIdValidation, security.adminAppValidation);
/**
 * @api {get} /admin/users GetAppusers
 * @apiDescription Gets all users of the app
 * @apiName AdminGetUsers
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content" : [
 * 			{//user props}, ...
 * 		]
 * 	}
 *
 * @apiError 404 NotFound If the App ID doesn't exist
 */

router.get('/users', function(req, res, next) {
	var appId = req._telepat.application_id;

	Models.User.getAll(appId, function(err, results) {
		if (err) return next(err);

		results.forEach(function(item, index, originalArray) {
			delete originalArray[index].password;
		});

		res.status(200).json({status: 200, content: results}).end();
	});
});

router.use('/user/update', security.tokenValidation, security.applicationIdValidation, security.adminAppValidation);
/**
 * @api {post} /admin/user/update EditUser
 * @apiDescription Updates an user from an app
 * @apiName AdminUpdateuser
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Object} user The object that contains the user (must contain the email to identify him)
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"user": {
 * 			"email": "user@example.com",
 * 			"name": "New Name"
 * 		}
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
router.post('/user/update', function(req, res, next) {
	var patches = req.body.patches;

	if (!patches) {
		res.status(400).json({status: 400, message: "Object 'user' is missing from the request"}).end();
		return;
	}

	if (!req.body.email) {
		res.status(400).json({status: 400, message: "Object 'user' is missing email address field"}).end();
		return;
	}

	patches.forEach(function(patch, i, originalArray) {
		if (patch[i].path.split('/')[2] == 'password') {
			var passwordSalt = req.app.get('password_salt');
			var md5password = crypto.createHash('md5').update(patch[i].value).digest('hex');
			originalArray[i].value = crypto.createHash('sha256').update(passwordSalt[0]+md5password+passwordSalt[1]).digest('hex');
		}
	});

	Models.User.update(req.body.email, req._telepat.application_id, patches, function(err) {
		if (err && err.status == 404)
			res.status(404).json({status: 404, message: 'User not found'}).end();
		else if (err) return next(err);

		res.status(200).json({status: 200, content: "User has been updated"}).end();
	});
});

router.use('/user/delete', security.tokenValidation, security.applicationIdValidation, security.adminAppValidation);
/**
 * @api {post} /admin/user/delete Deleteuser
 * @apiDescription Deketes an user from an app
 * @apiName AdminDeleteUser
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {String} email The email address of an user from an app
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
 * @apiError 404 NotFound If the App ID doesn't exist
 * @apiError 404 NotFound If the User does not belong to this application
 */
router.post('/user/delete', function(req, res, next) {
	if (!req.body.email) {
		res.status(400).json({status: 400, message: "Requested email address is missing"}).end();
		return;
	}

	var appId = req._telepat.application_id;
	var userEmail = req.body.email;

	async.waterfall([
		function(callback) {
			Models.User(userEmail, appId, callback);
		},
		function(user, callback) {
			if (user.application_id != appId) {
				var error = new Error('User does not belong to this application');
				error.code = 404;

				return callback(error);
			} else {
				Models.User.delete(userEmail, appId, callback);
			}
		}
	], function(error, results) {
		if (error && error.status == 404)
			return res.status(404).json({status: 404, message: 'User not found'}).end();
		else if (error) return next(error);

		if (results) {
			async.each(results, function(item, c) {
				var context = item.context_id;
				var mdl = item.value.type;
				var id = item.value.id;

				app.kafkaProducer.send([{
					topic: 'aggregation',
					messages: [JSON.stringify({
						op: 'delete',
						object: {path: mdl+'/'+id},
						context: context,
						applicationId: appId
					})],
					attributes: 0
				}], c);
			});
		}

		res.status(200).json({status: 200, content: 'User deleted'}).end();
	})
});

module.exports = router;
