[![Build Status](https://travis-ci.org/telepat-io/telepat-api.svg)](https://travis-ci.org/telepat-io/telepat-api) [![Test Coverage](https://codeclimate.com/github/telepat-io/telepat-api/badges/coverage.svg)](https://codeclimate.com/github/telepat-io/telepat-api/coverage) [![Code Climate](https://codeclimate.com/github/telepat-io/telepat-api/badges/gpa.svg)](https://codeclimate.com/github/telepat-io/telepat-api)

# Telepat API

This is the Telepat API where all api calls are made. CRUD operations are not processed here directly. Messages are
sent to the Telepat workers where CRUD operations are being taken care of along with client communication (notifications)

## Quick startup guide

To start the API server all you need to do is run one command:

`./bin/www`

You can optionally tell the server to listen another port (default is `3000`) by setting the environment variable PORT.
The API server will try and connect to each of the services until they are available (kafka, couchbase, elasticsearch).

## Configuring

There are two ways to configure: either by using the `config.example.json` config file (rename it into config.json)
or by setting up environment variables (this method is the most convenient):

* `TP_KFK_HOST`: Kafka (zooekeeper) server
* `TP_KFK_PORT`: Kafka (zooekeeper) server port
* `TP_KFK_CLIENT`: Name for the kafka client
* `TP_REDIS_HOST`: Redis server
* `TP_REDIS_PORT`: Redis server port
* `TP_MAIN_DB`: Name of the main database which to use. Should be the same as the exported variable in telepat-models
* `TP_ES_HOST`: Elasticsearch server (if you are using the ES database adapter)
* `TP_ES_PORT`: Elasticsearch server port (if you are using the ES database adapter)
* `TP_PW_SALT`: Password salt used for hashing passwords

## Testing

To run just the tests using mocha (make sure you have installed globally `npm install mocha`):

* `mocha api.js` in the test folder
* `npm test` in the root folder will also run istanbul (make sure you install it globally) code coverage tool

**Notice**: the testing suite automatically starts the API server but **NOT** the telepat workers. You should start them
before running the tests.

API documentation can be found here: [http://docs.telepat.io/api.html](http://docs.telepat.io/api.html)
