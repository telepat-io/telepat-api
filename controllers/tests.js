var express = require('express');
var router = express.Router();
var Models = require('octopus-models-api');
var sizeof = require('object-sizeof');

router.use(function(req, res, next) {
	//roughly 67M
	if (sizeof(Models.Application.loadedAppModels) > (1 << 26)) {
		delete Models.Application.loadedAppModels;
		Models.Application.loadedAppModels = {};
	}

	if (!Models.Application.loadedAppModels[req.get('X-BLGREQ-APPID')]) {
		Models.Application.loadAppModels(req.get('X-BLGREQ-APPID'), next);
	} else
		next();
});

router.post('/get', function(req, res, next) {
	var id = req.body.id;
	//var context = req.body.context;
	var model = req.body.model;

	new Models.Model(model, id, function(err, results) {
		if(err) return next(err);

		res.json(results).end();
	});
});

router.post('/getAll', function(req, res, next) {
	var id = req.body.id;
	var context = req.body.context;
	var model = req.body.model;

	Models.Model.getAll(model, context, function(err, results) {
		if(err) return next(err);

		res.json(results).end();
	});
});

router.post('/lookup', function(req, res, next) {
	var id = req.body.id;
	var context = req.body.context;
	var model = req.body.model;
	var user_id = req.body.user_id;
	var parent = req.body.parent;
	var key = req.body.answerKey;

	Models.Model.lookupWithKey(model, context, key, user_id, parent, function(err, results) {
		if(err) return next(err);

		res.json(results).end();
	});
});

router.post('/delete', function(req, res, next) {
	var id = req.body.id;
	var model = req.body.model;

	Models.Model.delete(model, req.get('X-BLGREQ-APPID'), id, false, function(err, results) {
		if(err) return next(err);

		res.json(results).end();
	});
});

router.post('/count', function(req, res, next) {
	var id = req.body.id;
	var context = req.body.context;
	var model = req.body.model;
	var user_id = req.body.user_id;
	var parent = req.body.parent;

	Models.Model.count(model, function(err, results) {
		if(err)  {
			console.trace();
			return next(err);
		}

		res.json(results).end();
	});
});

router.post('/create', function(req, res, next) {
	var props = req.body.props;
	var model = req.body.model;
	var appId = props.application_id;

	Models.Model.create(model, appId, props, function(err, results) {
		if(err)  {
			console.trace('Create trace: ');
			return next(err);
		}

		res.json(results).end();
	});
});

router.post('/update', function(req, res, next) {
	var id = req.body.id;
	var props = req.body.props;
	var context = req.body.context;
	var model = req.body.model;
	var user_id = req.body.user_id;
	var parent = req.body.parent;

	Models.Model.getAll(model, context, props, user_id, parent, function(err, results) {
		if(err) return next(err);

		res.json(results).end();
	});
});

router.post('/create_context', function(req, res, next) {
	var props = req.body.props;

	Models.Context.create(props, function(err, results) {
		if(err)  {
			console.trace('Create trace: ');
			return next(err);
		}

		res.json(results).end();
	});
});

module.exports = router;
