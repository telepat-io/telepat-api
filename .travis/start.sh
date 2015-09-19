forever start --append --uid "aggregation" telepat-worker/index.js -t aggregation -i 0
forever start --append --uid "write" telepat-worker/index.js -t write -i 0
#forever start --append --uid "track" telepat-worker/index.js -t track -i 0
forever start --append --uid "update_friends" telepat-worker/index.js -t update_friends -i 0
forever start --append --uid "android" telepat-worker/index.js -t android_transport -i 0
forever start --append --uid "ios" telepat-worker/index.js -t ios_transport -i 0
#sudo forever start --append --uid "sockets" telepat-worker/index.js -t sockets_transport -i 0
