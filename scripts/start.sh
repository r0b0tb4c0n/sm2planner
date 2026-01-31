#!/bin/sh
cd /home/node/app
npm install
echo
echo "Updating class perk data"
python3 /home/node/scripts/data.py
echo
exec /home/node/app/node_modules/.bin/pm2-runtime ecosystem.config.js