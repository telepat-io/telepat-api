function importTest(name, path) {
	describe(name, function () {
		require(path);
	});
}

function normalizePort(val) {
	var port = parseInt(val, 10);
	if (isNaN(port)) {
		return val;
	}
	if (port >= 0) {
		return port;
	}
	return false;
};

describe('API', function () {

	before(function (done) {
		this.timeout(15000);
		app = require('../app',done);
		var http = require('http');
		var port = normalizePort(process.env.PORT || '3000');
		app.set('port', port);
		server = http.createServer(app);
		server.listen(port);
		server.on('listening', function() {
			setTimeout(done, 3000);
		//done();
		});
	});

	after(function (done) {
		server.close();
		done();
	});

	importTest("Admin", './admin/admin');
	importTest("Context", './context/context');
	importTest("Device", './device/device');
	importTest("Object", './object/object');
	importTest("User", './user/user');
});
