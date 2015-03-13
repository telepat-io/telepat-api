var express = require('express');
var router = express.Router();

/* GET users listing. */
router.all('/', function(req, res, next) {
	try {
		res.set('Content-type', 'application/json');
		res.send(JSON.stringify(req.body));
	}
	catch (e) {
		res.send('Error: '+ e.message);
	}
});

module.exports = router;
