/* jshint maxlen: 120 */

var express = require('express');
var router = express.Router();

var adminRoute = require('./admin/admin');
var appRoute = require('./admin/app');
var contextRoute = require('./admin/context');
var schemaRoute = require('./admin/schema');
var userRoute = require('./admin/user');

var security = require('./security');
var Models = require('telepat-models');
var async = require('async');

router.use('/', adminRoute);
router.use('/app', appRoute);
router.use('/context', contextRoute);
router.use('/schema', schemaRoute);
router.use('/user', userRoute);

router.use('/contexts',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);

var getContexts = function (req, res, next) {
	var offset = req.body ? req.body.offset : undefined;
	var limit = req.body ? req.body.limit : undefined;

	Models.Context.getAll(req._telepat.applicationId, offset, limit, function (err, res1) {
		if (err)
			next(err);
		else {
			res.status(200).json({status: 200, content: res1});
		}
	});
};

/** @depreacted Use /admin/context/all instead**/
router.post('/contexts', getContexts);

/** @deprecated Use /admin/context/all instead**/
router.get('/contexts', getContexts);

router.use('/schemas',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);

/** @deprecated: use /admin/schema/all instead **/
router.get('/schemas', function(req, res, next) {
	Models.Application.getAppSchema(req._telepat.applicationId, function(err, result) {
		if (err){
			next(err);
		} else {
			res.status(200).json({status: 200, content: result});
		}
	});
});


router.use('/users',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);

/** Deprecated **/
router.post('/users', function(req, res, next) {
	var offset = req.body.offset;
	var limit = req.body.limit;

	Models.User.getAll(req._telepat.applicationId, limit, offset, function(err, results) {
		if (err) return next(err);

		results.forEach(function(item, index, originalArray) {
			delete originalArray[index].password;
		});

		res.status(200).json({status: 200, content: results});
	});
});

module.exports = router;
