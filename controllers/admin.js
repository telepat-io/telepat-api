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

router.post('/add', function (req, res) {
  Models.Admin.create(req.body.email, { email: req.body.email, password: req.body.password, name: req.body.name }, function (err, result) {
    if (err)
      res.status(500).send({message : "Error adding account"})
    else
      res.send(200);
  });
});

router.post('/me', function (req, res) {
  res.json(req.user);
});

router.post('/update', function (req, res) {
  Models.Admin.update(req.user.email, req.body, function (err, res1) {
    if (err)
      res.status(500).send({message: err});
    else
      res.send(200);
  })
});

router.post('/apps', function (req, res) {
    var adminApps = {};
    async.each(Object.keys(app.applications), function(applicationId, c){
        if (app.applications[applicationId].admin_id == req.user.email)
          adminApps[applicationId] = app.applications[applicationId];
        c();
      }, function(err) {
        if (err) {
          res.status(500).send({message: "Server issue"});
        }
        else {
          res.json(adminApps);
        }
    });
});

router.post('/apps/add', function (req, res) {
  var newApp = req.body;
  newApp['admin_id'] = req.user.email;
  Models.Application.create(newApp, function (err, res1, newIndex) {
    if (err)
      res.status(500).send({message: 'Could not add app'});
    else {
      app.applications[newIndex] = newApp;
      res.status(200).send({id: newIndex});
    }
  });
});

router.post('/apps/remove', function (req, res) {
  if (app.applications.hasOwnProperty(req.body.id)) {
    if (app.applications[req.body.id].admin_id == req.user.email) {
      Models.Application.delete(req.body.id, function (err, res1) {
        if (err)
          res.status(500).send({message: 'Could not remove app'});
        else {
          delete app.applications[req.body.id];
          res.send(200);
        }
      });
    }
    else {
      res.status(400).send({message: 'Naughty'});
    }
  }
  else {
    res.status(400).send({message: 'Naughty'});
  }

});

router.post('/apps/update', function (req, res) {
  if (app.applications.hasOwnProperty(req.body.id)) {
    if (app.applications[req.body.id].admin_id == req.user.email) {
      Models.Application.update(req.body.id, req.body, function (err, res1, updatedApp) {
        if (err)
          res.status(500).send({message: 'Could not update app'});
        else {
          app.applications[req.body.id] = updatedApp;
          res.send(200);
        }
      });
    }
    else {
      res.status(400).send({message: 'Naughty'});
    }
  }
  else {
    res.status(400).send({message: 'Naughty'});
  }

});

module.exports = router;