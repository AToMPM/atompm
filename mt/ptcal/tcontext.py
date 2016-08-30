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

import random
from tconstants import TConstants as TC
from utils import Utilities as utils


'''
	holds a transformation execution context

	t						the model transformation data
	rconfig				data from the transformation's RuntimeConfiguration entity,
							if any
	_expired				true when this context's transformation has terminated
	_lastStep  			the last executed transformation step 
								MTC : ([fname,] [id,] applicationInfo, feedbackInfo) 
								EC	 : (step#, applicationInfo, feedbackInfo)
	_notApplicable		true if all steps in this transformation were N/A '''
class TransformationContext(object) :
	def __init__(self,t) :
		self.t	  			  = t
		self._rconfig		  = None
		self._expired		  = False
		self._lastStep 	  = {}
		self._notApplicable = True


	''' 
		returns the application information associated with this entire 
		transformation context '''
	def _applicationInfo(self) :
		if self._lastStep['applicationInfo'] == TC.FAILED :
			return TC.FAILED
		elif self._notApplicable :
			return TC.NOT_APPLICABLE
		else :
			return TC.SUCCEEDED


	'''
		returns the data stored in this context's transformation's 
		RuntimeConfiguration entity, if any... also remembers it in '_rconfig' for
		future reference '''
	def getRuntimeConfiguration(self) :
		if self._rconfig == None :
			mm = '/Formalisms/__Transformations__/Transformation/Transformation/'		
			for id in self.t['nodes'] :
				if self.t['nodes'][id]['$type'] == mm+'RuntimeConfiguration' :
					self._rconfig = self.t['nodes'][id]['options']['value']
			self._rconfig = (self._rconfig or {})
		return self._rconfig
			

	'''
		return true if no step has run yet (1st condition), or if the last step's
	  	(which may be a proper last step or {} if the context's transformation
	 	has terminated) feedbackReceived flag is set '''
	def isLastStepFeedbackReceived(self) :
		return (not self._expired and self._lastStep == {}) or \
				 'feedbackReceived' in self._lastStep


	''' 
		returns true if the context's transformation has begun (i.e., the first
		step has been taken) '''
	def isTransformationUnderWay(self) :
		return not self._lastStep == {}


	'''
		return the next step to run '''
	def nextStep(self) :
		raise NotImplementedError('implement in subclass')


	'''
		set the application information of the last step (i.e., whether it was
		a) N/A, b) applicable and succeeded or c) applicable and failed '''
	def setLastStepApplicationInfo(self,applicationInfo) :
		raise NotImplementedError('implement in subclass')
		
	'''
		set the feedbackReceived flag of the last step to true (i.e., indicate 
		that all relevant asworker changelogs have been received and handled '''
	def setLastStepFeedbackReceived(self) :
		self._lastStep['feedbackReceived'] = True
	
	'''
		add 'a' amount of time to total execution time '''
	def setLastStepExecTime(self,a):
		raise NotImplementedError('implement in subclass')

	
			
'''
	holds the execution context of a 'Transformation' construct 
	
	fname					the filename of the transformation model '''
class ModelTransformationContext(TransformationContext) :
	def __init__(self,t,fname) :
		super(ModelTransformationContext,self).__init__(t)
		self.fname = fname
		''' hergin :: motifIntegration '''
		self.nextInput = "packetIn"
		self.metamodel = TC.TRANSFMM


	'''
  		returns the id of the current step in the transformation model '''
	def getCurrentStepId(self) :
		if self._lastStep == {} :
			assert False, \
				 "this function shouldn't be called when there is no current step"
		else :
			return self._lastStep['id']


	'''
		return the step within this transformation that has its 'isStart' 
		attribute set to true '''
	def _getInitialStep(self) :
		for id in self.t['nodes'] :
			if 'isStart' in self.t['nodes'][id] and \
				self.t['nodes'][id]['isStart']['value'] :
					if 'filename' in self.t['nodes'][id] :
						return {'fname':self.t['nodes'][id]['filename']['value'],
								  'id':id}
					else :
						return {'id':id}


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
			b) otherwise, return step on the other end of the said edge '''
	def nextStep(self) :
		if self._expired == True :
			raise RuntimeError('can not step in expired mtContext')
		elif self._lastStep == {} :
			ns = self._getInitialStep()
			if ns == None :
				return {'$err':'could not find initial transformation step'}
			self._lastStep['id'] = ns['id']
			return ns
		else :
			mm = '/Formalisms/__Transformations__/Transformation/Transformation/'
			def f(e) : 
				return e['src'] == self._lastStep['id'] and \
						 self.t['nodes'][e['dest']]['$type'] == \
							mm+'On'+self._lastStep['applicationInfo']

			ne = filter(f,self.t['edges'])
			if len(ne) == 0 :
				ai = self._applicationInfo()
				self._lastStep = {}
				self._expired = True
				return ai
			else :
				ne = ne[0]
				for e in self.t['edges'] :
					if e['src'] == ne['dest'] :
						if 'filename' in self.t['nodes'][e['dest']] :
							self._lastStep = \
								{'fname':self.t['nodes'][e['dest']]['filename']['value'],
								 'id':e['dest']}
						else :
							self._lastStep = {'id':e['dest']}
						return self._lastStep
				raise ValueError('invalid transformation model, dangling '+\
									  'On'+self._lastStep['applicationInfo']+' edge')
		

	'''
		set the application information of the last step '''
	def setLastStepApplicationInfo(self,applicationInfo) :
		if applicationInfo == TC.SUCCEEDED :
			self._notApplicable = False
		self._lastStep['applicationInfo'] = applicationInfo
		
	def setLastStepExecTime(self,a):
		''' to be implemented '''
		pass
				



'''
	holds the execution context of an 'Exhaust[Random]' construct
	  
	_id			the Exhaust[Random]'s id in the transformation model
	_randomGen		holds a random number generator if this is an ExhaustRandom
	_NAs			holds the ids of the non-applicable steps in this 
					Exhaust[Random] '''
class ExhaustContext(TransformationContext) :
	def __init__(self,t,id,randomGen=None) :
		super(ExhaustContext,self).__init__(t)
		self._id 		 = id
		self._randomGen 	 = randomGen
		self._NAs		 = set()


	'''
		return the next step to run in this Exhaust[Random]... this is either 
		the next step listed in the 'filenames' attribute OR a random not-N/A
	  	step listed in the 'filenames' attribute 

		0. if self._expired is true (i.e., a race condition occurred causing this
			context to be called after it terminated but before ptcal.stop() 
			removed it from ptcal._mtContexts), raise error
		1. if all steps are N/A, reset lastStep, set self._expired flag, and 
			return the application information of this entire transformation 
			context
		2. if this is an ExhaustRandom, randomly choose a not-N/A step and set
	  		it as self._lastStep
		2. if this is an Exhaust, increment self._lastStep
		3. return self._lastStep '''			
	def nextStep(self) :
		steps = self.t['nodes'][self._id]['filenames']['value']
		
		if self._expired == True :
			raise RuntimeError('can not step in expired mtContext')
		elif len(steps) == 0 :
			return TC.NOT_APPLICABLE
		elif len(set(steps)) == len(self._NAs) :
			ai = self._applicationInfo()
			self._lastStep = None
			self._expired = True
			return ai

		if self._randomGen != None :
			notNAs = set(range(0,len(steps))) - self._NAs
			r = self._randomGen.choice(list(notNAs))
			self._lastStep = {'step#':r}
		else :
			if self._lastStep == {} :
				self._lastStep = {'step#':0}
			else :
				self._lastStep = {'step#':(self._lastStep['step#']+1)%len(steps)}
		return {'fname':steps[self._lastStep['step#']]}


	'''
		set the application information of the last step

		NOTE: on success, we switch the self._notApplicable flag... this flag
			   indicates whether a rule was succesfully applied within this 
				transformation context... we also reset self._NAs to indicate
				that each step should be run at least once to re-establish its
				(non-)applicability '''			
	def setLastStepApplicationInfo(self,applicationInfo) :
		if applicationInfo == TC.SUCCEEDED :
			self._notApplicable = False
			self._NAs = set()
		elif applicationInfo == TC.NOT_APPLICABLE :
			self._NAs.add(self._lastStep['step#'])
		self._lastStep['applicationInfo'] = applicationInfo

