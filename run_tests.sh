#!/bin/bash

#exit on errors
set -e
set -o pipefail

# Parse arguments
HEADLESS=false
TEST_FILE=""

for arg in "$@"; do
    case "$arg" in
        --headless) HEADLESS=true ;;
        *) TEST_FILE="$arg" ;;
    esac
done

# Derive log prefix from test filename
if [ -n "$TEST_FILE" ]; then
    logname="$(basename "$TEST_FILE" .js)_"
else
    logname=""
fi

# Enable verbose if the last run failed or if VERBOSE env var is set
VERBOSE_FLAG=""
# FAIL_MARKER="tests/.last_test_failed"
# if [ -f "$FAIL_MARKER" ] || [ "$VERBOSE" = "true" ]; then
#     VERBOSE_FLAG="--verbose"
#     if [ -f "$FAIL_MARKER" ]; then
#         echo "Previous run failed — enabling verbose output."
#     fi
# fi

mkdir -p -- "logs"
mkdir -p -- "screenshots"
# Process cleanup
echo "Cleaning up any past AToMPM processes..."
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

#ps

#check if model transformer is dead
if ! kill -0 "${mtpid}"; then
    wait ${mtpid}
    mt_status=$?
    echo "model transformation server failed to start" >> "./logs/${logname}python.log"
    exit $mt_status
fi

# Build nightwatch command
echo "Starting tests..."
NW_CMD="./node_modules/nightwatch/bin/nightwatch"

if [ "$HEADLESS" = true ]; then
    NW_CMD="$NW_CMD -e run_headless"
fi

if [ -n "$VERBOSE_FLAG" ]; then
    NW_CMD="$NW_CMD $VERBOSE_FLAG"
fi

if [ -n "$TEST_FILE" ]; then
    NW_CMD="$NW_CMD $TEST_FILE"
fi

# Run tests and track result
rm -f "$FAIL_MARKER"
if $NW_CMD 2>&1 | tee "./logs/${logname}nightwatch.log"; then
    echo "Stopping server and mt script..."
    kill "$serverpid"
    kill "$mtpid"
    echo "Finished!"
else
    TEST_EXIT=$?
    touch "$FAIL_MARKER"
    echo "Stopping server and mt script..."
    kill "$serverpid" 2>/dev/null || true
    kill "$mtpid" 2>/dev/null || true
    exit $TEST_EXIT
fi
