'''*****************************************************************************
AToMPM - A Tool for Multi-Paradigm Modelling

Copyright (c) 2011 Raphael Mannadiar (raphael.mannadiar@mail.mcgill.ca)

This file is part of AToMPM.

AToMPM is free software: you can redistribute it and/or modify it under the
terms of the GNU Lesser General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later 
version.

AToMPM is distributed in the hope that it will be useful, but WITHOUT ANY 
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.  See the GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License along
with AToMPM.  If not, see <http://www.gnu.org/licenses/>.
*****************************************************************************'''

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



