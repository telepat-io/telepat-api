var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cb = require('couchbase');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

app.config = {'datasources': require('./config/datasources')};

app.database = {Couchbase: new cb.Cluster('couchbase://'+app.config.datasources.couchbase.host)};
app.database.Couchbase.bucket = app.database.Couchbase.openBucket(app.config.datasources.couchbase.bucket);

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next) {
	res.set('Content-type', 'application/json');
	if (req.get('Content-type') !== 'application/json')
		res.status(415).send(JSON.stringify({status: 415, message: {content: "Request content type must pe application/json."}}));
	else if (req.get('X-BLGREQ-SIGN') == undefined)
		res.status(401).send(JSON.stringify({status: 401, message: {content: "Unauthorized"}}));
	else
		next();
});

app.use('/', routes);
app.use('/users', users);

// error handlers
// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.send(JSON.stringify({
			status: err.status || 500,
			message: {
				content: err.message,
				stack: err.stack
			}
		}));
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.send(JSON.stringify({
		status: err.status || 500,
		message: {
			content: err.message
		}
	}));
});

module.exports = app;
