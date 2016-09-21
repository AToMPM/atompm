from visitor import Visitor
from sccd_constructs import INSTATE_SEQ
from compiler_exceptions import CompilerException
from lexer import Lexer, Token, TokenType

class StateReferenceException(CompilerException):
	pass

class StateLinker(Visitor):
	
	def __init__(self):
		self.visiting_statechart = None
		self.visiting_node = None
		self.lexer = Lexer()
	
	def visit_ClassDiagram(self, class_diagram): 
		for c in class_diagram.classes :
			c.accept(self)

	def visit_Class(self, c):
		if c.statechart:
			c.statechart.accept(self)
		
	def visit_StateChart(self, statechart):
		self.visiting_statechart = statechart
		for node in statechart.basics + statechart.composites:
			node.accept(self)
					 
	def visit_StateChartNode(self, node):
		self.visiting_node = node
		node.enter_action.accept(self)
		node.exit_action.accept(self)
		for transition in node.transitions :
			transition.accept(self)
			
	def visit_StateChartTransition(self, transition):
		try :
			transition.target.accept(self)
		except StateReferenceException as exception :
			raise StateReferenceException("Transition from <" + self.visiting_node.full_name + "> has invalid target. " + exception.message)
		try :
			transition.action.accept(self)
		except StateReferenceException as exception :
			raise StateReferenceException("Transition from <" + self.visiting_node.full_name + "> has invalid action. " + exception.message)
		try :
			if transition.guard :
				transition.guard.accept(self)
		except StateReferenceException as exception :
			raise StateReferenceException("Transition from <" + self.visiting_node.full_name  + "> has invalid guard. " + exception.message)
		
	def visit_StateReference(self, state_reference):
		state_reference.target_nodes = []
		
		current_node = None #Will be used to find the target state(s)
		split_stack = [] #used for branching

		self.lexer.input(state_reference.path_string)

		for token in self.lexer.tokens() :
			
			if current_node == None : #current_node is not set yet or has been reset, the CHILD token can now have a special meaning
				if token.type == TokenType.SLASH :
					#Root detected
					current_node = self.visiting_statechart.root
					#Token consumed so continue
					continue
				else :
					current_node = self.visiting_node
					
			if token.type == TokenType.DOT :
				#Advance to next token
				token = self.lexer.nextToken()
				
				if token is None or token.type == TokenType.SLASH :
					#CURRENT operator "." detected
					continue
				elif token.type == TokenType.DOT :
					#Advance to next token
					token = self.lexer.nextToken()
					if token is None or token.type == TokenType.SLASH :
						#PARENT operator ".." detected
						current_node = current_node.parent
						if current_node is None :
							raise StateReferenceException("Illegal use of PARENT \"..\" operator at position " + str(token.pos) + " in state reference. Root of statechart reached.")
					
					else :
						raise StateReferenceException("Illegal use of PARENT \"..\" operator at position " + str(token.pos) + " in state reference.")
	
				else :
					raise StateReferenceException("Illegal use of CURRENT \".\" operator at position " + str(token.pos) + " in state reference.")
					
			elif token.type == TokenType.SLASH :
				continue
			elif token.type == TokenType.WORD :
				#try to advance to next child state
				cname = token.val
				found = False
				for child in current_node.children :
					if child.name == cname : 
						found = True
						current_node = child
						break
				if not found :
					raise StateReferenceException("Refering to non exiting node at posisition " + str(token.pos) + " in state reference.")
			elif token.type == TokenType.LBRACKET :
				split_stack.append(current_node)
			elif token.type == TokenType.RBRACKET :
				if len(split_stack) > 0 :
					split_stack.pop()
				else :
					raise StateReferenceException("Invalid token at position " + str(token.pos) + " in state reference.")
			elif token.type == TokenType.COMMA :
				state_reference.target_nodes.append(current_node)
				if len(split_stack) > 0 :
					current_node = split_stack[-1]
				else :
					current_node = None
			
			else :
				raise StateReferenceException("Invalid token at position " + str(token.pos) + " in state reference.")
		
		if (len(split_stack) != 0) or (current_node is None) : #RB missing or extra COMMA
			raise StateReferenceException("State reference ends unexpectedly.")
		
		#TODO better validation of the target! When is it a valid state configuration?
		for node in state_reference.target_nodes :
			if current_node == node :
				raise StateReferenceException("A state reference can't reference the same node more than once.")
			if node.isDescendantOrAncestorOf(current_node) :
				raise StateReferenceException("A state reference can't reference a node and one of its descendants.");
		
		state_reference.target_nodes.append(current_node)
			
		if len(state_reference.target_nodes) == 0 :
			raise StateReferenceException("Meaningless state reference.")

	def visit_Expression(self, expression):
		for part in expression.expression_parts :
			part.accept(self)

	def visit_EnterExitAction(self, action):
		if action.action :
			action.action.accept(self)
			
	def visit_Action(self, action):
		for subaction in action.sub_actions :
			subaction.accept(self)
			
	def visit_InStateCall(self, call):
		try :
			call.target.accept(self)
		except StateReferenceException :
			raise StateReferenceException("Invalid state reference for " + INSTATE_SEQ + " call.")
		
	def visit_Assign(self, assign):
		assign.expression.accept(self)
