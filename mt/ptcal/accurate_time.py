'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import time as t
import os

global start_time
def set_start_time():
    global start_time
    if os.name == 'posix':
        start_time = t.time()
    elif os.name == 'nt':
        start_time = t.clock()

if os.name == 'posix':
    def time():
        return int((t.time() - start_time) * 1000)
elif os.name == 'nt':
    def time():
        return int((t.clock() - start_time) * 1000)
