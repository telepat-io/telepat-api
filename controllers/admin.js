var express = require('express');
var router = express.Router();
var expressJwt = require('express-jwt');
var security = require('./security');

router.use(expressJwt({secret: security.authSecret}));

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
})

module.exports = router;