var express = require('express');
var router = express.Router();
var Models = require('telepat-models');

/**
 * @api {post} /til/append Append member
 * @apiDescription Adds a member to a Telepat Indexed List
 * @apiName TilAppend
 * @apiGroup TelepatIndexedLists
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 *
 * @apiParam {String} listName Name of the list where to add the member
 * @apiParam {String} indexedProperty The field for which the list will hold indexed members
 * @apiParam {Object} memberObject The key is the member name, the value must only be a string
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"listName": "object_id",
 * 		"indexedProperty": "fid",
 * 		"memeberObject": {
 * 			"fid_1": "0"
 * 		}
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": "Member added to list"
 * 	}
 *
 */
router.post('/append', function(req, res, next) {
	var listName = req.body.listName;
	var indexedProperty = req.body.indexedProperty;
	var memeberObject = req.body.memberObject;

	if (!listName || typeof listName != 'string')
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['listName, or not a string']));
	if (!indexedProperty || typeof indexedProperty != 'string')
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['indexedProperty, or not a string']));
	if (!memeberObject || !(memeberObject instanceof Object))
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['memeberObject, or not an object']));

	Models.TelepatIndexedList.append(listName, indexedProperty, memeberObject, function(err) {
		if (err)
			return next(err);

		res.status(200).json({status: 200, content: 'Member added to list'});
	});
});

/**
 * @api {post} /til/get Get members
 * @apiDescription Checks if a list of memebers belongs to this indexed list
 * @apiName TilGet
 * @apiGroup TelepatIndexedLists
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 *
 * @apiParam {String} listName Name of a Telepat Indexed List
 * @apiParam {String} indexedProperty The field for which the list will hold indexed members
 * @apiParam {String[]} members Array of members to check for
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"listName": "object_id",
 * 		"indexedProperty": "fid",
 * 		"members": ["fid_1", "fid_2"]
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			"fid_1": true,
 * 			"fid_2": false
 * 		}
 * 	}
 *
 */
router.post('/get', function(req, res, next) {
	var listName = req.body.listName;
	var indexedProperty = req.body.indexedProperty;
	var members = req.body.members;

	if (!listName || typeof listName != 'string')
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['listName, or not a string']));
	if (!indexedProperty || typeof indexedProperty != 'string')
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['indexedProperty, or not a string']));
	if (!members || !Array.isArray(members))
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['members, or is not an array']));

	Models.TelepatIndexedList.get(listName, indexedProperty, members, function(err, results) {
		if (err)
			return next(err);

		res.status(200).json({status: 200, content: results});
	});
});

/**
 * @api {post} /til/removeList Remove List
 * @apiDescription Removes a list completely
 * @apiName TilRemoveList
 * @apiGroup TelepatIndexedLists
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 *
 * @apiParam {String} listName Name of the list to be removed
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"listName": "object_id"
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			"removed": true
 * 		}
 * 	}
 *
 */
router.post('/removeList', function(req, res, next) {
	var listName = req.body.listName;

	if (!listName || typeof listName != 'string')
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['listName, or not a string']));

	Models.TelepatIndexedList.removeList(listName, function(err, result) {
		if (err)
			return next(err);

		res.status(200).json({status: 200, content: {removed: result}});
	});
});

/**
 * @api {post} /til/removeMember Remove member
 * @apiDescription Removes a member from a list
 * @apiName TilRemoveMember
 * @apiGroup TelepatIndexedLists
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 *
 * @apiParam {String} listName Name of the list from which to delete the member
 * @apiParam {String} indexedProperty The field for which the list will hold indexed members
 * @apiParam {String} member The member to remove
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"listName": "object_id",
 * 		"indexedProperty": "fid",
 * 		"member": "fid_1"
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			"removed": true
 * 		}
 * 	}
 *
 */
router.post('/removeMember', function(req, res, next) {
	var listName = req.body.listName;
	var indexedProperty = req.body.indexedProperty;
	var member = req.body.member;

	if (!listName || typeof listName != 'string')
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['listName, or not a string']));
	if (!indexedProperty || typeof indexedProperty != 'string')
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['indexedProperty, or not a string']));
	if (!member || typeof member != 'string')
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['member, or not a string']));

	Models.TelepatIndexedList.removeMember(listName, indexedProperty, member, function(err, result) {
		if (err)
			return next(err);

		res.status(200).json({status: 200, content: {removed: result}});
	});
});

module.exports = router;
