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

import pprint, json, re, math, threading, httplib


class Utilities :

	'''
		do 'callback()' when 'condition' is satisfied, polling every 'delay' 
		seconds until it is '''
	@staticmethod
 	def doWhen(condition, delay, callback) :
		if	condition() : 
			callback()
		else : 
			t = threading.Timer(delay,Utilities.doWhen,[condition,delay,callback])
			t.start()

	'''
		flatten an array of arrays into a single array '''
	@staticmethod
 	def flatten(arrays) :
		return [item for array in arrays for item in array]


	'''
		read data from disk and return contents... if isJSON is true, return 
		parsed contents (or parsed asm, if path describes a *.model file) '''
	@staticmethod
	def fread(path,isJson=True,relative=True) :
		try : 
			if relative :
				path = './'+path
				
			f = open(path,'r')
			contents = f.read()
			f.close()

			if isJson :
				contents = json.loads(contents)
				if path.endswith('.model') :
					contents = contents['asm']

			return contents
		except Exception, e :
			raise IOError('crashed while reading data :: '+str(e))


	'''
		split a full type of the form '/path/to/metamodel/type' and return
		'/path/to/metamodel' '''
	@staticmethod
	def getMetamodel(fulltype) :
		return re.match("(.*)/.*",fulltype).group(1)
	

	'''
		split a full type of the form '/path/to/metamodel/type' and return 
		'type' '''
	@staticmethod
	def getType(fulltype) :
		return re.match(".*/(.*)",fulltype).group(1)


	'''
		send a synchronous http request '''
	@staticmethod
	def httpReq(method,host,uri,data) :
		headers = {'Content-Type': 'text/plain'}
		conn = httplib.HTTPConnection(host)
		conn.request(method, uri, json.dumps(data), headers)
		resp = conn.getresponse()
		conn.close()
		return {'statusCode':resp.status, 'reason':resp.reason}


	'''
		increment the numeric part of sequence# of the form 'src#number' '''
	@staticmethod
	def incrementSequenceNumber(sn) :
		matches = re.match("(.*)#(\d*)",sn)
		return matches.group(1)+'#'+str(int(matches.group(2))+1)


	'''
		return true if the provided code is 2xx '''
	@staticmethod
	def isHttpSuccessCode(statusCode) :
		return math.floor(statusCode/100.0) == 2

	
	'''
		pretty-print anything '''
	@staticmethod
	def pprint(o) :
		pp = pprint.PrettyPrinter(indent=4,width=40)
		pp.pprint(o)


	'''
		print a himesis graph '''
	@staticmethod
	def printHG(hg) :
		pp = pprint.PrettyPrinter(indent=4,width=40)
		for v in hg.vs :
			pp.pprint(v.attributes())
		if len(hg.es) > 0 :
			print(hg.get_adjacency())

	
	'''
		same as JavaScript setTimeout... do 'callback()' after 'delay' seconds
	  	have elapsed '''		
	@staticmethod
	def setTimeout(delay, callback, args=[]) :
		t = threading.Timer(delay,callback,args)
		t.start()
		return t

	'''
		returns the numeric part of sequence# of the form 'src#number' '''
	@staticmethod
	def sn2int(sn) :
		return int(re.match(".*#(\d*)",sn).group(1))

