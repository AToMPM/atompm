from utils import Enum

TokenType = Enum("SLASH",
				 "LBRACKET",
				 "RBRACKET",
				 "COMMA",
				 "DOT",
				 "NUMBER",
				 "WORD",
				 "QUOTED",
				 "WHITESPACE",
				 "BINARYOPERATOR",
				 "UNARYOPERATOR",
				 "UNKNOWN"
				)

class Token(object):
	""" A simple Token structure. Token type, value and position.
	"""
	def __init__(self, token_type, val, pos):
		self.type = token_type
		self.val = val
		self.pos = pos

	def __str__(self):
		return '%s(%s) at %s' % (TokenType.name_of(self.type), self.val, self.pos)


class LexerError(Exception):
	def __init__(self, pos):
		self.pos = pos
		
class Lexer(object):
	single_rules = {
			'/': TokenType.SLASH,
			'(': TokenType.LBRACKET,
			')': TokenType.RBRACKET,
			',': TokenType.COMMA,
			'.': TokenType.DOT,
			'+': TokenType.BINARYOPERATOR,
			'-': TokenType.BINARYOPERATOR,
			'<': TokenType.BINARYOPERATOR,
			'>': TokenType.BINARYOPERATOR,
			'==': TokenType.BINARYOPERATOR,
			'<=': TokenType.BINARYOPERATOR,
			'>=': TokenType.BINARYOPERATOR,
			'=': TokenType.BINARYOPERATOR,
			'+=': TokenType.BINARYOPERATOR,
			'-=': TokenType.BINARYOPERATOR,
			'&&': TokenType.BINARYOPERATOR,
			'||': TokenType.BINARYOPERATOR,
			'!': TokenType.UNARYOPERATOR}
	
	def __init__(self, skip_white_space = True, accept_unknown_tokens = False):
		self.skip_white_space = skip_white_space
		self.accept_unknown_tokens = accept_unknown_tokens

	def input(self, buf):
		""" Initialize the lexer with a buffer as input.
		"""
		self.buf = buf
		self.pos = 0
		self.buflen = len(buf)

	def nextToken(self):
		""" Return the next token (a Token object) found in the
			input buffer. None is returned if the end of the
			buffer was reached.
			In case of a lexing error (the current chunk of the
			buffer matches no rule), a LexerError is raised.
		"""
		if self.skip_white_space :
			self.skipWhiteSpace() 
		if self.pos >= self.buflen:
			return None

		#c part of next token
		c = self.buf[self.pos]
		
		#check if it is an operator
		result_type = self.single_rules.get(c,None)
		if result_type is not None :
			if self.pos < self.buflen-1:
				c2 = c+self.buf[self.pos+1]
				result_type2 = self.single_rules.get(c2, None)
				if result_type2 is not None:
					c = c2
					result_type = result_type2
					self.pos += 1
			token = Token(result_type, c, self.pos)
			self.pos += 1
			return token
		else : #not an operator
			if (self.isAlpha(c)) :
				return self.processIdentifier()
			elif (self.isDigit(c)) :
				return self.processNumber()
			elif ( c == "'" or c == '"') :
				return self.processQuote()
			elif (self.isWhiteSpace(c)) :
				return self.processWhiteSpace()

		# if we're here, no rule matched
		if self.accept_unknown_tokens :
			token = Token(TokenType.UNKNOWN, c, self.pos)
			self.pos += 1
			return token
		raise LexerError("Invalid character at position " + str(self.pos) + ".")

	def tokens(self):
		""" Returns an iterator to the tokens found in the buffer.
		"""
		while True:
			tok = self.nextToken()
			if tok is None: break
			yield tok
			
	def skipWhiteSpace(self):
		while (self.pos < self.buflen) : 
			if self.isWhiteSpace(self.buf[self.pos]) :
				self.pos += 1
			else :
				break	  
			
	def isAlpha(self, c):
		return c.isalpha() or c == '_';
	
	def isAlphaNum(self, c):
		return c.isalnum() or c == '_';
	
	def isDigit(self, c):
		return c.isdigit()
	
	def isWhiteSpace(self, c):
		return c == ' ' or c == '\t' or c == '\r' or c == '\n'
	
	def processNumber(self):
		nextpos = self.pos + 1
		while (nextpos < self.buflen) and (self.isDigit(self.buf[nextpos])) :
			nextpos += 1;
		token = Token(TokenType.NUMBER, self.buf[self.pos:nextpos], self.pos)
		self.pos = nextpos
		return token
	
	def processIdentifier(self):
		nextpos = self.pos + 1
		while (nextpos < self.buflen) and (self.isAlphaNum(self.buf[nextpos])) :
			nextpos += 1;
		token = Token(TokenType.WORD, self.buf[self.pos:nextpos], self.pos)
		self.pos = nextpos
		return token
	
	def processQuote(self):
		# self.pos points at the opening quote. Find the ending quote.
		end_index = self.buf.find(self.buf[self.pos], self.pos + 1)
	
		if (end_index == -1) :
			raise LexerError("Missing matching quote for the quote at position " + str(self.pos) + ".")
		token = Token(TokenType.QUOTED, self.buf[self.pos:end_index+1], self.pos)

		self.pos = end_index + 1;
		return token;
	
	def processWhiteSpace(self):
		nextpos = self.pos + 1
		while (nextpos < self.buflen) and (self.isWhiteSpace(self.buf[nextpos])) :
			nextpos += 1;
		token = Token(TokenType.WHITESPACE, self.buf[self.pos:nextpos], self.pos)
		self.pos = nextpos
		return token
