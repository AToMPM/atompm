'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import re, threading, json, logging

import sys


if sys.version_info[0] < 3:
	import httplib as httplib
	import websocket._app as websocket
else:
	import http.client as httplib
	import websocket._app as websocket

'''
	a friendly wrapper around python-websockets that doubles as a socketio client
	
	_opened		true when the socket is first opened
	_chlogh		a reference to an object that implements onchangelog(), this
  					method is called upon reception of changelogs from the asworker
				  	we're subscribed to 
	subscribed  describes the current state of our subscription to our asworker
						None:  don't know yet
						True:  subscribed
						False: subscription failed
	_ws			the python-websocket '''
class WebSocket :
	#socket.io messages types
	DISCONNECT	 = '0'
	CONNECT		 = '1'
	HEARTBEAT	 = '2'
	MESSAGE		 = '3'
	JSON_MESSAGE = '4'
	EVENT			 = '5'
	ACK			 = '6'
	ERROR			 = '7'
	NOOP			 = '8'


	def __init__(self,chlogh=None) :
		assert chlogh == None or 'onchangelog' in dir(chlogh)
		self._opened 	 = False
		self._chlogh 	 = chlogh
		self.subscribed = None
		self.connect()

	def _start_ws(self, hskey):
		self._ws = websocket.WebSocketApp(
			'ws://127.0.0.1:8124/socket.io/1/websocket/' + hskey,
			on_message = self._onmessage,
			on_open = self._onopen)
		self._ws.run_forever()

	'''
		connect to the socketio server
	  
		1. perform the HTTP handshake
		2. open a websocket connection 
		REF:: https://github.com/LearnBoost/socket.io-spec '''
	def connect(self) :
		conn  = httplib.HTTPConnection('127.0.0.1:8124')
		conn.request('POST','/socket.io/1/')
		resp  = conn.getresponse()

		if resp.status == 200 :
			resp = resp.read()

			try: #handle bytes
				resp = resp.decode()
			except AttributeError:
				pass

			hskey = resp.split(':')[0]

			# start the websocket on a different thread as it loops forever
			thr = threading.Thread(target = self._start_ws, args = (hskey, ))
			thr.start()

		else :
			raise Exception('websocket initialization failed :: '+str(resp.reason))



	'''
		close the socket '''
	def close(self, ws) :
		self._ws.close()



	''' 
		parse and handle incoming message '''
	def _onmessage(self,ws, msg) :

		logging.debug('## msg recvd '+msg)

		msgType = msg[0]
		if msgType == WebSocket.CONNECT :
			return

		elif msgType == WebSocket.ERROR :
			raise Exception('received error from socketio :: '+str(msg))

		elif msgType == WebSocket.HEARTBEAT :
			self._ws.send('2::')

		elif msgType == WebSocket.EVENT :
			msg = json.loads(msg[len(WebSocket.EVENT+':::'):])
			if msg['name'] != 'message' :
				raise Exception('received unexpected socketio event :: '+str(msg))
			msg = msg['args'][0]

			if 'statusCode' in msg and msg['statusCode'] != None :
				#on POST /changeListener response
				if msg['statusCode'] == 201 :
					self.subscribed = True
				else :
					self.subscribed = False
			elif self._chlogh and self.subscribed :
				self._chlogh.onchangelog(msg['data'])
		else :
			pass



	''' 
		mark socket connection as opened '''
	def _onopen(self, ws) :
		self._opened = True



	'''
		subscribe to specified asworker '''
	def subscribe(self,aswid) :
		if not self._opened :
			t = threading.Timer(0.25,self.subscribe,[aswid])
			t.start()
		else :
			self._ws.send(
				'4:::{"method":"POST","url":"/changeListener?wid='+aswid+'"}')
