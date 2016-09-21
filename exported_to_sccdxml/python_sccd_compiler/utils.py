from compiler_exceptions import CodeBlockException
from sys import stdout

class Logger(object):
	verbose = 0 #-1= no output
				#0 = only errors
				#1 = only warnings and errors
				#2 = all output
				
	@staticmethod   
	def showError(error):
		if(Logger.verbose > -1) :
			print "ERROR : " + error
				
	@staticmethod
	def showWarning(warning):
		if(Logger.verbose > 0) :
			print "WARNING : " + warning
			
	@staticmethod	
	def showInfo(info):
		if(Logger.verbose > 1) :
			print "INFO : " + info

#######################

class Enum():	
	def __init__(self, *entries):
		self._keys = entries
		self._map = {}
		for v,k in enumerate(self._keys) :
			self._map[k] = v
			
	def __getattr__(self, name):
		return self._map[name]
			
	def name_of(self, index):
		return self._keys[index]

#######################

NOT_SET = 0
SPACES_USED = 1
TABS_USED = 2

class FormattedWriter:

	def __init__(self, out = stdout):
		self.out = out
		self.indentLevel = 0
		self.indentSpace = "\t"
		self.first_write = True

	def write(self, text = ""):
		if self.first_write :
			self.first_write = False
			if text == "":
				self.out.write(self.indentLevel*self.indentSpace)
			else:
				self.out.write(self.indentLevel*self.indentSpace + text)  
		else:
			if text == "":
				self.out.write("\n" + self.indentLevel*self.indentSpace)
			else:
				self.out.write("\n" + self.indentLevel*self.indentSpace + text)
	
	def extendWrite(self, text = ""):
		self.out.write(text)
				
	def indent(self):
		self.indentLevel+=1

	def dedent(self):
		self.indentLevel-=1

	def writeCodeCorrectIndent(self, body):
		lines = body.split('\n')
		while( len(lines) > 0 and lines[-1].strip() == "") :
			del(lines[-1])
	
		index = 0;
		while( len(lines) > index and lines[index].strip() == "") :	   
			index += 1
			
		if index >= len(lines) :
			return
		#first index where valid code is present
		to_strip_index = len(lines[index].rstrip()) - len(lines[index].strip()) 
		indent_type = NOT_SET;
			
		while index < len(lines):
			strip_part = lines[index][:to_strip_index]
			
			if( ('\t' in strip_part and ' ' in strip_part) or
				(indent_type == SPACES_USED and '\t' in strip_part) or
				(indent_type == TABS_USED and ' ' in strip_part)
			) :
				raise CodeBlockException("Mixed tab and space indentation!")
			
			if indent_type == NOT_SET :
				if ' ' in strip_part :
					indent_type = SPACES_USED
				elif '\t' in strip_part :
					indent_type = TABS_USED
					
			self.write(lines[index][to_strip_index:])
			index += 1


class FileWriter(FormattedWriter):

	def __init__(self, filename):
		FormattedWriter.__init__(self, open(filename, 'w'))

	def close(self):
		self.out.close()

#######################
