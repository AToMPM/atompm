class CompilerException(Exception):
	def __init__(self, message):
		self.message = message
	def __str__(self):
		return repr(self.message)
	
class TransitionException(CompilerException):
	pass

class UnprocessedException(CompilerException):
	pass

class CodeBlockException(CompilerException):
	pass
