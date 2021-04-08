'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import threading, json, logging, sys

import socketio


'''
	a friendly wrapper around a socketio client
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

	def __init__(self, _aswid, chlogh=None) :
		print("WS INIT: " + str(_aswid))
		assert chlogh is None or 'onchangelog' in dir(chlogh)
		self._opened 	 = False
		self._chlogh 	 = chlogh
		self.subscribed = None
		self._aswid = _aswid

		self.socketIO = None

		thr = threading.Thread(target = self._start_ws)
		thr.start()

	def _start_ws(self):

		try:
			self.socketIO = socketio.Client(logger=True, engineio_logger=True)

			self.socketIO.on('connect', self._onopen)
			self.socketIO.on('message', self._onmessage)

			self.socketIO.connect('http://127.0.0.1:8124')

			data = {'method': 'POST', 'url': '/changeListener?wid='+self._aswid}
			self.socketIO.emit('message', data)

			self.socketIO.wait()
		except Exception as e:
			raise e

	''' 
		mark socket connection as opened '''

	def _onopen(self, ws) :
		self._opened = True

	'''
		close the socket '''
	def close(self, ws) :
		self.socketIO.close()

	''' 
		parse and handle incoming message '''
	def _onmessage(self,msg) :

		#handle binary
		try:
			msg = msg.decode()
		except Exception:
			pass

		print('## msg recvd '+msg)

		#get the first character
		msgType = msg[:1]

		#chop it off
		msg = msg[1:]

		data = json.loads(msg)

		if msgType == WebSocket.EVENT :

			if data[0] != 'message' :
				raise Exception('received unexpected socketio event :: '+str(msg))

			data = data[1]

			if 'statusCode' in data and data['statusCode'] is not None :
				#on POST /changeListener response

				if data['statusCode'] == 201 :
					self.subscribed = True
				else :
					self.subscribed = False
			elif self._chlogh and self.subscribed :
				self._chlogh.onchangelog(data['data'])

		elif msgType == WebSocket.ERROR:
			raise Exception('received error from socketio :: ' + str(data))
		else :
			pass


