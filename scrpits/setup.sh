#!/bin/sh
apk add py3-lxml git
chown -R node: /home/node/app
exec su - node -c '/bin/sh /home/node/scripts/start.sh'
