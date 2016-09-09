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
