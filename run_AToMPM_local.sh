#!/bin/bash
# Author: Yentl Van Tendeloo

set -e

node httpwsd.js &
serverpid=$!
sleep 3

python2 mt/main.py&
mtpid=$!
sleep 1

chromium --app=http://localhost:8124/atompm

kill $serverpid
kill $mtpid
echo "All done!"
