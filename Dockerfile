# Telepat.io API image
#
# VERSION 0.2.3

FROM node:0.12-onbuild
MAINTAINER Andrei Marinescu <andrei@telepat.io>

# install nodemon
RUN npm install --global nodemon

# Apache Kafka, Elasticsearch and Redis default settings
ENV TP_REDIS_HOST 127.0.0.1
ENV TP_REDIS_PORT 6379

ENV TP_ES_HOST 127.0.0.1
ENV TP_ES_PORT 9200
ENV TP_ES_INDEX default

ENV TP_KFK_HOST 127.0.0.1
ENV TP_KFK_CLIENT "octopus-producer"
ENV TP_KFK_PORT 2181

ENV TP_MAIN_DB "ElasticSearch"
ENV TP_PW_SALT \$2a\$10\$N9qo8uLOickgx2ZMRZoMye

EXPOSE 3000
