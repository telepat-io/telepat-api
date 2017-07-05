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
cp config.json telepat-worker/config.json
cat config.json
forever start --append --uid "aggregation" -o telepat-worker/aggregation.out -e telepat-worker/aggregation.err telepat-worker/index.js -t aggregation -i 0
forever start --append --uid "write" -o telepat-worker/write.out -e telepat-worker/write.err telepat-worker/index.js -t write -i 0
forever start --append --uid "transport_manager" -o telepat-worker/update_friends.out -e telepat-worker/update_friends.err telepat-worker/index.js -t update_friends -i 0
forever start --append --uid "android" -o telepat-worker/android.out -e telepat-worker/android.err telepat-worker/index.js -t android_transport -i 0
forever start --append --uid "ios" -o telepat-worker/ios.out -e telepat-worker/ios.err telepat-worker/index.js -t ios_transport -i 0
exit 0
