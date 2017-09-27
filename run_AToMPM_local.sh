#!/bin/bash
# Author: Yentl Van Tendeloo

set -e

node httpwsd.js &
sleep 3
python mt/main.py
