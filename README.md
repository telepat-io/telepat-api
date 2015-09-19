[![Build Status](https://travis-ci.org/telepat-io/telepat-api.svg)](https://travis-ci.org/telepat-io/telepat-api)

# Telepat API

This is the Telepat API where all api calls are made. CRUD operations are not processed here directly. Messages are
sent to the Telepat workers where CRUD operations are being taken care of along with client communication (notifications)

## Quick startup guide

To start the API server all you need to do is run one command:

`./bin/www`

You can optionally tell the server to listen another port (default is `3000`) by setting the environment variable PORT.
The API server will try and connect to each of the services until they are available (kafka, couchbase, elasticsearch).

## Configuring

There are two ways to configure: either by modifying the config files `./config/datasources.json` and `./config/kafka.json`
or by setting up environment variables (this method is the most convenient):

* `TP_KFK_HOST`: Kafka (zooekeeper) server
* `TP_KFK_PORT`: Kafka (zooekeeper) server port
* `TP_KFK_CLIENT`: Name for the kafka client
* `TP_CB_HOST`: Couchbase server
* `TP_CB_BUCKET`: Main data bucket of the couchbase server
* `TP_CB_STATE_BUCKET`: State bucket of the couchbase server
* `TP_ES_HOST`: Elasticsearch server
* `TP_ES_PORT`: Elasticsearch server port

API documentation can be found here: [http://docs.telepat.io/api.html](http://docs.telepat.io/api.html)
