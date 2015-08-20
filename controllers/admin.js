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

router.use(unless(['/add'], security.keyValidation));
router.use(unless(['/add', '/login'], security.tokenValidation));
router.use(['/apps/remove', 'apps/update'], security.adminAppValidation);

/**
 * @api {post} /admin/login Authenticate
 * @apiDescription Authenticates an admin and returns the authorization token
 * @apiName AdminAuthenticate
 * @apiGroup Admin
 * @apiVersion 0.2.0
 *
 * @apiParam {String} email Email of admin
 * @apiParam {String} password Password of admin
 *
 * @apiExample {json} Client Request
 * 	{
 * 		email: "email@example.com",
 * 		password: "5f4dcc3b5aa765d61d8327deb882cf99"
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		status: 200,
 * 		content:{
 * 			token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhYmlAYXBwc2NlbmQuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaWF0IjoxNDMyOTA2ODQwLCJleHAiOjE0MzI5MTA0NDB9.knhPevsK4cWewnx0LpSLrMg3Tk_OpchKu6it7FK9C2Q"
 * 		}
 * 	}
 *
 * @apiError Unauthorized If the provided email and password are not correct
 * @apiErrorExample {json} Error Response
 * 	{
 * 		status: 401,
 * 		message: "Wrong user or password"
 * 	}
 */
router.post('/login', function (req, res, next) {
	var passwordSalt = req.app.get('password_salt');
	var md5password = crypto.createHash('md5').update(req.body.password).digest('hex');
	var hashedPassword = crypto.createHash('sha256').update(passwordSalt[0]+md5password+passwordSalt[1]).digest('hex');

	Models.Admin(req.body.email, function(err, admin) {
		if (err) {
			return next(err);
		}

		if (hashedPassword == admin.password) {
			res.json({ content: {user: admin, token: security.createToken({email: req.body.email, isAdmin: true})}});
		}
		else {
			res.status(401).json({status: 401, message: 'Wrong user or password'});
			return;
		}
	})
});

/**
 * @api {post} /admin/add Create
 * @apiDescription Creates a new admin
 * @apiName AdminAdd
 * @apiGroup Admin
 * @apiVersion 0.2.0
 *
 * @apiParam {String} email Admin e-mail
 * @apiParam {String} password The password
 * @apiParam {String} name Real name of the admin
 *
 * @apiExample {json} Client Request
 * 	{
 * 		email: "email@example.com",
 * 		password: "5f4dcc3b5aa765d61d8327deb882cf99",
 * 		name: "General Specific"
 * 	}
 *
 * @apiError (500) Error Admin account with that email address already exists or internal server error.
 * @apiErrorExample {json} Error Response
 * 	{
 * 		status: 500,
 * 		message: "Error adding account"
 * 	}
 */
router.post('/add', function (req, res) {
	var passwordSalt = req.app.get('password_salt');
	var md5password = crypto.createHash('md5').update(req.body.password).digest('hex');
	var hashedPassword = crypto.createHash('sha256').update(passwordSalt[0]+md5password+passwordSalt[1]).digest('hex');

	Models.Admin.create(req.body.email, { email: req.body.email, password: hashedPassword, name: req.body.name }, function (err, result) {
		if (err)
			res.status(500).send({status: 500, message : "Error adding account"});
		else
			res.status(200).json({status: 200, content: 'Admin added'}).end();
	});
});

/**
 * @api {get} /admin/me Me
 * @apiDescription Gets information about the logged admin
 * @apiName AdminMe
 * @apiGroup Admin
 * @apiVersion 0.2.0
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		  "id": 3,
 * 		  "email": "email@example.com",
 * 		  "password": "5f4dcc3b5aa765d61d8327deb882cf99",
 * 		  "name": "General Specific",
 * 		  "isAdmin": true
 * 	}
 */
router.get('/me', function (req, res) {
	res.status(200).json({status: 200, content: req.user}).end();
});

/**
 * @api {post} /admin/update Update
 * @apiDescription Updates a new admin. Every property in the request body is used to udpate the admin.
 * @apiName AdminUpdate
 * @apiGroup Admin
 * @apiVersion 0.2.0
 *
 * @apiExample {json} Client Request
 * 	{
 * 		email: "email@example.com",
 * 		password: "d1e6b0b6b76039c9c42541f2da5891fa"
 * 	}
 *
 * 	@apiError (500) Error Admin account with that e-mail address doesn't exist or internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		status: 500,
 * 		message: "Error description"
 * 	}
 *
 */
router.post('/update', function (req, res) {
	Models.Admin.update(req.user.email, req.body, function (err, res1) {
		if (err)
			res.status(500).json({status: 500, message: err}).end();
		else
			res.send(200).json({status: 200, content: "Admin updated"});
	})
});

/**
 * @api {get} /admin/apps Applications
 * @apiDescription Lists the application for the current admin
 * @apiName AdminApps
 * @apiGroup Admin
 * @apiVersion 0.2.0
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"20": {
 * 			 "admin_id": "email@example.com",
 *			 "icon": "fa-bullhorn",
 *			 "name": "The Voice",
 *			 "type": "application",
 *			 "keys": [
 *			 	"3406870085495689e34d878f09faf52c"
 *			 ]
 * 		},
 * 		...
 * 	}
 *
 */
router.get('/apps', function (req, res) {
	var adminApps = {};
	async.each(Object.keys(app.applications), function(applicationId, c){
		if (app.applications[applicationId].admin_id == req.user.email)
			adminApps[applicationId] = app.applications[applicationId];
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

/**
 * @api {post} /admin/add/app AppCreate
 * @apiDescription Creates a app for the admin. The request body should contain the app itself.
 * @apiName AdminAppAdd
 * @apiGroup Admin
 * @apiVersion 0.2.0
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
 * 		message: "Could not add app"
 * 	}
 *
 */
router.post('/app/add', function (req, res) {
	var newApp = req.body;
	newApp['admin_id'] = req.user.email;
	Models.Application.create(newApp, function (err, res1) {
		if (err) {
			res.status(500).send({status: 500, message: 'Could not add app'});
		}
		else {
			var newIndex;
			for (var key in res1) {
				if (res1.hasOwnProperty(key)) {
					newIndex = key;
				}
			}
			app.applications[newIndex] = res1[newIndex];
			res.status(200).json({status: 200, content: res1});
		}
	});
});

/**
 * @api {post} /admin/app/remove RemoveApp
 * @apiDescription Removes an app from the admin.
 * @apiName AdminAppRemove
 * @apiGroup Admin
 * @apiVersion 0.2.0
 *
 * @apiParam {Number} appId The ID of the app to remove
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"appId": 20
 * 	}
 *
 * 	@apiError (500) Error Application with that ID doesn't exist or internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		status: 500,
 * 		message: "Could not remove app"
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

/**
 * @api {post} /admin/app/update UpdateApp
 * @apiDescription Updates an app
 * @apiName AdminAppUpdate
 * @apiGroup Admin
 * @apiVersion 0.2.0
 *
 * @apiParam {Number} appId ID of the app to update
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"appId": 20,
 * 		"name": "New name"
 * 	}
 *
 * 	@apiError (500) Error Application with that ID doesn't exist or internal server error.
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 * 		status: 500,
 * 		message: "Could not update app"
 * 	}
 *
 */
router.post('/app/update', function (req, res) {
	var appId = req._telepat.application_id;

	Models.Application.update(appId, req.body, function (err, res1, updatedApp) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not update app'});
		else {
			app.applications[appId] = updatedApp;
			res.status(200).json({status: 200, content: 'Updated '}).end();
		}
	});
});

/**
 * @api {post} /admin/contexts GetContexts
 * @apiDescription Get all contexsts
 * @apiName AdminGetContexts
 * @apiGroup Admin
 * @apiVersion 0.2.0
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
 * 		status: 500,
 * 		message: "Could not get contexts"
 * 	}
 *
 */
router.post('/contexts', function (req, res) {
	var appId = req._telepat.application_id;

	Models.Context.getAll(appId, function (err, res1) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not get contexts'});
		else {
			res.status(200).json({status: 200, content: res1});
		}
	});
});

/**
 * @api {post} /admin/context GetContext
 * @apiDescription Retrieves a context
 * @apiName AdminGetContext
 * @apiGroup Admin
 * @apiVersion 0.2.0
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
 * 		'message": "Could not get context"
 * 	}
 *
 */
router.post('/context', function (req, res) {
	Models.Context(req.body.id, function (err, res1) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not get context'});
		else {
			res.status(200).json({status: 200, content: res1}).end();
		}
	});
});

/**
 * @api {post} /admin/context/add CreateContext
 * @apiDescription Creates a new context
 * @apiName AdminCreateContext
 * @apiGroup Admin
 * @apiVersion 0.2.0
 *
 * @apiParam {Number} appId ID of the application
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"name": "Episode 2",
 * 		"meta": {"info": "some meta info"},
 * 		"appId": 20
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

/**
 * @api {post} /admin/context/remove RemoveContext
 * @apiDescription Removes a context and all associated objects
 * @apiName AdminRemoveContext
 * @apiGroup Admin
 * @apiVersion 0.2.0
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
	Models.Context.delete(req.body.id, function (err, res1) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not remove context'});
		else {
			res.status(200).json({status: 200, content: "Context removed"});
		}
	});
});

/**
 * @api {post} /admin/context/update UpdateContext
 * @apiDescription Updates the context object
 * @apiName AdminUpdateContext
 * @apiGroup Admin
 * @apiVersion 0.2.0
 *
 * @apiParam {Number} id ID of the context to update
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"id": 1,
 * 		"name": "new name"
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
	Models.Context.update(req.body.id, req.body, function (err, res1, updatedContext) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not update context'});
		else {
			res.status(200).json({status: 200, content: 'Context updated'}).end();
		}
	});
});

/**
 * @api {post} /admin/schemas GetSchemas
 * @apiDescription Gets the model schema for an application
 * @apiName AdminGetSchemas
 * @apiGroup Admin
 * @apiVersion 0.2.0
 *
 * @apiParam {Number} appId ID of the app from which to get the context
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"appId": 20
 * 	}
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
router.post('/schemas', function(req, res, next) {
	var appId = req._telepat.application_id;

	Models.Application.getAppSchema(appId, function(err, result) {
		if (err){
			next(err);
		} else {
			res.status(200).json({status: 200, content: result.value}).end();
		}
	});
});

/**
 * @api {post} /admin/schema/update UpdateSchema
 * @apiDescription Updates the model schema
 * @apiName AdminUpdateSchema
 * @apiGroup Admin
 * @apiVersion 0.2.0
 *
 * @apiParam {Number} appId ID of the app of the schema to update
 * @apiParam {Object} props Updated schema object
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"appId": 20,
 * 		"schema": "see example at /schemas"
 * 	}
 *
 * @apiError 404 NotFound If the App ID doesn't exist
 */
router.post('/schema/update', function(req, res, next) {
	var appId = req._telepat.application_id;
	var schema = req.body.schema;

	Models.Application.updateSchema(appId, schema, function(err, result) {
		if (err){
			next(err);
		} else {
			res.status(200).json({status: 200, content: "Schema updated"}).end();
		}
	});
});


/**
 * @api {post} /admin/users GetAppusers
 * @apiDescription Gets all users of the app
 * @apiName AdminGetUsers
 * @apiGroup Admin
 * @apiVersion 0.2.0
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

router.post('/users', function(req, res, next) {
	var appId = req._telepat.application_id;
	Models.User.getByApplication(appId, function(err, results) {
		if (err) return next(err);

		results.forEach(function(item, index, originalArray) {
			delete originalArray[index].password;
		});

		res.status(200).json({status: 200, content: results}).end();
	});
});


/**
 * @api {post} /admin/user/update EditUser
 * @apiDescription Updates an user from an app
 * @apiName AdminUpdateuser
 * @apiGroup Admin
 * @apiVersion 0.2.0
 *
 * @apiParam {Object} user The object that contains the user (must contain the email to identify him)
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
router.post('/user/update', function(req, res, next) {
	var appId = req._telepat.application_id;
	var props = req.body.user;

	if (props.password) {
		var passwordSalt = req.app.get('password_salt');
		var md5password = crypto.createHash('md5').update(props.password).digest('hex');
		props.password = crypto.createHash('sha256').update(passwordSalt[0]+md5password+passwordSalt[1]).digest('hex');
	}

	Models.User.update(props.email, props, function(err, results) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: "User has been updated"}).end();
	});
});

/**
 * @api {post} /admin/user/delete Deleteuser
 * @apiDescription Deketes an user from an app
 * @apiName AdminDeleteUser
 * @apiGroup Admin
 * @apiVersion 0.2.0
 *
 * @apiParam {String} email The email address of an user from an app
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
	var appId = req._telepat.application_id;
	var userEmail = req.body.email;

	async.waterfall([
		function(callback) {
			Models.User(userEmail, callback);
		},
		function(user, callback) {
			if (user.application_id != appId) {
				var error = new Error('User does not belong to this application');
				error.code = 404;

				return callback(error);
			} else {
				Models.User.delete(userEmail, callback);
			}
		}
	], function(error, results) {
		if (error) return next(error);

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
