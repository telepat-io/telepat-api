var express = require('express');
var router = express.Router();
var Models = require('octopus-models-api');
var security = require('./security');

router.use(security.keyValidation);

/**
 * @api {post} /context/all GetContexts
 * @apiDescription Get all contexsts
 * @apiName AdminGetContexts
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 */
router.post('/all', function (req, res) {
  Models.Context.getAll(req.body.appId, function (err, res1) {
    if (err)
      res.status(500).send({message: 'Could not get contexts'});
    else {
      res.json(res1);
    }
  });
});

/**
 * @api {post} /context GetContext
 * @apiDescription Retrieves a context
 * @apiName AdminGetContext
 * @apiGroup Admin
 * @apiVersion 0.0.1
 *
 * @apiParam {Number} id ID of the context to get
 */
router.post('/', function (req, res) {
  Models.Context(req.body.id, function (err, res1) {
    if (err)
      res.status(500).send({message: 'Could not get context'});
    else {
      res.json(res1);
    }
  });
});

module.exports = router;