'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

'''
Transformation context for TCore
Author: Huseyin Ergin (hergin)
Purpose: Tcore integration to AtomPM
'''

import random
from .tconstants import TConstants as TC
from .utils import Utilities as utils
from .tcontext import TransformationContext
from .pytcore.tcore.messages import Pivots

from .pytcore.tcore.matcher import Matcher
from .pytcore.tcore.iterator import Iterator
from .pytcore.tcore.rewriter import Rewriter

'''
	holds the execution context of a 'Transformation' construct 
	fname					the filename of the transformation model '''

class TCoreContext(TransformationContext) :
	def __init__(self,fname,ptcal) :
		super(TCoreContext,self).__init__(ptcal._transfData[fname])
		self.fname = fname
		self.metamodel = TC.TCOREMM
		self.totalExecutionTime=0
		self.pivots = Pivots()
		self.sendAndApplyDeltaFunc=ptcal.sendAndApplyDelta
		self.nextInput = "packetIn"

		self.compiler = ptcal._compiler
		self.rules = {}

		self.startPacketInID = None
		self.startNextInID = None
		self.startCancelInID = None

		for id in self.t['nodes']:

			if self.t['nodes'][id]['$type'] == self.metamodel+"/Matcher":
				max = self.t['nodes'][id]['max']['value']
				ruleName = self.t['nodes'][id]['pattern']['value']
				compiledRule = self.compiler.compileRule(None,ruleName)
				matcher = Matcher(condition=compiledRule['lhs'],max=max)
				self.rules[id] = {'id':id,
								  'name':self.t['nodes'][id]['name']['value'],
								  'alias':self.t['nodes'][id]['alias']['value'],
								  'rule':matcher}

			elif self.t['nodes'][id]['$type'] == self.metamodel+"/Rewriter":
				ruleName = self.t['nodes'][id]['pattern']['value']
				compiledRule = self.compiler.compileRule(None,ruleName)
				rewriter = Rewriter(condition=compiledRule['rhs'],sendAndApplyDeltaFunc=self.sendAndApplyDeltaFunc)
				self.rules[id] = {'id':id,
								  'name':self.t['nodes'][id]['name']['value'],
								  'alias':self.t['nodes'][id]['alias']['value'],
								  'rule':rewriter}

			elif self.t['nodes'][id]['$type'] == self.metamodel+"/Iterator":
				maxIterations = self.t['nodes'][id]['maxIterations']['value']
				ruleName = self.t['nodes'][id]['pattern']['value']
				compiledRule = self.compiler.compileRule(None,ruleName)
				iterator = Iterator(condition=compiledRule['lhs'])
				self.rules[id] = {'id':id,
								  'name':self.t['nodes'][id]['name']['value'],
								  'alias':self.t['nodes'][id]['alias']['value'],
								  'rule':iterator}

			elif self.t['nodes'][id]['$type'] == self.metamodel+"/StartPacketIn":
				self.startPacketInID = id
			elif self.t['nodes'][id]['$type'] == self.metamodel+"/StartNextIn":
				self.startNextInID = id
			elif self.t['nodes'][id]['$type'] == self.metamodel+"/StartCancelIn":
				self.startCancelInID = id

		''' TODO add other rules '''

	def setLastStepExecTime(self,a):
		self._lastStep['time'] = a
		self.totalExecutionTime += a

	'''
  		returns the id of the current step in the transformation model '''
	def getCurrentStepId(self) :
		if self._lastStep == {} :
			assert False, \
				"this function shouldn't be called when there is no current step"
		else :
			return self._lastStep['id']

	'''
		Returns the initial step of transformation which is the step after start state
	'''
	def _getInitialStep(self) :

		if self.startPacketInID == None and self.startNextInID == None and self.startCancelInID == None:
			raise RuntimeError('There is no start state in loaded TCore instance!')

		''' a regular Tcore trafo starts with an startPacketIn node '''
		if self.startPacketInID != None:
			startStateEdges = [e for e in self.t['edges'] if e['src']==self.startPacketInID]

			if len(startStateEdges) == 0 :
				raise RuntimeError('StartPacketIn is not connected to any other rule!')
			else:
				initialStepID=[e for e in self.t['edges'] if e['src']==startStateEdges[0]['dest']][0]['dest']

				return self.rules[initialStepID]

	'''
		return the next step to run in this transformation... this is either 
		the initial step OR a neighbour of the last step... which one of these
		neighbours is the next step is determined by the application information
		of the said last step 
		
		0. if self._expired is true (i.e., a race condition occurred causing this
			context to be called after it terminated but before ptcal.stop() 
			removed it from ptcal._mtContexts), raise error
		1. if there is no last step, return initial step
		2. filter through edges to find appropriate edge out of last step
			a) if none is found, reset lastStep, set self._expired flag, and 
			return the application information of this entire transformation 
			context
			b) otherwise, return step on the other end of the said edge 
			
		Next step structure
			lastStepID --> successID --> nextID
			       --> failID --> nextID
			       
			
		Steps to find next
			1- Filter edges and get (lastStepID, successID) and (lastStepID,failID) edges
			2- Select success or fail according to _lastStep['applicationInfo']
			3- Find this edge (nextPath, nextStepID) where nextPath is one of the success or fail ids.
			
			
			'''
	def nextStep(self) :
		if self._expired == True :
			raise RuntimeError('can not step in expired mtContext')
		elif self._lastStep == {} :
			ns = self._getInitialStep()
			if ns == None :
				return {'$err':'could not find initial transformation step'}
			self._lastStep = ns
			return ns
		else :

			def f(e) :
				return e['src'] == self._lastStep['id']

			edgesFromLastStep = list(filter(f,self.t['edges']))

			if len(edgesFromLastStep) == 0 :
				ai = self._applicationInfo()
				self._lastStep = {}
				self._expired = True
				return ai
			else :

				targetLinkID=None
				resString = None
				if self._lastStep['applicationInfo'] == TC.SUCCEEDED :
					resString = "success"
				elif self._lastStep['applicationInfo'] == TC.FAILED:
					resString = "fail"
				else: #exception
					resString = "exception"

				for edgeLS in edgesFromLastStep:
					if 'output' in self.t['nodes'][edgeLS['dest']] and self.t['nodes'][edgeLS['dest']]['output']['value'] == resString:
						targetLinkID=edgeLS['dest']
						break
					elif 'output' not in self.t['nodes'][edgeLS['dest']]:
						if self.t['nodes'][edgeLS['dest']]['$type']==self.metamodel+"/endExceptionPort" and resString=='exception':
							targetLinkID=edgeLS['dest']
							break
						elif self.t['nodes'][edgeLS['dest']]['$type']==self.metamodel+"/endSuccessPort" and resString=='success':
							targetLinkID=edgeLS['dest']
							break
						elif self.t['nodes'][edgeLS['dest']]['$type']==self.metamodel+"/endFailPort" and resString=='fail':
							targetLinkID=edgeLS['dest']
							break

				if 'input' in self.t['nodes'][targetLinkID]:
					self.nextInput = self.t['nodes'][targetLinkID]['input']['value']

				def f(e) :
					return e['src'] == targetLinkID
				nodesAfterLastStep = list(filter(f,self.t['edges']))

				nextStepID = nodesAfterLastStep[0]['dest']

				if nextStepID in self.rules:
					self._lastStep = self.rules[nextStepID]
				else:
					if self.t['nodes'][nextStepID]['$type']==self.metamodel+"/EndSuccess":
						self._lastStep = {'trafoResult':TC.SUCCEEDED,
										  'feedbackReceived':'True'}
					elif self.t['nodes'][nextStepID]['$type']==self.metamodel+"/EndFail":
						self._lastStep = {'trafoResult':TC.FAILED,
										  'feedbackReceived':'True'}
					elif self.t['nodes'][nextStepID]['$type']==self.metamodel+"/EndException":
						self._lastStep = {'trafoResult':TC.EXCEPTION,
										  'feedbackReceived':'True'}

				return self._lastStep



	'''
		set the application information of the last step '''
	def setLastStepApplicationInfo(self,applicationInfo) :
		if applicationInfo == TC.SUCCEEDED :
			self._notApplicable = False
		self._lastStep['applicationInfo'] = applicationInfo


	def isLastStepFeedbackReceived(self) :
		return (not self._expired and self._lastStep=={}) or \
			   'feedbackReceived' in self._lastStep
