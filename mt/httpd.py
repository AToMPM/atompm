'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import sys
import logging
if sys.version_info[0] < 3:
	import threading, urlparse
	from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
	from SocketServer import ThreadingMixIn
	from mtworker import mtworkerThread
else:
	import threading
	import urllib.parse as urlparse
	from http.server import BaseHTTPRequestHandler, HTTPServer
	from socketserver import ThreadingMixIn
	from mtworker import mtworkerThread



mtw2msgQueue = {}		#maps mtworkers to their message queues 
mtw2lock		 = {}		#maps workers to locks


'''
	http request handler thread: one instance per http request to http server '''
class HTTPRequestHandler(BaseHTTPRequestHandler) :

	def do_GET(self) :
		logging.debug('HTTPRequest get')
		self._onrequest()

	def do_POST(self) :
		logging.debug('HTTPRequest post')
		self._onrequest()

	def do_PUT(self) :
		logging.debug('HTTPRequest put')
		self._onrequest()

	def do_DELETE(self) :
		logging.debug('HTTPRequest delete')
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
			if sys.version_info < (3, 0):
				header = self.headers.getheader('Content-Length')
			else:
				header = self.headers.get('Content-Length')
			dl = int(header or 0)
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
		logging.debug('HTTPRequest response')

		self.send_response(statusCode)

		if headers == '' :
			self.send_header('Content-Type','text/plain')
		else :
			for h,i in headers.items() :
				self.send_header(h,i)
		self.end_headers()

		if round(statusCode/100.0) != 2 :
			if reason != '' :
				if sys.version_info < (3, 0):
					reason = bytes(reason)
				else:
					reason = bytes(reason, 'utf8')
				self.wfile.write(reason)
		else :
			if data != '' :
				if sys.version_info < (3, 0):
					data = bytes(data)
				else:
					data = bytes(data, 'utf8')
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
		logging.basicConfig(format='%(levelname)s - %(message)s', level=logging.DEBUG)
		logging.debug('HTTPServerThread init')
		threading.Thread.__init__(self)


	def run(self):
		logging.debug('HTTPServerThread start')
		self.httpd = MultiThreadedHTTPServer(('127.0.0.1', 8125), HTTPRequestHandler)
		self.httpd.serve_forever()
		self.httpd.socket.close()


	def stop(self) :
		logging.debug('HTTPServerThread stop')
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




