var express = require('express');
var router = express.Router();
var Models = require('octopus-models-api');
var uuid = require('uuid');
var security = require('./security');

router.use(security.keyValidation);

/**
 * @api {post} /device/register Register
 * @apiDescription Registers a new device or updates an already existing one.
 * @apiName DeviceRegister
 * @apiGroup Device
 * @apiVersion 0.0.1
 *
 * @apiError NotAuthenticated  Only authenticated users may access this endpoint.
 */
router.post('/register', function(req, res, next) {
	if (req.get('X-BLGREQ-UDID') == '') {
		req.body.id = uuid.v4();

		Models.Subscription.addDevice(req.body, function(err, result) {
			if (!err) {
				return res.status(200).json({status: 200, identifier: req.body.id}).end();
			}

			next(err);
		});
	} else {
		req.body.id = req.get('X-BLGREQ-UDID');

		Models.Subscription.updateDevice(req.body, function(err, result) {
			if (err) return next(err);

			res.status(200).json({status:200, message: "Device has been updated"});
		});
	}
});

module.exports = router;
