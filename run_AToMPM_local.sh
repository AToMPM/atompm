#!/bin/bash
# Author: Yentl Van Tendeloo and Bentley James Oakes

set -e

echo "Running AToMPM script..."
echo "Starting node..."
node httpwsd.js &
serverpid=$!
sleep 3

echo "Starting Python model transformation engine..."
python mt/main.py&
mtpid=$!
sleep 1

echo "AToMPM now running. Opening browser..."
set +e


echo "Trying to run Chromium..."
chromium-browser http://localhost:8124/atompm

ret=$?
if [ $ret -ne 0 ]; then
    echo "Chromium not installed. Trying Google Chrome..."
    google-chrome-stable http://localhost:8124/atompm
fi

ret=$?
if [ $ret -ne 0 ]; then
    echo "Google Chrome not installed. Trying Firefox..."
    firefox http://localhost:8124/atompm
fi

ret=$?
if [ $ret = 0 ]; then
    echo "Stopping AToMPM"
    kill $serverpid
    kill $mtpid
    echo "Finished!"
fi
