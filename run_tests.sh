#!/bin/bash
#run server

set -e

PY=${PYTHONVER:=python2}

node httpwsd.js &
serverpid=$!
sleep 3

#check if server is dead
if ! kill -0 "$serverpid"; then
    wait $serverpid
    server_status=$?
    exit $server_status
fi

$PY mt/main.py &
mtpid=$!
sleep 3

#check if model transformer is dead
if ! kill -0 "$mtpid"; then
    wait $mtpid
    mt_status=$?
    exit $mt_status
fi

