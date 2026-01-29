#!/bin/sh
cd /home/node/app
npm install
echo "updating class data"
python3 /home/node/scripts/data.py
exec /home/node/app/node_modules/.bin/pm2-runtime ecosystem.config.js
