var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var Models = require('octopus-models-api');
var expressJwt = require('express-jwt');

var security = {}

security.authSecret = '835hoyubg#@$#2wfsda';

security.createToken = function (data) {
  return jwt.sign(data, this.authSecret, { expiresInMinutes: 60 });
}

/**
 * This middleware makes sure that all required headers are set for a general purpose request. It also checks if the API key belongs to
 * the requested app.
 *
 */
security.keyValidation = function (req, res, next) {
  res.type('application/json');
  if (req.get('Content-Type').substring(0, 16) !== 'application/json')
    res.status(415).json({status: 415, message: "Request content type must pe application/json."}).end();
  else if (req.get('X-BLGREQ-SIGN') === undefined)
    res.status(401).json({status: 401, message: "Unauthorized. Required authorization header not present."}).end();
  else if (req.get('X-BLGREQ-UDID') === undefined)
    res.status(401).json({status: 401, message: "Unauthorized. Device identifier header not present."}).end();
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
};

security.corsValidation = function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-BLGREQ-SIGN, X-BLGREQ-APPID, X-BLGREQ-UDID");
  if ('OPTIONS' == req.method) {
    res.send(200);
  }
  else {
    next();
  }
}

security.tokenValidation = function(req, res, next) {
  return (expressJwt({secret: security.authSecret}))(req, res, next);
}

security.adminAppValidation = function (req, res, next) {
  if (app.applications.hasOwnProperty(req.body.appId)) {
    if (app.applications[req.body.appId].admin_id == req.user.email) {
      next();
    }
    else {
      res.status(400).send({message: 'Naughty'});
    }
  }
  else {
    res.status(400).send({message: 'What app?'});
  }
}

security.objectACL = function (accessControl) {
  return function(req, res, next) {
    if (req.body.model) {
      var acl = Models.Application.loadedAppModels[req.get('X-BLGREQ-APPID')][req.body.model][accessControl];

      if (!req.headers.authorization)
        return res.status(401).json({message: "Authorization header is not present"}).end();

      if (acl & ACL_AUTHENTICATED || acl & ACL_ADMIN) {
        var authHeaderParts = req.headers.authorization.split(' ');
        var authToken = authHeaderParts[1];

        if (authToken) {
          jwt.verify(authToken, security.authSecret, function (err, decoded) {
            if (err)
              return res.status(401).json({message: "Invalid authorization: " + err.message}).end();

            if ((acl & ACL_ADMIN) && (!decoded.isAdmin) )
              return res.status(403).json({message: "You don't have the necessary privilegies for this operation"}).end();

            req.user = decoded;

            next();
          });
        } else {
          res.status(400).json({status: 400, message: 'Authorization header field is not formed well'}).end();
        }
      }
      else if (acl & ACL_UNAUTHENTICATED) {
        next();
      } else {
        res.status(403).json({message: "You don't have the necessary privilegies for this operation"}).end();
      }
    }
  }
}

module.exports = security;