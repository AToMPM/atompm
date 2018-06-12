'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import asyncore, logging, threading
from httpd import HTTPServerThread
from ws import WebSocket


'''
	init and launch http server and asyncore loop + set logging level for mt/*
	
	NOTE: omitting asyncore.loop()'s first parameter ('timeout' according to the
  			API) causes initialization to be very long... it seems it represents
			the delay during which an asyncore loop may remain idle before giving
			control to someone

	NOTE: python-websocket is built on an event-loop called asyncore... this loop
  		  	is started via asyncore.loop()... unfortunately, if there isn't already
			something in the loop when it's started, it just terminates... hence, 
			to enable the creation of WebSockets (which requires a running asyncore
			loop) in each future mtworker, we create a dummy WebSocket which serves
			only to keep the asyncore loop alive while there are no other open
			WebSockets '''
def main() :
	logging.basicConfig(format='%(levelname)s - %(message)s', level=logging.INFO)
	dummy_ws = WebSocket()
	httpd = HTTPServerThread()
	httpd.start()

	try :
		asyncore.loop(1)
	except KeyboardInterrupt :
		#		print(threading.enumerate())
		httpd.stop()
		dummy_ws.close()
		pass


if __name__ == "__main__" :
	main()



