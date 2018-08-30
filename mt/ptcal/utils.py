'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''
import pprint, json, re, math, threading, sys

if sys.version_info[0] < 3:
	import httplib as httplib
else:
	import http.client as httplib


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
		except Exception as e :
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
		headers = {'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*'}
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

