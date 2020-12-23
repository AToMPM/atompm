'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import re, threading, json, logging
from time import sleep

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

			self.socketIO = socketio.Client(logger=False, engineio_logger=False)

			self.socketIO.on('connect', self._onopen)
			self.socketIO.on('message', self._onmessage)

			self.socketIO.connect('http://127.0.0.1:8124')
			self.socketIO.sleep(1)

			data = {'method': 'POST', 'url': '/changeListener?wid='+self._aswid}
			self.socketIO.emit('message', data)

			self.socketIO.wait()
		except Exception as e:
			raise e

	''' 
		mark socket connection as opened '''

	def _onopen(self) :
		self._opened = True

	'''
		close the socket '''
	def close(self) :
		self.socketIO.close()

	''' 
		parse and handle incoming message '''
	def _onmessage(self, data) :

		logging.debug('## data recvd '+ str(data))

		if 'statusCode' in data and data['statusCode'] is not None :
			#on POST /changeListener response

			if data['statusCode'] == 201 :
				self.subscribed = True
			else :
				self.subscribed = False
		elif self._chlogh and self.subscribed :
			self._chlogh.onchangelog(data['data'])





