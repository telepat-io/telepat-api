var express = require('express');
var router = express.Router();
var Models = require('telepat-models');
var uuid = require('uuid');
var security = require('./security');

router.use(security.applicationIdValidation);
router.use(security.apiKeyValidation);
router.use(security.deviceIdValidation);

/**
 * @api {post} /device/register Register
 * @apiDescription Registers a new device or updates an already existing one. If device UDID is supplied in info it will try
 * to search for a device with this UDID and return the device ID.
 * @apiName DeviceRegister
 * @apiGroup Device
 * @apiVersion 0.2.8
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID if you want to update device info, or
 * 'TP_EMPTY_UDID' string when you want to register a new device (a device id will be generated in this case)
 * @apiHeader {String} X-BLGREQ-APPID Custom header containing the application ID on which to register the device
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the hashed API key
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
 * @apiError 400 [004]MissingRequiredField When registering a new device and info field is missing
 * @apiError 404 [025]DeviceNotFound When updating existing device that doesn't exist
 *
 */
router.post('/register', function(req, res, next) {
	if (req._telepat.device_id == 'TP_EMPTY_UDID' || req._telepat.device_id == '') {

		if (Object.getOwnPropertyNames(req.body).length === 0){
			return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));
		}

		if (!req.body.info) {
			return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['info']));
		}

		var udid = req.body.info.udid;
		req.body.application_id = req._telepat.applicationId;

		if (!udid) {
			req.body.id = uuid.v4();
			Models.Subscription.addDevice(req.body, function (err, result) {
				if (!err) {
					return res.status(200).json({status: 200, content: {identifier: req.body.id}});
				}

				next(err);
			});
		} else {
			Models.Subscription.findDeviceByUdid(req._telepat.applicationId, udid, function(err, result) {
				if (err) return next(err);

				if (result === null) {
					req.body.id = uuid.v4();
					Models.Subscription.addDevice(req.body, function(err) {
						if (!err) {
							return res.status(200).json({status: 200, content: {identifier: req.body.id}});
						}

						next(err);
					});
				} else {
					Models.Subscription.updateDevice(req._telepat.applicationId, result, req.body, function(err) {
						if (err && err.status == 404) {
							return next(new Models.TelepatError(Models.TelepatError.errors.DeviceNotFound, [result]));
						} else if (err)
							return next(err);

						return res.status(200).json({status: 200, content: {identifier: result}});
					});
				}

			});
		}
	} else {

		if (Object.getOwnPropertyNames(req.body).length === 0){
			return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));
		}

		req.body.id = req._telepat.device_id;

		Models.Subscription.updateDevice(req._telepat.applicationId, req._telepat.device_id, req.body, function(err, result) {
			if (err && err.status == 404) {
				return next(new Models.TelepatError(Models.TelepatError.errors.DeviceNotFound));
			} else if (err)
				return next(err);

			res.status(200).json({status:200, content: "Device has been updated"});
		});
	}
});

module.exports = router;
