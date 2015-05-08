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

/**
 * @api {post} /admin/add Create
 * @apiDescription Creates a new admin
 * @apiName AdminAdd
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 * @apiParam {String} email Admin e-mail
 * @apiParam {String} password The password
 * @apiParam {String} name The name
 *
 */
router.post('/add', function (req, res) {
  Models.Admin.create(req.body.email, { email: req.body.email, password: req.body.password, name: req.body.name }, function (err, result) {
    if (err)
      res.status(500).send({message : "Error adding account"});
    else
      res.send(200);
  });
});

/**
 * @api {post} /admin/me Me
 * @apiDescription Gets information about the logged admin
 * @apiName AdminMe
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 */
router.post('/me', function (req, res) {
  res.json(req.user);
});

/**
 * @api {post} /admin/update Update
 * @apiDescription Updates a new admin. Every property in the request body is used to udpate the admin.
 * @apiName AdminUpdate
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 */
router.post('/update', function (req, res) {
  Models.Admin.update(req.user.email, req.body, function (err, res1) {
    if (err)
      res.status(500).send({message: err});
    else
      res.send(200);
  })
});

/**
 * @api {post} /admin/apps Applications
 * @apiDescription Lists the application for the current admin
 * @apiName AdminApps
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 */
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

/**
 * @api {post} /admin/add/app AppCreate
 * @apiDescription Creates a app for the admin. The request body should contain the app itself.
 * @apiName AdminAppAdd
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 */
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

/**
 * @api {post} /admin/app/remove RemoveApp
 * @apiDescription Removes an app from the admin.
 * @apiName AdminAppRemove
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} appId The ID of the app to remove
 *
 */
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

/**
 * @api {post} /admin/app/update UpdateApp
 * @apiDescription Updates an app
 * @apiName AdminAppUpdate
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} appId ID of the app to update
 *
 */
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

/**
 * @api {post} /admin/contexts GetContexts
 * @apiDescription Get all contexsts
 * @apiName AdminGetContexts
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 */
router.post('/contexts', function (req, res) {
  Models.Context.getAll(req.body.appId, function (err, res1) {
    if (err)
      res.status(500).send({message: 'Could not get contexts'});
    else {
      res.json(res1);
    }
  });
});

/**
 * @api {post} /admin/context GetContext
 * @apiDescription Retrieves a context
 * @apiName AdminGetContext
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} id ID of the context to get
 */
router.post('/context', function (req, res) {
  Models.Context(req.body.id, function (err, res1) {
    if (err)
      res.status(500).send({message: 'Could not get context'});
    else {
      res.json(res1.value);
    }
  });
});

/**
 * @api {post} /admin/context/add CreateContext
 * @apiDescription Creates a new context
 * @apiName AdminCreateContext
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} appId ID of the application
 */
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

/**
 * @api {post} /admin/context/remove RemoveContext
 * @apiDescription Removes a context and all associated objects
 * @apiName AdminRemoveContext
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} id ID of the context to remove
 */
router.post('/context/remove', function (req, res) {
  Models.Context.delete(req.body.id, function (err, res1) {
    if (err)
      res.status(500).send({message: 'Could not remove context'});
    else {
      res.send(200);
    }
  });
});

/**
 * @api {post} /admin/context/update UpdateContext
 * @apiDescription Updates the context object
 * @apiName AdminUpdateContext
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} id ID of the context to update
 */
router.post('/context/update', function (req, res) {
  Models.Context.update(req.body.id, req.body, function (err, res1, updatedContext) {
    if (err)
      res.status(500).send({message: 'Could not update context'});
    else {
      res.send(200);
    }
  });
});

/**
 * @api {post} /admin/schemas GetSchemas
 * @apiDescription Gets the model schema for an application
 * @apiName AdminGetSchemas
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} appId ID of the app from which to get the context
 */
router.post('/schemas', function(req, res, next) {
	var appId = req.body.appId;

	Models.Application.getAppSchema(appId, function(err, result) {
		if (err && err.code == cb.errors.keyNotFound) {
			err.status = 404;
			next(err)
		} else if (err){
			next(err);
		} else {
			res.status(200).send(result.value).end();
		}
	});
});

/**
 * @api {post} /admin/schema/create CreateSchema
 * @apiDescription Gets the model schema for an application
 * @apiName AdminCreateSchema
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} appId ID of the app from which to get the context
 */
router.post('/schema/create', function(req, res, next) {
  var appId = req.body.appId;
  var schema = req.body.schema;

  Models.Application.createSchema(appId, schema, function(err, result) {
    if (err)
      next(err);
    else {
      res.status(200).end();
    }
  });
});

/**
 * @api {post} /admin/schema/update UpdateSchema
 * @apiDescription Updates the model schema
 * @apiName AdminUpdateSchema
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} appId ID of the app of the schema to update
 * @apiParam {String} name Model name
 * @apiParam {Object} props Model properties
 *
 * @apiError NotFound If the App ID doesn't exist
 */
router.post('/schema/update', function(req, res, next) {
	var appId = req.body.appId;
	var name = req.body.name;
	var props = req.body.props;

	Models.Application.updateSchema(name, appId, props, function(err, result) {
		if (err && err.code == cb.errors.keyNotFound) {
			err.status = 404;
			next(err)
		} else if (err){
			next(err);
		} else {
			res.status(200).end();
		}
	});
});

/**
 * @api {post} /admin/schema/delete DeleteSchema
 * @apiDescription Removes a schema model from the app
 * @apiName AdminDeleteSchema
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} appId ID of the app of the schema to delete
 * @apiParam {String} name Model name
 *
 * @apiError NotFound If the App ID doesn't exist
 */
router.post('/schema/delete', function(req, res, next) {
	var appId = req.body.appId;
	var name = req.body.name;

	Models.Application.deleteSchema(name, appId, function(err, result) {
		if (err && err.code == cb.errors.keyNotFound) {
			err.status = 404;
			next(err)
		} else if (err)
			next(err);
		else {
			res.status(200).end();
		}
	});
});

module.exports = router;
