var express = require('express');
var router = express.Router();
var Models = require('telepat-models');
var uuid = require('uuid');
var security = require('./security');

router.use(security.deviceIdValidation);

/**
 * @api {post} /device/register Register
 * @apiDescription Registers a new device or updates an already existing one. If device udid is supplied in info it will try
 * to search for a device with this udid and return the device id.
 * @apiName DeviceRegister
 * @apiGroup Device
 * @apiVersion 0.2.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID if you want to update device info, or empty
 * string when you want to register a new device (a device id will be generated in this case)
 *
 * @apiExample {json} Register new device
 * {
 * 		"info": {
 * 			"os": "Android",
 * 			"version": "4.4.3",
 * 			"sdk_level": 19,
 * 			"manufacturer": "HTC",
 * 			"model": "HTC One_M8",
 * 			"udid": "some unique identifier"
 * 		}
 * 		"persistent": {
 *   		"type": "android",
 *   		"token": "android pn token",
 *   		"active": 1
 * 		}
 * }
 *
 * @apiExample {json} Update existing device
 * {
 * 		"info": {
 * 			"os": "Android",
 * 			"version": "5.0.1",
 * 			"sdk_level": 20,
 * 			"manufacturer": "HTC",
 * 			"model": "HTC One_M8"
 * 		}
 * 		"persistent": {
 *   		"type": "android",
 *   		"token": "android pn token"
 * 		}
 * }
 *
 * 	@apiSuccessExample {json} 'Created' Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			"identifier": "2397bfc7-a3b3-47c0-b677-a4a2eee036e4"
 * 		}
 * 	}
 *
 * 	@apiSuccessExample {json} 'Updated' Response
 * 	{
 * 		"status": 200,
 * 		"content": "Device has been updated"
 * 	}
 *
 */
router.post('/register', function(req, res, next) {
	if (req._telepat.device_id == '') {
		if (!req.body.info)
			return res.status(400).json({status: 400, message: "Field 'info' is missing from the request body"}).end();

		var udid = req.body.info.udid;

		if (!udid) {
			Models.Subscription.addDevice(req.body, function (err) {
				if (!err) {
					return res.status(200).json({status: 200, content: {identifier: req.body.id}}).end();
				}

				next(err);
			});
		} else {
			Models.Subscription.findDeviceByUdid(udid, function(err, result) {
				if (err) return next(err);

				if (result === null) {
					req.body.id = uuid.v4();
					Models.Subscription.addDevice(req.body, function(err) {
						if (!err) {
							return res.status(200).json({status: 200, content: {identifier: req.body.id}}).end();
						}

						next(err);
					});
				} else {
					return res.status(200).json({status: 200, content: {identifier: result}}).end();
				}

			});
		}
	} else {
		req.body.id = req._telepat.device_id;

		if (Object.getOwnPropertyNames(req.body).length === 0)
			return res.status(400).json({status: 400, message: "Request body is empty"}).end();

		Models.Subscription.updateDevice(req._telepat.device_id, req.body, function(err, result) {
			if (err && err.code == cb.errors.keyNotFound) {
				var error = new Error('Device with ID "'+req._telepat.device_id+'" does not exist.');
				error.status = 404;

				return next(error);
			} else if (err)
				return next(err);

			res.status(200).json({status:200, content: "Device has been updated"});
		});
	}
});

module.exports = router;
