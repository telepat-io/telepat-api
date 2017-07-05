#!/usr/bin/env bash
pwd
git clone -b develop https://github.com/telepat-io/telepat-worker.git
cd telepat-worker
npm install
rm -rf node_modules/telepat-models
npm install https://github.com/telepat-io/telepat-models.git#develop
cd ..
rm -rf node_modules/telepat-models
npm install https://github.com/telepat-io/telepat-models.git#develop
touch config.json
cat config.example.json > config.json
sed -i 's/\"message_queue\": \"kafka\"/\"message_queue\": \"amqp\"/' config.json
sed -i 's/hostname/localhost/' config.json
sed -i 's/10\.0\.0\../localhost/' config.json
sed -i 's/telepat/guest/' config.json
sed -i 's/\"password\": \"password\"/\"password\": \"guest\"/' config.json
sed -i 's/client_id\": \"\"/client_id\": \"302877690161802\"/' config.json
sed -i 's/client_secret\": \"\"/client_secret\": \"61beaa81f3626984c8b352e3e7270625\"/' config.json
sed -i 's/consumer_key\": \"\"/consumer_key\": \"YyrrdUTNHdAldxuUUoZkImiIH\"/' config.json
sed -i 's/consumer_secret\": \"\"/consumer_secret\": \"OVaFe401Zo9Dc2j2ckrIWZCevDti3wB7eyZJD8WHbnw5cmGndE\"/' config.json
sed -i 's/api_key\": \"\"/api_key\": \"5a2270a08cc1e616cc8ee4fc664fc785-us16\"/' config.json

cp config.json telepat-worker/config.json
cat config.json
forever start --append --uid "aggregation" -o telepat-worker/aggregation.out -e telepat-worker/aggregation.err telepat-worker/index.js -t aggregation -i 0
forever start --append --uid "write" -o telepat-worker/write.out -e telepat-worker/write.err telepat-worker/index.js -t write -i 0
forever start --append --uid "transport_manager" -o telepat-worker/transport_manager.out -e telepat-worker/transport_manager.err telepat-worker/index.js -t transport_manager -i 0
forever start --append --uid "android" -o telepat-worker/android.out -e telepat-worker/android.err telepat-worker/index.js -t android_transport -i 0
forever start --append --uid "ios" -o telepat-worker/ios.out -e telepat-worker/ios.err telepat-worker/index.js -t ios_transport -i 0
exit 0
