import time as t
import os

if os.name == 'posix':
	def time():
		return t.time()
elif os.name == 'nt':
	def time():
		return t.clock()
