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

import threading, urlparse
from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
from SocketServer import ThreadingMixIn
from mtworker import mtworkerThread



mtw2msgQueue = {}		#maps mtworkers to their message queues 
mtw2lock		 = {}		#maps workers to locks


'''
	http request handler thread: one instance per http request to http server '''
class HTTPRequestHandler(BaseHTTPRequestHandler) :

	def do_GET(self) :
		self._onrequest()

	def do_POST(self) :
		self._onrequest()

	def do_PUT(self) :
		self._onrequest()

	def do_DELETE(self) :
		self._onrequest()


	'''
		handle an incoming request	'''
	def _onrequest(self) :
		print(self.command+'   '+self.path)

		#spawn new worker + respond worker id		
		if( self.path == '/mtworker' and self.command == 'POST' ) :
			mtw = mtworkerThread(mtw2msgQueue,mtw2lock)
			mtw.start()
			return self._respond(201,'',mtw.wid)

		#check for valid worker id
		url   = urlparse.urlparse(self.path)
		query = urlparse.parse_qs(url[4])
		if query == '' or 'wid' not in query : 
			return self._respond(400, 'missing worker id')

		wid = query['wid'][0]
		if wid not in mtw2msgQueue : 
			return self._respond(400, 'invalid worker id :: '+wid)

		#retrieve reqdata if any
		reqData = None
		if (self.command == 'PUT' or self.command == 'POST') :
			dl = int(self.headers.getheader('Content-Length') or 0)
			if dl > 0 :
				reqData = self.rfile.read(dl)

		#setup lock and response objects + forward request to worker
		self.lock 		 = threading.Condition()	
 		self._response = {}		 
  		self._postMessage(
					wid,
  					{'method':self.command,
 					 'uri':self.path,
  					 'reqData':reqData,
  					 'resp':self})

		#wait on worker's response (necessary completing the execution of a do_*()
		#causes an empty response to be sent)
		self.lock.acquire()
		if self._response == {} :
			self.lock.wait()
		self.lock.release()
		self._respond(
				self._response['statusCode'],
				self._response['reason'],
				self._response['data'],
				self._response['headers'])



	'''
		send a message to an mtworker
			1. acquire lock on its msgQueue (this call may block very briefly if
				worker is currently using msgQueue)
			2. add msg to it
			3. release lock and notify worker that a new msg is available '''
	def _postMessage(self,wid,msg) : 
		mtw2lock[wid].acquire()
		mtw2msgQueue[wid].append(msg)
		mtw2lock[wid].notify()
		mtw2lock[wid].release()



	'''
		send a response 
		
		1. send statusCode
		2. send headers
		3. send data|reason '''
	def _respond(self,statusCode,reason='',data='',headers='') :
		self.send_response(statusCode)

		if headers == '' :
			self.send_header('Content-Type','text/plain')
		else :
			for h,i in headers.iteritems() :
				self.send_header(h,i)
		self.end_headers()

		if round(statusCode/100.0) != 2 :
			if reason != '' :
				self.wfile.write(reason)
		else : 
			if data != '' :
				self.wfile.write(data)
		


	'''
		used by worker threads to populate self._response with their results '''
	def setResponse(self,msg) :
		self._response['statusCode'] = msg['statusCode']

		for x in ('reason','data','headers') :
			if x in msg : 
				self._response[x] = msg[x]
			else : 
				self._response[x] = ''




'''
	init thread that runs http server '''
class HTTPServerThread(threading.Thread) :
	def __init__(self) :
		threading.Thread.__init__(self)


	def run(self):
		self.httpd = MultiThreadedHTTPServer(('', 8125), HTTPRequestHandler)
		self.httpd.serve_forever()
		self.httpd.socket.close()
	

	def stop(self) :
		self.httpd.shutdown()
		for wid in mtw2lock :
			mtw2lock[wid].acquire()
			mtw2msgQueue[wid].append('DIE')
			mtw2lock[wid].notify()
			mtw2lock[wid].release()




'''
	multi-threaded http server '''
class MultiThreadedHTTPServer(ThreadingMixIn, HTTPServer):
	pass




