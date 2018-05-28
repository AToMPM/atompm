'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import sys
from tconstants import TConstants as TC
from dapi import DesignerAPI

try :
	import spidermonkey 
except ImportError as ex :
	pass


''' 
	this class abstracts away the fact that designer code may be specified in 
	more than one programming language '''
class DesignerCodeAbstractionLayer :
	def __init__(self,username,aswid,mtwid) :
		self._dAPI 			 = DesignerAPI(username,aswid,mtwid)
		self._execContexts = {}
		self._execContext  = None


	'''
		configure this instance of DesignerCodeAbstractionLayer and its instance
		of DesignerAPI

		1. lazy load an ExecutionContext given the specified programming language
		2. configure DesignerAPI instance '''
	def configure(
			self,lang,graph,type,pl2gi,ex,pLabel=None,attr=None,journal=None) :
		if lang not in self._execContexts :
			if lang == TC.PYTHON :
				self._execContexts[lang] = PythonExecutionContext(self._dAPI)
			elif lang == TC.JAVASCRIPT and 'spidermonkey' in sys.modules :
				self._execContexts[lang] = JavaScriptExecutionContext(self._dAPI)
			else :
				assert False, 'unsupported designer code language :: '+str(lang)	
		self._execContext = self._execContexts[lang]

		self._dAPI.configure(graph,type,pl2gi,ex,pLabel,attr,journal)


	''' 
		have the given code evaluated by the current ExecutionContext and return
		its output '''
	def eval(self,code) :
		return self._execContext.eval(code)


	'''
		identify the language in which the given snippet of designer code is 
		written in '''
	@staticmethod
	def identifyLanguage(code) :
		if code.startswith('"[JAVASCRIPT]"\n') :
			return TC.JAVASCRIPT
		elif code.startswith('"[PYTHON]"\n') :
			return TC.PYTHON
		return None



''' 
	this class provides means to evaluate javascript code that makes use of the
  	DesignerAPI '''
class JavaScriptExecutionContext :
	'''
  		setup a spidermonkey javascript execution context such that evaluated 
		javascript code will have access to DesignerAPI functions '''
	def __init__(self,dAPI) :
		self._context = spidermonkey.Runtime().new_context()
		self._context.bind_callable("getAttr",dAPI._getAttr)
		self._context.bind_callable("hasAttr",dAPI._hasAttr)		
		self._context.bind_callable("setAttr",dAPI._setAttr)
		self._context.bind_callable("getAllNodes",dAPI._getAllNodes)
		self._context.bind_callable("getNeighbors",dAPI._getNeighbors)
		self._context.bind_callable("isConnectionType",dAPI._isConnectionType)
		self._context.bind_callable("httpReq",dAPI._httpReq)
		self._context.bind_callable("print",dAPI._print)
		self._context.bind_callable("printToDevCon",dAPI._printToDevCon)
		self._context.bind_callable("session_get",dAPI._session_get)
		self._context.bind_callable("session_put",dAPI._session_put)
		self._context.bind_callable("sys_call",dAPI._sys_call)
		self._context.bind_callable("sys_mkdir",dAPI._sys_mkdir)
		self._context.bind_callable("sys_readf",dAPI._sys_readf)
		self._context.bind_callable("sys_writef",dAPI._sys_writef)
		self._context.bind_callable("pauseTransformation",dAPI._pauseTransformation)
		self._context.bind_callable("resumeTransformation",dAPI._resumeTransformation)
		self._context.bind_callable("stopTransformation",dAPI._stopTransformation)

	''' 
		evaluate a string of javascript code and return its output '''
	def eval(self,code) :
		return self._context.eval_script(code)




''' 
	this class provides means to evaluate python code that makes use of the
  	DesignerAPI '''
class PythonExecutionContext :
	'''
  		setup a python execution context such that evaluated python code will have
	  	access to DesignerAPI class '''
	def __init__(self,dAPI) :
		self._context = \
			{'getAttr' 				: dAPI._getAttr,
			 'hasAttr'				: dAPI._hasAttr,
			 'getAttrNames'		    : dAPI._getAttrNames,
		 	 'setAttr' 				: dAPI._setAttr,
			 'getAllNodes' 			: dAPI._getAllNodes,
			 'getNodesFromLabels'	: dAPI._getNodesFromLabels,
			 'getNeighbors' 		: dAPI._getNeighbors,
			 'isConnectionType' 	: dAPI._isConnectionType,
			 'httpReq'		 		: dAPI._httpReq,
			 'printToDevCon'		: dAPI._printToDevCon,
			 'session_get' 			: dAPI._session_get,
			 'session_put' 			: dAPI._session_put,
			 'sys_call' 			: dAPI._sys_call,
			 'sys_mkdir' 			: dAPI._sys_mkdir,
			 'sys_readf' 			: dAPI._sys_readf,
			 'sys_writef' 			: dAPI._sys_writef,
			 'pauseTransformation'	: dAPI._pauseTransformation,
			 'resumeTransformation'	: dAPI._resumeTransformation,
			 'stopTransformation'	: dAPI._stopTransformation}


	''' 
		evaluate a string of python code and return its output 
		
		NOTE:: before evaluating, we clear past results, if any '''
	def eval(self,code) :
		if 'result' in self._context :
			del self._context['result']

		exec(code) in self._context

		if 'result' not in self._context :
			return None
		return self._context['result']




