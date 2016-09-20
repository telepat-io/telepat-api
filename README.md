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

* `TP_MSG_QUE`: Name of the messaging client you want to use. Should be the same as the exported variable in
telepat-models
* `TP_MAIN_DB`: Name of the main database which to use. Should be the same as the exported variable in telepat-models
* `TP_PW_SALT`: Password salt used for hashing passwords

**Important**: You need to set up the other config variables specified in the `telepat-models` README file for resources
that you're using.

## Testing

To run just the tests using mocha (make sure you have installed globally `npm install mocha`):

* `mocha api.js` in the test folder
* `npm test` in the root folder will also run istanbul (make sure you install it globally) code coverage tool

**Notice**: the testing suite automatically starts the API server but **NOT** the telepat workers. You should start them
before running the tests.

API documentation can be found here: [http://docs.telepat.io/api.html](http://docs.telepat.io/api.html)
