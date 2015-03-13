function Application(app, _id, cb) {

	var id = null;
	var name = '';
	var apiKey = null;

	app.get('database').Couchbase.bucket.get('blg.application.'+_id, (function(err, res) {
		var result = JSON.parse(res.value);
		this.apiKey = result.key;

		cb(err, res);
	}).bind(this));
};

Application.prototype.get = function(key) {
	if (this.hasOwnProperty(key))
		return this[key];

	return null;
};


module.exports.Application = Application;
