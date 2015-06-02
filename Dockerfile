# Telepat.io API image
#
# VERSION 0.0.1

FROM node:0.10-onbuild
MAINTAINER Andrei Marinescu <andrei@telepat.io>

# install nodemon
RUN npm install --global nodemon

# Apache Kafka, Elasticsearch and Couchbase default settings
ENV TP_CB_HOST localhost
ENV TP_CB_BUCKET default
ENV TP_CB_STATE_BUCKET "state"

ENV TP_ES_HOST localhost
ENV TP_ES_PORT 9200

ENV TP_KFK_HOST localhost
ENV TP_KFK_PORT 2181
ENV TP_KFK_CLIENT‏ "octopus-producer"

EXPOSE 3000
