'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import re, ___websocket as websocket, threading, json, httplib, logging


'''
	a friendly wrapper around python-websockets that doubles as a socketio client
	
	_opened		true when the socket is first opened
	_chlogh		a reference to an object that implements onchangelog(), this
  					method is called upon reception of changelogs from the asworker
				  	we're subscribed to 
	_dummy		true if this is a 'dummy' websocket... see note in main.py
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
		self._dummy	 	 = (chlogh == None)
		self.subscribed = None
		self.connect()



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
			hskey = resp.read().split(':')[0]
			self._ws = websocket.WebSocket(
						'ws://127.0.0.1:8124/socket.io/1/websocket/'+hskey,
						onopen	 = self._onopen,
						onmessage = self._onmessage)
		else :
			raise Exception('websocket initialization failed :: '+str(resp.reason))



	'''
		close the socket '''
	def close(self) :
		self._ws.close()



	''' 
		parse and handle incoming message '''
	def _onmessage(self,msg) : 
		if not self._dummy :
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
	def _onopen(self) :
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
