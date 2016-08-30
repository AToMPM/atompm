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

import re, threading, json, logging
from ws import WebSocket
from ptcal.ptcal import PyTCoreAbstractionLayer
from ptcal.utils import Utilities as utils


'''
	message handler thread: mtworkers delegate the handling of each message they
									receive to a new instance of this thread, which 
									terminates after handling the said message 
	
	_msg				the message to handle
	_onmsg			the message handler function '''
class messageHandlerThread(threading.Thread) :
	def __init__(self,onmsg,msg) :
		threading.Thread.__init__(self)
		self._onmsg = onmsg
		self._msg   = msg

	def run(self) :
		self._onmsg(self._msg)



'''
	mtworker thread: handles every request to given mtworker 
	
	wid				this worker's id
	_msgQueue		this worker's message queue (stores incoming REST queries)
	_lock				a lock that ensures synchronous access to the message queue
						and that causes the worker to sleep while waiting for messages
	_ws				this worker's websocket (listens for its asworker's changelogs)
	_aswid			this worker's asworker's wid
	_wContext		a 'summary' of this mtworker used by _ptcal
	_ptcal			this worker's PyTCoreAbstractionLayer instance
	_stopped 		this flag becomes true when this worker should terminate '''
class mtworkerThread(threading.Thread) :
	nextID  = 0

	'''
		sets up instance vars + stores references to _msgQueue and _lock in 
		argument data structures '''
	def __init__(self,mtw2msgQueue,mtw2lock) :
		threading.Thread.__init__(self)
		self.wid 				  = str(mtworkerThread.nextID)
	  	mtworkerThread.nextID  += 1
		self._msgQueue 		  = [] 	
		mtw2msgQueue[self.wid] = self._msgQueue
		self._lock 				  = threading.Condition()
		mtw2lock[self.wid]	  = self._lock
		self._ws					  = None
		self._aswid				  = None
		self._ptcal				  = None
		self._stopped 		 	  = False



	'''
		init basic mtworker behavior

		0. loop on the steps below until someone stops this thread
		1. acquire self._lock
		2. if self._msgQueue is empty, release self._lock and block until awakened
	  		by notify()... will occur in 1 of 2 cases:
				a) when the main thread adds something to the self._msgQueue
				b) on self.stop()
			to distinguish between both cases, we check if self._msgQueue is empty
			... when it is, we break out of the loop (which terminates the current
			mtworkerThread)... when it isn't, we continue to step 3
		3. remove oldest element from self._msgQueue
		4. release the self._lock
		5. delegate the handling of the message from step 3 to a new 
			messageHandlerThread

		NOTE:: self._lock is used here for 2 purposes... 1st, to ensure 
				 synchronous access to self._msgQueue... 2nd, to ensure the worker
				 thread sleeps while self._msgQueue is empty '''
	def run(self):
		while not self._stopped :
  			self._lock.acquire()

			if len(self._msgQueue) == 0 :
				self._lock.wait()
				if len(self._msgQueue) == 0 :
					break

			msg = self._msgQueue.pop(0)
			self._lock.release()

			messageHandlerThread(self._onmessage,msg).start()



	'''
		send a request to this worker's asworker 
		
		TBI:: the use of 'localhost' implies that the atompm server is running on
	  			the same machine as the transformation engine... '''
	def _aswHttpReq(self,method,uri,data) :
		return utils.httpReq( 
								method, 
								'localhost:8124', 
								uri+'?wid='+self._aswid, 
								data)



	'''
		handle an incoming message from the server '''	
	def _onmessage(self,msg):
		if msg == 'DIE' :
			return self.stop()		

		logging.debug(self.wid+' >> #'+str(id(msg['resp']))+' '+\
							msg['method']+' '+msg['uri'])

		if msg['method'] == 'PUT' and re.match('/aswSubscription',msg['uri']) :
			if self._ws != None :
				self._postMessage(
						msg['resp'],
						{'statusCode':403,
  						 'reason':'already subscribed to an asworker'})
			else : 
				self._aswid = str(json.loads(msg['reqData'])['aswid'])
				self._ptcal = PyTCoreAbstractionLayer(
						{'httpReq':self._aswHttpReq, 'wid':self._aswid}, self.wid)
				try :
					self._ws = WebSocket(self._ptcal)
				except Exception, e :
					self._postMessage(
						msg['resp'],
						{'statusCode':500,
  						 'reason':str(e)})

				self._ws.subscribe(self._aswid)
				def respond(resp) :
					if self._ws.subscribed == False :
						self._ws.close()
						self._postMessage(
									resp,
									{'statusCode':500,
									 'reason':'subscription to asworker failed'})
					elif self._ws.subscribed == True :
						self._postMessage(resp,{'statusCode':200})
					else :
						t = threading.Timer(0.5,respond,[resp])
						t.start()
				respond(msg['resp'])	

		elif msg['method'] == 'PUT' and re.match('/envvars',msg['uri']) :
			if self._ptcal.username != None :
				self._postMessage(
						msg['resp'],
						{'statusCode':403,
						 'reason':'already provided environment variables'})
			else :
				reqData = json.loads(msg['reqData'])
				self._ptcal.username   = reqData['username']
				self._ptcal.defaultDCL = reqData['defaultDCL']
				self._postMessage(msg['resp'],{'statusCode':200})
				
		elif msg['method'] == 'PUT' and re.match('/current.model',msg['uri']) :
			m   = json.loads(msg['reqData'])['m']
			mms = json.loads(msg['reqData'])['mms']
			sn  = json.loads(msg['reqData'])['sequence#']
			self._ptcal.loadModel(m,mms,sn)
			self._postMessage(msg['resp'],{'statusCode':200})

		elif msg['method'] == 'PUT' and re.match('/current.transform',msg['uri']):
			try :
				if not self._ptcal.isStopped() : 
					self._postMessage(
							msg['resp'],
							{'statusCode':403,
							 'reason':'not allowed to (re)load during '+\
							 			 'ongoing transformation(s)'})
				else :
					transfs = json.loads(msg['reqData'])['transfs']
					transfs.reverse()
					self._ptcal.loadTransforms(transfs)
					self._postMessage(msg['resp'],{'statusCode':200})
			except Exception, e :
				self._postMessage(
						msg['resp'],
						{'statusCode':500,
  						 'reason':str(e)})
				
		elif msg['method'] == 'PUT' and re.match('/query.transform',msg['uri']):
			try :
				self._ptcal.processQuery(json.loads(msg['reqData']))
				self._postMessage(msg['resp'],{'statusCode':200})
			except Exception, e :
				self._postMessage(
						msg['resp'],
						{'statusCode':500,
  						 'reason':'There\'s something wrong with the query: '+str(e)})

		elif msg['method'] == 'PUT' and re.match('^/execmode',msg['uri']) :
			legalModes = ['play','stop','pause','step']
			mode = json.loads(msg['reqData'])['mode']
			if mode in legalModes :
				if self._ptcal.isStopping() : 
					self._postMessage(
							msg['resp'],
							{'statusCode':503,
							 'reason':'currently processing a STOP request'})
				else : 
					self._postMessage(msg['resp'],{'statusCode':200})
					getattr(self._ptcal,mode.lower())()
			else :	
				self._postMessage(
						msg['resp'],
						{'statusCode':400,
						 'reason':'invalid execution command :: '+mode})

		elif msg['method'] == 'POST' and re.match('^/toggledebug',msg['uri']) :
			self._ptcal.toggleDebugMode()
			self._postMessage(msg['resp'],{'statusCode':200})

		elif msg['method'] == 'POST' and re.match('^/debugClient',msg['uri']) :
			self._ptcal.registerDebugClient(msg['reqData'])
			self._postMessage(msg['resp'],{'statusCode':200})

		#modular analysis
		elif msg['method'] == 'POST' and re.match('^/analyzePN',msg['uri']) :
			#self._ptcal.toggleDebugMode()
			self._ptcal.analyzePN();
			self._postMessage(msg['resp'],{'statusCode':204})
		
		#flat reachability analysis
		elif msg['method'] == 'POST' and re.match('^/PNFull',msg['uri']) :
			f = json.loads(msg['reqData'])['fname']
			#self._ptcal.toggleDebugMode()
			self._ptcal.PNFull(fname=f);
			self._postMessage(msg['resp'],{'statusCode':204})
			
		elif msg['method'] == 'POST' and re.match('^/dotPN',msg['uri']) :
			#self._ptcal.toggleDebugMode()
			f = json.loads(msg['reqData'])['fname']
			self._ptcal.PNFull(fname=f,dot=True);
			self._postMessage(msg['resp'],{'statusCode':204})
		
		elif msg['method'] == 'POST' and re.match('^/bdapiresp',msg['uri']) :
			resp = json.loads(msg['reqData'])
			self._ptcal._queueBDAPI(resp)
			self._postMessage(msg['resp'],{'statusCode':204})
			
		else :
			self._postMessage(msg['resp'],{'statusCode':501})



	'''
		post response back to server '''			
	def _postMessage(self,resp,msg) :
		logging.debug(self.wid+' << #'+str(id(resp))+' '+str(msg))		
		resp.lock.acquire()
		resp.setResponse(msg)		
		resp.lock.notify()
		resp.lock.release()



	'''
		cause the loop in run() to be interrupted '''
	def stop(self):
		self._stopped = True
		self._lock.acquire()
		self._lock.notify()
		self._lock.release()

