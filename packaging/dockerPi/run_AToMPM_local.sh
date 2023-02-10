#!/bin/bash

set -e

python3 mt/main.py >> "./logs/python.log" 2>&1 &
sleep 1

node httpwsd.js >> "./logs/node.log" 2>&1
