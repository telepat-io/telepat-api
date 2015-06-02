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
 * @apiExample {json} Register new device
 * {
 * 		"info": {
 * 			"os": "Android",
 * 			"version": "4.4.3",
 * 			"sdk_level": 19,
 * 			"manufacturer": "HTC",
 * 			"model": "HTC One_M8"
 * 		}
 * 		"persistent": {
 *   		"type": "android",
 *   		"token": "android pn token"
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
 * 		"identifier": "2397bfc7-a3b3-47c0-b677-a4a2eee036e4"
 * 	}
 *
 * 	@apiSuccessExample {json} 'Updated' Response
 * 	{
 * 		"status": 200,
 * 		"message": "Device has been updated"
 * 	}
 *
 */
router.post('/register', function(req, res, next) {
  if (req.body.deviceUDID == '') {
    req.body.id = uuid.v4();

		Models.Subscription.addDevice(req.body, function(err, result) {
			if (!err) {
				return res.status(200).json({status: 200, identifier: req.body.id}).end();
			}

      next(err);
    });
  } else {
    req.body.id = req.body.deviceUDID;

		Models.Subscription.updateDevice(req.body, function(err, result) {
			if (err) return next(err);

			res.status(200).json({status:200, message: "Device has been updated"});
		});
	}
});

module.exports = router;
