var express = require('express');
var router = express.Router();
var expressJwt = require('express-jwt');
var security = require('./security');
var Models = require('octopus-models-api');

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
router.use(['/apps/remove', 'apps/update'], function (req, res, next) {
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
});

router.post('/add', function (req, res) {
  Models.Admin.create(req.body.email, { email: req.body.email, password: req.body.password, name: req.body.name }, function (err, result) {
    if (err)
      res.status(500).send({message : "Error adding account"});
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

router.post('/app/add', function (req, res) {
  var newApp = req.body;
  newApp['admin_id'] = req.user.email;
  Models.Application.create(newApp, function (err, res1) {
    if (err)
      res.status(500).send({message: 'Could not add app'});
    else {
      var newIndex;
      for (var key in res1) {
        if (res1.hasOwnProperty(key)) {
          newIndex = key;
        }
      }
      app.applications[newIndex] = res1[newIndex];
      res.status(200).send(res1);
    }
  });
});

router.post('/app/remove', function (req, res) {
  Models.Application.delete(req.body.appId, function (err, res1) {
    if (err)
      res.status(500).send({message: 'Could not remove app'});
    else {
      delete app.applications[req.body.appId];
      res.send(200);
    }
  });
});

router.post('/app/update', function (req, res) {
  Models.Application.update(req.body.appId, req.body, function (err, res1, updatedApp) {
    if (err)
      res.status(500).send({message: 'Could not update app'});
    else {
      app.applications[req.body.appId] = updatedApp;
      res.send(200);
    }
  });
});

router.post('/contexts', function (req, res) {
  Models.Context.getAll(req.body.appId, function (err, res1) {
    if (err)
      res.status(500).send({message: 'Could not get contexts'});
    else {
      res.json(res1);
    }
  });
});

router.post('/context', function (req, res) {
  Models.Context(req.body.id, function (err, res1) {
    if (err)
      res.status(500).send({message: 'Could not get context'});
    else {
      res.json(res1.value);
    }
  });
});

router.post('/context/add', function (req, res) {
  var newContext = req.body;
  newContext['application_id'] = req.body.appId;
  Models.Context.create(newContext, function (err, res1) {
    if (err)
      res.status(500).send({message: 'Could not add context'});
    else {
      res.status(200).send(res1);
    }
  });
});

router.post('/context/remove', function (req, res) {
  Models.Context.delete(req.body.id, function (err, res1) {
    if (err)
      res.status(500).send({message: 'Could not remove context'});
    else {
      res.send(200);
    }
  });
});

router.post('/context/update', function (req, res) {
  Models.Context.update(req.body.id, req.body, function (err, res1, updatedContext) {
    if (err)
      res.status(500).send({message: 'Could not update context'});
    else {
      res.send(200);
    }
  });
});

router.post('/schemas', function(req, res, next) {
	var appId = req.body.appId;

	Models.Application.getAppSchema(appId, function(err, result) {
		if (err){
			next(err);
		} else {
			res.status(200).send(result.value).end();
		}
	});
});

router.post('/schema/update', function(req, res, next) {
	var appId = req.body.appId;
	var schema = req.body.schema;
  
	Models.Application.updateSchema(appId, schema, function(err, result) {
		if (err){
			next(err);
		} else {
			res.status(200).end();
		}
	});
});

module.exports = router;
