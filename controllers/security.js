var jwt = require('jsonwebtoken');

module.exports.keyValidation = function (req, res, next) {
  res.type('application/json');
  if (req.get('Content-type') !== 'application/json')
    res.status(415).json({status: 415, message: {content: "Request content type must pe application/json."}}).end();
  else if (req.get('X-BLGREQ-SIGN') == undefined)
    res.status(401).json({status: 401, message: {content: "Unauthorized. Required authorization header not present."}}).end();
  else if (!req.get('X-BLGREQ-APPID'))
    res.status(400).json({status: 400, message: {content: "Requested App ID not found."}}).end();
  else {
    var clientHash = req.get('X-BLGREQ-SIGN').toLowerCase();
    var serverHash = null;
    var apiKeys = app.applications[req.get('X-BLGREQ-APPID')].keys;

    async.detect(apiKeys, function(item ,cb) {
      serverHash = crypto.createHash('sha256').update(item).digest('hex').toLowerCase();
      cb(serverHash === clientHash);
    }, function(result) {
      if (result)
        next();
      else
        res.status(401).json({status: 401, message: {content: "Unauthorized. API key is not valid."}}).end();
    });
  }
}

module.exports.authenticate = function (req, res) {
  if (!(req.body.email === 'gabi@appscend.com' && req.body.password === 'password')) {
    res.status(401).json({status: 401, message: {content: 'Wrong user or password'}});
    return;
  }

  var profile = {
    first_name: 'Gabi',
    last_name: 'Dobo',
    email: 'gabi@appscend.com',
    id: 1
  };

  var token = jwt.sign(profile, authSecret, { expiresInMinutes: 60*5 });
  res.json({ token: token });
}