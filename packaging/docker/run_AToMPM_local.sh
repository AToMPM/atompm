#!/bin/bash

set -e

python3 mt/main.py &
sleep 1

node httpwsd.js
