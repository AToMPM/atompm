#!/bin/bash

#exit on errors
set -e

if [ "$#" -ge 1 ] 
then
    if [ "$#" -ge 2 ] 
    then
        logname="${2:8:-3}_"
    else
        logname="${1:8:-3}_"
    fi
else
logname=""
fi

mkdir -p -- "logs"
# subtle process cleanup
echo "Cleaning up any lingering AToMPM processes..."
pkill -f "node httpwsd.js" || true
pkill -f "python3 mt/main.py" || true

#run server
echo "Starting server..."
node httpwsd.js --log=HTTP > "./logs/${logname}node.log" 2>&1 &
serverpid=$!

# wait for server to be ready
echo "Waiting for server to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
while ! curl -s http://localhost:8124/favicon.png > /dev/null; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "Server failed to start after $MAX_RETRIES seconds"
        kill "$serverpid"
        exit 1
    fi
    sleep 1
done
echo "Server is ready."

#check if server is dead
if ! kill -0 "$serverpid"; then
    wait $serverpid
    server_status=$?
    echo "model transformation server failed to start" >> "./logs/${logname}node.log"
    exit $server_status
fi

#run mt script
echo "Starting model transformation script..."
python3 mt/main.py > "./logs/${logname}python.log" 2>&1 &
mtpid=$!
sleep 3

ps

#check if model transformer is dead
if ! kill -0 "${mtpid}"; then
    wait ${mtpid}
    mt_status=$?
    echo "model transformation server failed to start" >> "./logs/${logname}python.log"
    exit $mt_status
fi

#echo "Starting Selenium server."
#java -jar "./node_modules/selenium-server/lib/runner/selenium-server-standalone-3.141.59.jar" &
#seleniumpid=$!
#sleep 3

#check if selenium server is dead
#if ! kill -0 "$seleniumpid"; then
#    wait seleniumpid
#    se_status=$?
 #   exit $se_status
#fi


echo "Starting tests..."
#if we have test arguments process arguments else run full suit of tests as default
if [ "$#" -ge 1 ] 
then
    #if first argument is headless run tests headless else run the specified test because we have at least one argument
    if [ "$1" == "headless" ] 
    then
        #if we dont have a second argument run all tests headless else run the test specified in second argument headless
        if [ -z "$2" ] 
        then
            ./node_modules/nightwatch/bin/nightwatch -e run_headless
        else
            ./node_modules/nightwatch/bin/nightwatch -e run_headless $2
        fi
    else
        ./node_modules/nightwatch/bin/nightwatch $1
    fi
else
    ./node_modules/nightwatch/bin/nightwatch
fi


echo "Stopping server and mt script..."
kill "$serverpid"
kill "$mtpid"
#kill "$seleniumpid"



echo "Finished!"

