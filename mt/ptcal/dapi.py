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

import copy, subprocess, traceback, os
from pytcore.core.himesis import HConstants as HC
from utils import Utilities as utils

'''
	implements the DesignerAPI functions used in pattern/attribute constraints 
	and actions

	NOTE: the current username is required (and remembered) to enable file I/O
  			within his own directory... the current backend aswid is required (and
			remembered) to enable httpreqs to backend from rule code

	NOTE: cloned from mmmk.js constraint/action/accessor DesignerAPI... same
  			comments and thoughts apply... noteworthy differences are 
				. instead of atompm ids, API functions now take __pLabels as node
			  	  identifiers
				. 'sys_*()' functions enable system calls and file i/o
				. 'session_*()' functions provide a clean and efficient way to 
				  remember information across rules
				. the 'isConnectionType()' function '''
class DesignerAPI :	
	def __init__(self,username,aswid,mtwid) :
		self._username = username
		self._aswid		= aswid
		self._mtwid		= mtwid
		
	def _aswPrintReq(self,msg):
		utils.httpReq(	'PUT', 
						'127.0.0.1:8124', 
						'/GET/console?wid='+self._aswid, 
						{'text':msg})
	
	def _printToDevCon(self,msg):
		self._aswPrintReq(msg)


	'''
		configure this instance of DesignerAPI

		1. set the Himesis graph that will be used to satisfy getAttr/setAttr/...
			function calls... this graph represents a (partially) matched LHS, NAC
			or RHS 
		2. set the type of the calling function... legal values are 
				patternCondition
				patternAction
				attrCondition
				attrAction
		3. set the pattern-label -> graph-index mapping 
		4. set reference to exception holder
		5. set the __pLabel of the owner of the calling function, if any
		6. set the attribute that owns the calling function, if any 
		7. set reference to journal (to write changes to), if any 
		8. extend the pattern-label -> graph-index map w/ $atompmId -> graph-index
			mappings... this enables access to all graph nodes (not just matched 
			ones, that are incidently the only ones w/ associated __pLabels) 
		
		TBI: self._pl2gi should be given a name that reflects step 8. and errors
			  pertaining to missing/incorrect pLabel parameters should be updated 
			  to account for fact that specified pLabels may not be pLabels (i.e.,
			  they could be of the form '$atompmId:*' '''
	def configure(self,graph,type,pl2gi,ex,pLabel=None,attr=None,journal=None) :
		self._graph 	= graph
		self._type	 	= type
		self._pl2gi		= pl2gi
		self._ex			= ex
		self._pLabel 	= pLabel
		self._attr	   = attr
		self._journal 	= journal

		matched = self._pl2gi.values()
		for v in self._graph.vs :
			if v.index not in matched :
				self._pl2gi['$atompmId:'+str(v['$atompmId'])] = v.index
			
			
	'''
		wrapper around raise()... to be properly reported to the client, 
		exceptions can not simply be raised... this would just cause them to be
	  	captured by their ExecutionContext who might return a generic error (not
		the one it caught)... instead, we store exceptions, if any, in self._ex 
		for the caller to do with them what he wants... '''
	def __raise(self,msg) :
		self._ex['$err'] = msg
		raise RuntimeError(msg)



	# ***************************** API functions ***************************** #
	def _getAttr(self,attr=None,pLabel=None) :
		if pLabel == None :
			if self._type.startswith('pattern') :
				self.__raise(\
					'getAttr() requires a __pLabel in pattern conditions/actions')
			pLabel = self._pLabel
		elif not self._type.startswith('pattern') :
			self.__raise(\
				'getAttr() only accepts a __pLabel in pattern conditions/actions')
		elif pLabel not in self._pl2gi :
			self.__raise(\
				'invalid getAttr() __pLabel :: '+str(pLabel)+' (either no node '+\
				'with that __pLabel exists, or none is matched yet)')
		if attr == None :
			if not self._type.startswith('attr') :
				self.__raise(\
					'getAttr() can only be called without parameters'+\
					'in attribute conditions/actions')
			attr = self._attr

		n = self._graph.vs[self._pl2gi[pLabel]]
		if attr not in n.attribute_names() :
			self.__raise('invalid getAttr() attribute :: '+str(attr))
		return copy.deepcopy(n[attr])
	


	def _hasAttr(self,attr=None,pLabel=None) :
		if pLabel == None :
			if self._type.startswith('pattern') :
				self.__raise(\
					'hasAttr() requires a __pLabel in pattern conditions/actions')
			pLabel = self._pLabel
		elif not self._type.startswith('pattern') :
			self.__raise(\
				'hasAttr() only accepts a __pLabel in pattern conditions/actions')
		elif pLabel not in self._pl2gi :
			self.__raise(\
				'invalid hasAttr() __pLabel :: '+str(pLabel)+' (either no node '+\
				'with that __pLabel exists, or none is matched yet)')
		if attr == None :
			self.__raise(\
				'hasAttr() can not be called without an attribute parameter')

		n = self._graph.vs[self._pl2gi[pLabel]]
		return attr in n.attribute_names()



	def _setAttr(self,attr,val,pLabel) :
		if self._type != 'patternAction' :
			self.__raise('setAttr() can only be used within RHS actions')
		elif pLabel == None :
			self.__raise('setAttr() requires a valid __pLabel')
		elif pLabel not in self._pl2gi :
			self.__raise(\
				'invalid setAttr() __pLabel :: '+str(pLabel)+' (either no node '+\
				'with that __pLabel exists, or none is matched yet)')

		n = self._graph.vs[self._pl2gi[pLabel]]
		if attr not in n.attribute_names() :
			self.__raise('invalid setAttr() attribute :: '+attr)
		oldVal = n[attr]
		if oldVal != val :
			n[attr] = val
			self._journal.append(
								{'op':'CHATTR',
			  					 'guid':n[HC.GUID],
								 'attr':attr,
								 'old_val':oldVal,
								 'new_val':val})
			n[HC.MT_DIRTY] = True



	def _getAllNodes(self,fulltypes=None) :
		if not self._type.startswith('pattern') :
			self.__raise(\
				'getAllNodes() can only be used in pattern conditions/actions')
		elif fulltypes != None and fulltypes.__class__ != [].__class__ :
			self.__raise('invalid getAllNodes() fulltypes array :: '+fulltypes)

		pLabels = []
		for pLabel in self._pl2gi :
			n = self._graph.vs[self._pl2gi[pLabel]]
			if fulltypes == None or n[HC.FULLTYPE] in fulltypes :
				pLabels.append(pLabel)
		return pLabels



	def _getNeighbors(self,dir,type,pLabel) :
		if not self._type.startswith('pattern') :
			self.__raise(\
				'getNeighbors() can only be used in pattern conditions/actions')
		elif pLabel == None :
			self.__raise('getNeighbors() requires a valid __pLabel')
		elif pLabel not in self._pl2gi :
			self.__raise(\
				'invalid getNeighbors() __pLabel :: '+str(pLabel)+' (no node '+\
				'with that __pLabel exists)')

		pLabels = set()
		if len(self._graph.es) > 0 :
			gi2pl = dict((v, k) for (k, v) in self._pl2gi.items())
			idx   = self._pl2gi[pLabel]
			for e in self._graph.get_edgelist() :
				if e[0] == idx and \
					(dir == '>' or dir == '*') and \
					(type == '*' or self._graph.vs[e[1]][HC.FULLTYPE] == type) :
					pLabels.add(gi2pl[e[1]])
				elif e[1] == idx and \
					  (dir == '<' or dir == '*') and \
					  (type == '*' or self._graph.vs[e[0]][HC.FULLTYPE] == type) :
					pLabels.add(gi2pl[e[0]])
		return list(pLabels)



	def _isConnectionType(self,pLabel) :
		if not self._type.startswith('pattern') :
			self.__raise(\
				'isConnectionType() can only be used in pattern conditions/actions')
		elif pLabel == None :
			self.__raise('isConnectionType() requires a valid __pLabel')
		elif pLabel not in self._pl2gi :
			self.__raise(\
				'invalid isConnectionType() __pLabel :: '+str(pLabel)+' (no node '+\
				'with that __pLabel exists)')

		return self._graph.vs[self._pl2gi[pLabel]][HC.CONNECTOR_TYPE]




	def _session_get(self,key) :
		if key in self._graph.session :
			return self._graph.session[key]



	def _session_put(self,key,val) :
		if not self._type.endswith('Action') :
			self.__raise(\
				'session_put() can only be used in attribute and pattern actions')

		self._graph.session[key] = val
		return val


	def _pauseTransformation(self):
		self._httpReq("PUT", '127.0.0.1:8125', '/execmode?wid='+self._mtwid, {'mode':'pause'})
		
	def _stopTransformation(self):
		self._httpReq("PUT", '127.0.0.1:8125', '/execmode?wid='+self._mtwid, {'mode':'stop'})
		
	def _resumeTransformation(self):
		self._httpReq("PUT", '127.0.0.1:8125', '/execmode?wid='+self._mtwid, {'mode':'play'})

	def _httpReq(self,method,host,uri,data) :
		if host == None :
			return utils.httpReq(
						method,
						'127.0.0.1:8124',
						uri+'?wid='+self._aswid,
						data)
		else : 
			return utils.httpReq(method,host,uri,data)

		

	def _print(self,str) :
		print(str)



	def _sys_call(self,args) :
		try :
			return subprocess.call(args)
		except OSError as ex : 
			self.__raise('system call crashed on :: '+ex.strerror)



	def _sys_mkdir(self,path) :
		try :
			return os.makedirs('./users/'+self._username+'/'+path)
		except OSError as ex : 
			if ex.errno != 17 :
				#ignore directory already exists error
				self.__raise('directory creation failed :: '+ex.strerror)



	def _sys_readf(self,path) :
		f = open('./users/'+self._username+'/'+path,'r')
		contents = f.read()
		f.close()
		return contents



	def _sys_writef(self,path,content,append=True) :
		if append :
			f = open('./users/'+self._username+'/'+path,'a')
		else :
			f = open('./users/'+self._username+'/'+path,'w')
		f.write(content)
		f.close()

