'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import time as t

global start_time
def set_start_time():
    global start_time
    start_time = t.time()

def time():
        return int((t.time() - start_time) * 1000)

