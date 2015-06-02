var express = require('express');
var router = express.Router();
var Models = require('octopus-models-api');
var uuid = require('uuid');
var security = require('./security');
var Models = require('octopus-models-api');

router.use(security.keyValidation);

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