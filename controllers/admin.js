var express = require('express');
var router = express.Router();
var expressJwt = require('express-jwt');
var security = require('./security');

var unless = function(path, middleware) {
    return function(req, res, next) {
        if (path === req.path) {
            return next();
        } else {
            return middleware(req, res, next);
        }
    };
};

router.use(unless('/add', expressJwt({secret: security.authSecret})));

router.post('/me', function (req, res) {
  res.json(req.user);
});

router.post('/add', function (req, res) {
  Models.Admin.create(req.body.email, { email: req.body.email, password: req.body.password, name: req.body.name }, function (err, result) {
    if (err)
      res.status(500).send({message : "Error adding account"})
    else
      res.send(200);
  });
});

router.post('/apps', function (req, res) {
    var adminApps = {};
    async.each(Object.keys(app.applications), function(applicationId, c){
        if (true || app.applications[applicationId].admin_id == req.user.id)
          adminApps[applicationId] = app.applications[applicationId];
        c();
      }, function(err) {
        if (err) {
          res.send(500, err);
        }
        else {
          res.json(adminApps);
        }
    });
});

module.exports = router;