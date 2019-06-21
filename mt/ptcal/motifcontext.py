'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

'''
Transformation context for MoTif
Author: Huseyin Ergin (hergin)
Purpose: MoTif integration to AtomPM
'''

import random
import collections
import datetime
from time import *
import timeit
from .tconstants import TConstants as TC
from .utils import Utilities as utils
from .tcontext import TransformationContext
from .pytcore.tcore.messages import Pivots
from .pytcore.rules.arule import ARule
from .pytcore.rules.query import Query
from .pytcore.rules.query import CQuery2
from .pytcore.rules.query import CQuery3
from .pytcore.rules.srule import SRule
from .pytcore.rules.crule import CRule
from .pytcore.rules.frule import FRule
from .pytcore.rules.brule import BRule
from .pytcore.rules.bsrule import BSRule
from .pytcore.rules.lrule import LRule
from .pytcore.rules.lfrule import LFRule
from .pytcore.rules.lsrule import LSRule
from .pytcore.rules.lqsrule import LQSRule
from .pytcore.rules.sequence import Sequence

'''
	holds the execution context of a 'Transformation' construct 
	t						
	fname					the filename of the transformation model '''
class MotifContext(TransformationContext) :
	def __init__(self,fname,ptcal):
		super(MotifContext,self).__init__(ptcal._transfData[fname])
		self.fname = fname
		self.metamodel = TC.MOTIFMM
		self.pivots=Pivots()
		self.totalExecutionTime=0
		self.sendAndApplyDeltaFunc = ptcal.sendAndApplyDelta
		self.nextInput = "packetIn"

		self.compiler = ptcal._compiler
		self.ptcal = ptcal
		self.rules = {}

		self.startStateID = None

		for id in self.t['nodes']:

			rule = self.ruleIdentifier(self.t['nodes'], id)

			if rule == None:

				if self.t['nodes'][id]['$type'] == self.metamodel+"/LRule" or \
						self.t['nodes'][id]['$type'] == self.metamodel+"/LSRule" or \
						self.t['nodes'][id]['$type'] == self.metamodel+"/LFRule" or \
						self.t['nodes'][id]['$type'] == self.metamodel+"/LQSRule":

					maxIterations = int(self.t['nodes'][id]['maxIterations']['value'])
					nested = int(self.t['nodes'][id]['nested']['value'])
					outerFirst = True if nested==0 else False

					def f(e) :
						return e['src'] == id
					lruleEdges = list(filter(f,self.t['edges']))

					baseEdgeId=None
					loopEdgeId=None

					for edge in lruleEdges:
						if self.t['nodes'][edge['dest']]['$type']==self.metamodel+"/base":
							baseEdgeId=edge['dest']
						elif self.t['nodes'][edge['dest']]['$type']==self.metamodel+"/loop":
							loopEdgeId=edge['dest']

					def f(e) :
						return e['src'] == baseEdgeId
					baseRuleIds = list(filter(f,self.t['edges']))
					baseRuleID=baseRuleIds[0]['dest']

					compiledBaseRule = None

					if self.t['nodes'][id]['$type'] == self.metamodel+"/LRule" or \
							self.t['nodes'][id]['$type'] == self.metamodel+"/LQSRule":
						baseRuleName = self.t['nodes'][baseRuleID]['query']['value']
						compiledBaseRule = self.compiler.compileRule(None,baseRuleName)
					else:
						baseRuleName = self.t['nodes'][baseRuleID]['rule']['value']
						compiledBaseRule = self.compiler.compileRule(None,baseRuleName)
					#baseRule = ARule(compiledBaseRule['lhs'],compiledBaseRule['rhs'],self.sendAndApplyDeltaFunc)

					def f(e) :
						return e['src'] == loopEdgeId
					loopRuleIds = list(filter(f,self.t['edges']))
					loopRuleID=loopRuleIds[0]['dest']

					loopRuleType = self.t['nodes'][loopRuleID]['$type']

					if loopRuleType != self.metamodel+"/CRule":
						loopRuleName = self.t['nodes'][loopRuleID]['rule']['value']
						compiledLoopRule = self.compiler.compileRule(None,loopRuleName)

					loopRule = None

					if loopRuleType == self.metamodel+"/ARule":
						loopRule = ARule(compiledLoopRule['lhs'],compiledLoopRule['rhs'],self.sendAndApplyDeltaFunc)
					elif loopRuleType == self.metamodel+"/FRule":
						loopRule = FRule(compiledLoopRule['lhs'],compiledLoopRule['rhs'],maxIterations,self.sendAndApplyDeltaFunc)
					elif loopRuleType == self.metamodel+"/SRule":
						loopRule = SRule(compiledLoopRule['lhs'],compiledLoopRule['rhs'],maxIterations,self.sendAndApplyDeltaFunc)
					elif loopRuleType == self.metamodel+"/CRule":
						ruleName = self.t['nodes'][loopRuleID]['ref']['value']
						self.ptcal._transfData[ruleName] = utils.fread('/users/%s/%s'%(self.ptcal.username,ruleName))
						motifContext = MotifContext(ruleName,self.ptcal)
						loopRule = CRule(motifContext)

					if self.t['nodes'][id]['$type'] == self.metamodel+"/LRule":
						rule = LRule(compiledBaseRule['lhs'],loopRule,max_iterations=maxIterations)

					elif self.t['nodes'][id]['$type'] == self.metamodel+"/LQSRule":
						rule = LQSRule(compiledBaseRule['lhs'],loopRule,max_iterations=maxIterations)

					elif self.t['nodes'][id]['$type'] == self.metamodel+"/LSRule":
						rule = LSRule(compiledBaseRule['lhs'],compiledBaseRule['rhs'],loopRule,outer_first=outerFirst,sendAndApplyDeltaFunc=self.sendAndApplyDeltaFunc,max_iterations=maxIterations)

					elif self.t['nodes'][id]['$type'] == self.metamodel+"/LFRule":
						rule = LFRule(compiledBaseRule['lhs'],compiledBaseRule['rhs'],loopRule,outer_first=outerFirst,sendAndApplyDeltaFunc=self.sendAndApplyDeltaFunc,max_iterations=maxIterations)

				elif self.t['nodes'][id]['$type'] == self.metamodel+"/BRule" or \
						self.t['nodes'][id]['$type'] == self.metamodel+"/BSRule":

					def f(e) :
						return e['src'] == id
					bruleEdges = list(filter(f,self.t['edges']))

					branchRuleList=[]

					for edge in bruleEdges:
						if self.t['nodes'][edge['dest']]['$type']==self.metamodel+"/branch":
							branchID=edge['dest']
							def f(e) :
								return e['src'] == branchID
							branchRuleID=list(filter(f,self.t['edges']))[0]['dest']

							rule = self.ruleIdentifier(self.t['nodes'],branchRuleID)

							if rule == None and self.t['nodes'][branchRuleID]['$type']==self.metamodel+"/CRule":
								ruleName = self.t['nodes'][branchRuleID]['ref']['value']
								self.ptcal._transfData[ruleName] = utils.fread('/users/%s/%s'%(self.ptcal.username,ruleName))
								motifContext = MotifContext(ruleName,self.ptcal)
								rule = CRule(motifContext)

							branchRuleList.append(rule)

					if self.t['nodes'][id]['$type'] == self.metamodel+"/BRule":
						rule = BRule(branchRuleList)
					elif self.t['nodes'][id]['$type'] == self.metamodel+"/BSRule":
						maxIterations = int(self.t['nodes'][id]['maxIterations']['value'])
						rule = BSRule(branchRuleList,maxIterations)

				elif self.t['nodes'][id]['$type'] == self.metamodel+"/CRule":
					rule = self.t['nodes'][id]['ref']['value']

				elif self.t['nodes'][id]['$type'] == self.metamodel+"/Sequence":
					sequenceRuleList=[]
					rulesFile = self.t['nodes'][id]['ref']['value']
					self.ptcal._transfData[rulesFile] = utils.fread('/users/%s/%s'%(self.ptcal.username,rulesFile))
					rulesOrdered = collections.OrderedDict(sorted(self.ptcal._transfData[rulesFile]['nodes'].items()))
					for ruleId in rulesOrdered:
						rule = self.ruleIdentifier(rulesOrdered,ruleId)
						if rule != None:
							sequenceRuleList.append(rule)
						else: # TODO decide for CRule
							pass
					rule = Sequence(sequenceRuleList)

				elif self.t['nodes'][id]['$type'] == self.metamodel+"/Start":
					self.startStateID = id
					rule = None

			if rule != None:
				self.rules[id] = {'id':id,
								  'name':self.t['nodes'][id]['name']['value'],
								  'alias':self.t['nodes'][id]['alias']['value'],
								  'rule':rule}

	def ruleIdentifier(self,ruleList,ruleId):

		rule = None

		if ruleList[ruleId]['$type']==self.metamodel+"/ARule":
			ruleName = ruleList[ruleId]['rule']['value']
			compiledRule = self.compiler.compileRule(None,ruleName)
			rule = ARule(compiledRule['lhs'],compiledRule['rhs'],self.sendAndApplyDeltaFunc)

		elif ruleList[ruleId]['$type']==self.metamodel+"/QRule":
			ruleName = ruleList[ruleId]['query']['value']
			compiledRule = self.compiler.compileRule(None,ruleName)
			rule = Query(compiledRule['lhs'])

		elif ruleList[ruleId]['$type']==self.metamodel+"/FRule":
			maxIterations = ruleList[ruleId]['maxIterations']['value']
			ruleName = ruleList[ruleId]['rule']['value']
			compiledRule = self.compiler.compileRule(None,ruleName)
			rule = FRule(compiledRule['lhs'],compiledRule['rhs'],int(maxIterations),self.sendAndApplyDeltaFunc)

		elif ruleList[ruleId]['$type']==self.metamodel+"/SRule":
			maxIterations = ruleList[ruleId]['maxIterations']['value']
			ruleName = ruleList[ruleId]['rule']['value']
			compiledRule = self.compiler.compileRule(None,ruleName)
			rule = SRule(compiledRule['lhs'],compiledRule['rhs'],int(maxIterations),self.sendAndApplyDeltaFunc)

		elif ruleList[ruleId]['$type'] == self.metamodel+"/CQRule2":
			ruleName = ruleList[ruleId]['query']['value']
			innerRuleName = ruleList[ruleId]['innerQuery']['value']
			compiledRule = self.compiler.compileRule(None,ruleName)
			compiledInnerRule = self.compiler.compileRule(None,innerRuleName)
			innerQuery = Query(compiledInnerRule['lhs'])
			rule = CQuery2(compiledRule['lhs'],innerQuery)

		elif ruleList[ruleId]['$type'] == self.metamodel+"/CQRule3":
			ruleName = ruleList[ruleId]['query']['value']
			innerRuleName = ruleList[ruleId]['innerQuery']['value']
			secondInnerRuleName = ruleList[ruleId]['secondInnerQuery']['value']
			compiledRule = self.compiler.compileRule(None,ruleName)
			compiledInnerRule = self.compiler.compileRule(None,innerRuleName)
			compiledSecondInnerRule = self.compiler.compileRule(None,secondInnerRuleName)
			innerQuery = Query(compiledInnerRule['lhs'])
			secondInnerQuery = Query(compiledSecondInnerRule['lhs'])
			rule = CQuery3(compiledRule['lhs'],innerQuery,secondInnerQuery)

		return rule


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
	
		Steps to find initial step:
			1- Find start state id in self.t['nodes']
			2- Find the edge where start is the 'src'
			3- The edge has the initial step as 'dest' after the link between
			
		Structure:
			(startID) ----- (linkID) -----> (initialID)
			
			(startID, linkID) is an edge
			(linkID, initialID) is another edge
		
	'''
	def _getInitialStep(self) :

		if self.startStateID==None:
			raise RuntimeError('There is no start state in loaded MoTif instance!')

		def f(e) :
			return e['src'] == self.startStateID
		startStateEdges = list(filter(f,self.t['edges']))

		initialStepID=None
		if len(startStateEdges) == 0 :
			raise RuntimeError('Start state is not connected to any other state!')
		else:
			firstLinkID=startStateEdges[0]['dest']
			def f(e) :
				return e['src'] == firstLinkID
			startStateEdges = list(filter(f,self.t['edges']))
			initialStepID=startStateEdges[0]['dest']

		if initialStepID in self.rules:
			return self.rules[initialStepID]
		else:
			if self.t['nodes'][initialStepID]['$type']==self.metamodel+"/EndSuccess":
				return {'trafoResult':TC.SUCCEEDED,
						'feedbackReceived':'True'}
			elif self.t['nodes'][initialStepID]['$type']==self.metamodel+"/EndFail":
				return {'trafoResult':TC.FAILED,
						'feedbackReceived':'True'}



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
		timeNextStep = clock()
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
					resString = self.metamodel+"/success"
				else :
					resString = self.metamodel+"/fail"

				for edgeLS in edgesFromLastStep:
					if self.t['nodes'][edgeLS['dest']]['$type'] == resString:
						targetLinkID=edgeLS['dest']
						break

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

				#print clock()-timeNextStep

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
