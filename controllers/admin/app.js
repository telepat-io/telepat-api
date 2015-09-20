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
 * @apiVersion 0.2.2
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
 * @apiVersion 0.2.2
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
 * @apiVersion 0.2.2
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
router.post('/update', function (req, res) {
	var appId = req._telepat.applicationId;

	Models.Application.update(appId, req.body, function (err, result) {
		if (err)
			res.status(500).send({status: 500, message: 'Could not update app'});
		else {
			app.applications[appId] = result;
			res.status(200).json({status: 200, content: 'Updated'}).end();
		}
	});
});

module.exports = router;