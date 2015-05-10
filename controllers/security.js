var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var express = require('express');
var router = express.Router();

/**
 * @api {post} /authenticate/admin Authenticate
 * @apiDescription Authenticates an admin
 * @apiName AdminAuthenticate
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 * @apiParam {String} email Email of admin
 * @apiParam {String} password Password of admin
 *
 * @apiError Unauthorized If the provided email and password are not correct
 */
router.post('/admin', function (req, res, next) {
  Models.Admin(req.body.email, function(err, admin) {
    if (err) {
      return next(err);
    }

    if (req.body.password == admin.password) {
      var token = jwt.sign(admin, authSecret, { expiresInMinutes: 60 });
      res.json({ token: token });
    }
    else {
      res.status(401).json({status: 401, message: 'Wrong user or password'});
      return;
    }
  })
});

module.exports = router;
var authSecret = module.exports.authSecret = '835hoyubg#@$#2wfsda';
module.exports.keyValidation = function (req, res, next) {
  res.type('application/json');
  if (req.get('Content-type') !== 'application/json')
    res.status(415).json({status: 415, message: "Request content type must pe application/json."}).end();
  else if (req.get('X-BLGREQ-SIGN') == undefined)
    res.status(401).json({status: 401, message: "Unauthorized. Required authorization header not present."}).end();
  else if (!req.get('X-BLGREQ-APPID'))
    res.status(400).json({status: 400, message: "Requested App ID not found."}).end();
  else {
    var clientHash = req.get('X-BLGREQ-SIGN').toLowerCase();
    var serverHash = null;
    var apiKeys = app.applications[req.get('X-BLGREQ-APPID')].keys;

    async.detect(apiKeys, function(item ,cb) {
      serverHash = crypto.createHash('sha256').update(item).digest('hex').toLowerCase();
      cb(serverHash === clientHash);
    }, function(result) {
      if (result)
        next();
      else
        res.status(401).json({status: 401, message: "Unauthorized. API key is not valid."}).end();
    });
  }
}
