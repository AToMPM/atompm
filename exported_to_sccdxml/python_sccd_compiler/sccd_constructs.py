import abc
import re
import xml.etree.ElementTree as ET
import os.path
from utils import Logger
from visitor import Visitable
from compiler_exceptions import CompilerException, TransitionException, UnprocessedException
from lexer import Lexer, Token, TokenType

# http://docs.python.org/2/library/xml.etree.elementtree.html

# list of reserved words
reserved = ["__init__", "__del__", "init", "transition", "microstep", "step", "inState", "event", "addEvent", 
			"broadcast", "getEarliestEvent", "__str__", "controller", 
			"current_state", "timers", "eventQueue", "Controller", "state_changed", "history_state",
			"root", "narrowcast", "object_manager", "update"]

SELF_REFERENCE_SEQ = 'SELF'
INSTATE_SEQ = 'INSTATE'

##################################

class StateReference(Visitable):
	def __init__(self, input_string):
		self.path_string = input_string
		self.target_nodes = None #calculated in state linker
		
	def getNodes(self):
		#if no target nodes are set, it means that the visitor corresponding for that hasn't visited yet
		if self.target_nodes is None:
			raise UnprocessedException("State reference not resolved yet.")
		return self.target_nodes
   
##################################
class ExpressionPart(Visitable):
	__metaclass__  = abc.ABCMeta
	
class ExpressionPartString(ExpressionPart):
	def __init__(self, string):
		self.string = string
	
class SelfReference(ExpressionPart):		
	pass
	
class InStateCall(ExpressionPart):
	def __init__(self, state_string):
		self.target = StateReference(state_string)

##################################

	
class Expression(Visitable):
	lexer = Lexer(False, True)
	
	def __init__(self, input):
		if not input :
			raise CompilerException("Empty Expression.")
		self.parse(input)
		
	def parse(self, input, dont_parse = []):
		self.expression_parts = []
		self.lexer.input(input)
		processed_bare_expression = ""
		
		for token in self.lexer.tokens() :
			created_object = None
			
			if token.type == TokenType.WORD :
				if token.val in dont_parse :
					raise CompilerException("Macro \"" + token.val + "\" not allowed here.")
				elif token.val == SELF_REFERENCE_SEQ :
					created_object = SelfReference()
				elif token.val == INSTATE_SEQ :
					created_object = self.parseInStateCall()
					if created_object is None :
						raise CompilerException("Illegal use of \"" + INSTATE_SEQ + "\" macro.")
					
			if created_object is None:
				processed_bare_expression += token.val
			else :	
				if processed_bare_expression != "" :
					self.expression_parts.append(ExpressionPartString(processed_bare_expression))
					processed_bare_expression = ""
				self.expression_parts.append(created_object)  
		
		#Process part of input after the last created macro object
		if processed_bare_expression != "" :
			self.expression_parts.append(ExpressionPartString(processed_bare_expression))
			
	def parseInStateCall(self):
		token = self.lexer.nextToken()
		if token is None or token.type != TokenType.LBRACKET :
			return None
		token = self.lexer.nextToken()
		if token is None or token.type != TokenType.QUOTED :
			return None
		else :
			created_object = InStateCall(token.val[1:-1])
		token = self.lexer.nextToken()
		if token is None or token.type != TokenType.RBRACKET :
			return None
		else :
			return created_object

class LValue(Expression):
	def __init__(self, input):
		if not input :
			raise CompilerException("Empty LValue.")
		self.parse(input, [INSTATE_SEQ])
		#do some validation, provide parameters to processString to make the function more efficient
	 
##################################	 
	 
class FormalEventParameter(Visitable):
	def __init__(self, name, ptype = ""):
		self.name = name
		self.type = ptype
		
	def getName(self):
		return self.name
	
	def getType(self):
		return self.type
	
##################################
class TriggerEvent:
	def __init__(self, xml_element):
		self.is_uc = False;
		self.is_after = False
		self.after_index = -1
		self.params = []
		
		self.event = xml_element.get("event", "").strip()
		self.after = xml_element.get("after", "").strip()
		self.port = xml_element.get("port", "").strip()
		if self.event and self.after :
			raise CompilerException("Cannot have both the event and after attribute set for a transition.")
		
		if not self.event and self.port:
			raise CompilerException("A transition without event can not have a port.")

		if self.after :
			if self.port :
				raise CompilerException("After event can not have a port.")
			self.is_after = True
			self.after = Expression(self.after)
			return
		elif not self.event :
			self.is_uc = True
			return
			
		self.params = []
		parameters = xml_element.findall('parameter')	
		for p in parameters :
			name = p.get("name","")
			if not name :
				raise CompilerException("Parameter without name detected.")
			self.params.append(FormalEventParameter(name, p.get("type","")))
			
	def getEvent(self):	
		return self.event
	
	def setEvent(self, event):
		self.event = event
	
	def getParameters(self):	
		return self.params
	
	def getPort(self):
		return self.port
		
	def isUC(self):
		return self.is_uc;
	
	def isAfter(self):
		return self.is_after
	
	def getAfterIndex(self):
		return self.after_index
	
	def setAfterIndex(self, after):
		self.after_index = after
		

##################################

class SubAction(Visitable):
	__metaclass__  = abc.ABCMeta
	
	@abc.abstractmethod
	def check(self):
		pass
	
	@classmethod
	def create(cls, xml_element):
		for subcls in cls.__subclasses__():
			tag = xml_element.tag.lower()
			if subcls.check(tag):
				return subcls(xml_element)
		raise CompilerException("Invalid subaction.")
	
##################################
"""
	Is a possible subaction; generates an event.
"""

class RaiseEvent(SubAction):
	tag = "raise"
	LOCAL_SCOPE = 1
	BROAD_SCOPE = 2
	OUTPUT_SCOPE = 3
	NARROW_SCOPE = 4
	CD_SCOPE = 5
	
	
	def __init__(self, xml_element):
		self.event = xml_element.get("event","").strip()
		scope_string = xml_element.get("scope","").strip().lower()
		self.target = xml_element.get("target","").strip()
		self.port = xml_element.get("port","").strip()
		
		if scope_string == "local" :
			self.scope = self.LOCAL_SCOPE
		elif scope_string == "broad" :
			self.scope = self.BROAD_SCOPE
		elif scope_string == "output" :
			self.scope = self.OUTPUT_SCOPE
		elif scope_string == "narrow" :
			self.scope = self.NARROW_SCOPE
		elif scope_string == "cd" :
			self.scope = self.CD_SCOPE
		elif scope_string == "" :
			#Calculate scope depending on present attributes
			if self.target and self.port :
				raise CompilerException("Both target and port attribute detected without a scope defined.")
			elif self.port :
				self.scope = self.OUTPUT_SCOPE
			elif self.target :
				self.scope = self.NARROW_SCOPE
			else :
				self.scope = self.LOCAL_SCOPE  
			
		else :
			raise CompilerException("Illegal scope attribute; needs to be one of the following : local, broad, narrow, output, cd or nothing.");  
				
		if self.scope == self.LOCAL_SCOPE or self.scope == self.BROAD_SCOPE or self.scope == self.CD_SCOPE:
			if self.target :
				Logger.showWarning("Raise event target detected, not matching with scope. Ignored.")
				self.target = ""
			if self.port :
				Logger.showWarning("Raise event port detected, not matching with scope. Ignored.")
				self.port = ""
		if self.scope == self.NARROW_SCOPE and self.port :
			Logger.showWarning("Raise event port detected, not matching with scope. Ignored.")
			self.port = ""
		if self.scope == self.OUTPUT_SCOPE and self.target :
			Logger.showWarning("Raise event target detected, not matching with scope. Ignored.")
			self.target = ""
				
		self.params = []
		parameters = xml_element.findall('parameter')	
		for p in parameters :
			value = p.get("expr","")
			if not value :
				raise CompilerException("Parameter without value detected.")
			self.params.append(Expression(value))
	
	@staticmethod
	def check(tag):
		return tag == RaiseEvent.tag
	
	def getPort(self):
		return self.port
			
	def isLocal(self):
		return self.scope == self.LOCAL_SCOPE
	
	def isNarrow(self):
		return self.scope == self.NARROW_SCOPE
	
	def isBroad(self):
		return self.scope == self.BROAD_SCOPE
	
	def isOutput(self):
		return self.scope == self.OUTPUT_SCOPE
	
	def isCD(self):
		return self.scope == self.CD_SCOPE
	
	def getTarget(self):
		return self.target
	
	def getEventName(self):
		return self.event
	
	def getParameters(self):	
		return self.params
	
	def getScope(self):
		return self.scope
			
class Script(SubAction):
	tag = "script"
	def __init__(self, xml_element):
		self.code = xml_element.text if xml_element.text else ""
		
	@staticmethod
	def check(tag):
		return tag == Script.tag
			
class Log(SubAction):
	tag = "log"
	def __init__(self, xml_element):
		self.message = xml_element.text.strip()
		
	@staticmethod
	def check(tag):
		return tag == Log.tag

class Assign(SubAction):
	tag = "assign"
	def __init__(self, xml_element):
		self.lvalue = LValue(xml_element.get("ident",""))
		self.expression = Expression(xml_element.get("expr",""))
	
	@staticmethod   
	def check(tag):
		return tag == Assign.tag
  
##################################

"""
	Exists out of multiple subactions
"""
class Action(Visitable):
	def __init__(self, xml_element):
		self.sub_actions = []
		for subaction in list(xml_element) :
			if subaction.tag not in ["parameter"] :	  
				self.sub_actions.append(SubAction.create(subaction))
			
	def accept(self, visitor):
		for subaction in self.sub_actions :
			subaction.accept(visitor)
		
##################################

class StateChartTransition(Visitable):
	def __init__(self,xml_element,parent):
		self.xml = xml_element
		self.parent_node = parent
		self.trigger = TriggerEvent(self.xml)
		guard_string = self.xml.get("cond","").strip()
		if guard_string != "" : 
			self.guard = Expression(guard_string)
		else :
			self.guard = None
		target_string = self.xml.get("target","").strip()
		if target_string == "" :
			raise CompilerException("Transition from <" + self.parent_node.full_name + "> has empty target.")
		self.target = StateReference(target_string)
		
		self.action = Action(self.xml)
		
		self.enter_nodes = None # Ordered list of nodes to be entered upon taking the transition, set by the path calculator
		self.exit_nodes = None # Ordered list of nodes to be exited upon taking the transition, set by the path calculator
		self.arena = None # Lowest common Or-state ancestor of source and destination
		
	def getEnterNodes(self):
		if self.enter_nodes is None :
			raise UnprocessedException("Enter path not calculated yet.")
		return self.enter_nodes
	
	def getExitNodes(self):
		if self.exit_nodes is None :
			raise UnprocessedException("Exit path not calculated yet.")
		return self.exit_nodes
		
	def isUCTransition(self):
		""" Returns true iff is an unconditional transition (i.e. no trigger)
		"""
		return self.trigger.isUC()
	
	def getParentNode(self):
		return self.parent_node
		
	def getTrigger(self):
		return self.trigger
		
	def getGuard(self):
		return self.guard
		
	def getTargetNodes(self):
		return self.target.getNodes()

	def hasGuard(self):
		return self.guard != None
	
	def getAction(self):
		return self.action		

##################################  

class EnterExitAction(Visitable):
	def __init__(self, parent_node, xml_element = None):
		self.parent_node = parent_node
		if xml_element is not None:
			self.action = Action(xml_element)
		else :
			self.action = None
		
class EnterAction(EnterExitAction):
	def __init__(self, parent_node, xml_element = None):
		EnterExitAction.__init__(self, parent_node, xml_element)
		
class ExitAction(EnterExitAction):
	def __init__(self, parent_node, xml_element = None):
		EnterExitAction.__init__(self, parent_node, xml_element)
		
##################################  

class StateChartNode(Visitable):
	def __init__(self, statechart, xml_element, parent = None):
		self.statechart = statechart
		self.parent = parent
		self.children = []

		self.is_root = False
		self.is_basic = False
		self.is_composite = False
		self.is_history = False
		self.is_history_deep = False
		self.is_parallel_state = False
		self.save_state_on_exit = False
			
		if xml_element.tag == "scxml" : 
			self.is_root = True
			self.is_composite = True
		elif xml_element.tag == "parallel" : 
			self.is_composite = True
			self.is_parallel_state = True
		elif xml_element.tag == "state" :
			if len(xml_element.findall("state")) > 0 or (len(xml_element.findall("parallel")) > 0) :
				self.is_composite = True
			else :
				self.is_basic = True
			if  self.parent.is_parallel_state :
				if (self.is_basic) :
					raise CompilerException("Orthogonal nodes (nodes that are immediate children of parallel nodes) can't be basic.")
		elif xml_element.tag == "history" :
			history_type = xml_element.get("type","shallow")
			if history_type == "deep" :
				self.is_history_deep = True
			elif history_type != "shallow" :
				raise CompilerException("Invalid history type.") 
			self.is_history = True			
		else :
			return
							
		self.resolveName(xml_element)
		#self.parseConflictAttribute(xml_element)
		self.parseEnterActions(xml_element)
		self.parseExitActions(xml_element)
		
		#transitions
		self.transitions = []
		for transition_xml in xml_element.findall("transition"):
			self.transitions.append(StateChartTransition(transition_xml,self))
			
		self.optimizeTransitions()
		self.generateChildren(xml_element)	
		self.calculateDefaults(xml_element)
			
	def resolveName(self, xml):
		if self.is_root :
			self.name = "Root"
			self.full_name = "Root"
		else :
			self.name = xml.get("id","")
			self.full_name = self.parent.full_name + "_" + self.name
	
	"""
	def parseConflictAttribute(self, xml):
		conflict = xml.get("conflict","")
		if conflict == "outer" :
			self.solves_conflict_outer = True
		elif conflict == "inner" :
			self.solves_conflict_outer = False
		else :	
			if not (conflict == "" or conflict == "inherit") :
				raise CompilerException("Unknown conflict attribute for " + self.full_name + ".")
			#Do our default inherit action
			if self.is_root or self.parent.solves_conflict_outer: 
				self.solves_conflict_outer = True
			else :
				self.solves_conflict_outer = False
	"""
				
	def parseEnterActions(self, xml):
		on_entries = xml.findall("onentry")
		if on_entries :
			if len(on_entries) > 1:
				raise CompilerException("Multiple <onentry> tags detected for "+ self.full_name + ", only 1 allowed.")
			self.enter_action = EnterAction(self, on_entries[0])
		else :
			self.enter_action = EnterAction(self)
			
	def parseExitActions(self, xml):
		on_exits = xml.findall("onexit")
		if on_exits :
			if len(on_exits) > 1:
				raise CompilerException("Multiple <onexit> tags detected for "+ self.full_name + ", only 1 allowed.")
			self.exit_action = ExitAction(self, on_exits[0])	
		else :
			self.exit_action = ExitAction(self)
			
	def optimizeTransitions(self):
		"""If a transition with no trigger and no guard is found then it is considered as the only transition.
		Otherwise the list is ordered by placing transitions having guards only first."""
		onlyguards = []
		withtriggers = []
		optimized = []
		for transition in self.transitions:
			if transition.isUCTransition():
				if not transition.hasGuard():
					if optimized :
						raise TransitionException("More than one transition found at a single node, that has no trigger and no guard.")
					optimized.append(transition)
				else:
					onlyguards.append(transition)
			else:
				withtriggers.append(transition)
		if not optimized :		
			optimized = onlyguards + withtriggers
		self.transitions = optimized
	
	def generateChildren(self, xml):
		children_names = []
		for child_xml in list(xml) :
			child = StateChartNode(self.statechart, child_xml, self)
			if not (child.is_composite or child.is_basic or child.is_history) :
				continue
			self.children.append(child)
			
			#Check if the name of the child is valid
			child_name = child.name
			if child_name == "" :
				raise CompilerException("Found state with no id")
			if child_name in children_names :
				raise CompilerException("Found 2 equivalent id's : " + child_name + ".")
			children_names.append(child_name)
			
	def calculateDefaults(self, xml):
		initial_state = xml.get("initial","")	 
		
		if self.is_parallel_state :
			self.defaults = [child for child in self.children if not child.is_history]
			if initial_state != "" : 
				raise CompilerException("Component <" + self.full_name + ">  contains an initial state while being parallel.")	
		elif initial_state == "" :
			if self.is_basic or self.is_history:
				pass
			elif len(self.children) == 1 :
				self.defaults = self.children
			else :
				raise CompilerException("Component <" + self.full_name + "> contains no default state.") 
		else :
			if self.is_basic :
				raise CompilerException("Component <" + self.full_name + "> contains a default state while being a basic state.")
			self.defaults = []
			for child in self.children :
				if child.name == initial_state :
					self.defaults.append(child)
			if len(self.defaults) < 1 :
				raise CompilerException("Initial state '"+ initial_state + "' referred to, is missing in " + self.full_name)
			elif len(self.defaults) > 1 :
				raise CompilerException("Multiple states with the name '" + initial_state + " found in " + self.full_name + " which is referred to as initial state.")
	
	def getAncestors(self):
		""" Returns a list representing the containment hierarchy of node.
			node is always the first element, and its outermost parent is the last.
		"""
		current = self
		while not current.is_root :
			current = current.parent
			yield current
	
	def isDescendantOf(self, anc):
		current = self
		while not current.is_root :
			current = current.parent
			if current == anc :
				return True
		return False
		
	def isDescendantOrAncestorOf(self, node):
		return self.isDescendantOf(node) or node.isDescendantOf(self)
  
		
##################################

class StateChart(Visitable):

	def __init__(self, class_obj, statechart_xml):
		""" Gives the module information on the statechart by listing its basic, orthogonal,
			composite and history states as well as mapping triggers to names making the
			appropriate conversion from AFTER() triggers to event names
		"""
		
		self.class_obj = class_obj
		self.root = StateChartNode(self, statechart_xml); #creates the whole statechart structure recursively

		self.basics = []
		self.composites = []
		self.histories = []
		self.nr_of_after_transitions = 0

		def getSemanticOption(name, allowed_values, default_value):
			result = statechart_xml.get(name, default_value)
			if result not in allowed_values:
				raise CompilerException("Illegal value for semantic option " + name + ": '" + result + "'. Allowed values are ['" + "', '".join(allowed_values) + "'], default value is '" + default_value + "'.")
			return result

		self.big_step_maximality = getSemanticOption("big_step_maximality", ["take_one", "take_many"], "take_many")
		self.internal_event_lifeline = getSemanticOption("internal_event_lifeline", ["next_small_step", "next_combo_step", "queue"], "queue")
		self.input_event_lifeline = getSemanticOption("input_event_lifeline", ["first_small_step", "first_combo_step", "whole"], "first_combo_step")
		self.priority = getSemanticOption("priority", ["source_parent", "source_child"], "source_parent")
		self.concurrency = getSemanticOption("concurrency", ["single", "many"], "single")

		if self.internal_event_lifeline == "next_combo_step":
			if self.big_step_maximality == "take_one":
				Logger.showWarning("Using 'Next Combo Step' internal event lifeline semantics and 'Take One' big step maximality semantics simultaneously doesn't make sense.")

		self.extractFromHierarchy(self.root) #recursively extracts the basics, composites, histories and nr_of_after_transitions
			
		# Calculate the history that needs to be taken care of.
		self.shallow_history_parents = []
		self.deep_history_parents = []
		self.combined_history_parents = [] #All nodes that need state saved on leaving
		for node in self.histories:
			self.calculateHistory(node.parent, node.is_history_deep)
			
	def extractFromHierarchy(self, node):
		# For each AFTER event, give it a name so that it can be triggered.
		for transition in node.transitions:
			trigger = transition.trigger
			if trigger.isAfter() :
				trigger.setAfterIndex(self.nr_of_after_transitions)
				value = "_" + str(trigger.getAfterIndex()) + "after"
				trigger.setEvent(value)
				self.nr_of_after_transitions += 1
				
		if node.is_basic : 
			self.basics.append(node)
		elif node.is_composite : 
			self.composites.append(node)
		elif node.is_history : 
			self.histories.append(node)
			
		for child in node.children :
			self.extractFromHierarchy(child)

	def calculateHistory(self, parent, is_deep):
		""" Figures out which components need to be kept track of for history.
		"""
		if parent == self.root:
			raise CompilerException("Root component cannot contain a history state.")
		if parent not in self.combined_history_parents:
			self.combined_history_parents.append(parent)
			parent.save_state_on_exit = True
		if is_deep :
			if parent not in self.deep_history_parents:
				self.deep_history_parents.append(parent)
		else :
			if parent not in self.shallow_history_parents:
				self.shallow_history_parents.append(parent)
		if parent.is_parallel_state or is_deep :
			for i in parent.children:
				if i.is_composite :
					self.calculateHistory(i, is_deep)
	
###################################

class Association(Visitable):
	def __init__(self, to_class, min_card, max_card, name):
		self.min = min_card
		self.max = max_card #N is represented as -1
		self.to_class = to_class
		self.name = name
		
###################################
class FormalParameter(Visitable):
	def __init__(self, param_ident, param_type, default = None):
		self.param_type = param_type
		self.identifier = param_ident
		self.default = default  
			
	def getType(self):
		return self.param_type
			
	def getIdent(self):
		return self.identifier
	
	def hasDefault(self):
		return self.default is not None
	
	def getDefault(self):
		return self.default
	
#slight hack because of lacking multiple constructors
class XMLFormalParameter(FormalParameter):
	def __init__(self, xml):
		self.param_type = xml.get("type", "")
		self.identifier = xml.get("name","")
		self.default = xml.get("default",None)
	
###################################
class Method(Visitable):
	def __init__(self, xml, parent_class):
		self.name = xml.get("name", "")
		self.access = xml.get("access", "public")
		parameters = xml.findall("parameter")
		self.parameters = []
		for p in parameters:
			self.parameters.append(XMLFormalParameter(p))
		bodies = xml.findall("body")
		if len(bodies) > 1 : 
			raise CompilerException("Method can have at most one body.")
		elif len(bodies) == 1:
			self.body = bodies[0].text
		else:
			self.body = ""
		self.parent_class = parent_class
		self.return_type = xml.get('type',"")
		self.is_abstract = xml.get('abstract', False)
		
	def getParams(self):
		return self.parameters

	def isAbstract(self):
		return self.is_abstract
		
###################################		
class Constructor(Method):
	def __init__(self, xml, parent_class):
		self.super_class_parameters = {};
		if xml is None :
			self.body = ""
			self.name = ""
			self.access = "public"			
			self.parent_class = parent_class
			self.return_type = ""
			self.parameters = []
		else :
			Method.__init__(self, xml, parent_class)	  
			super_class_parameters = xml.findall("super")
			for s in super_class_parameters:
				class_name = s.get("class")
				self.super_class_parameters[class_name] = []
				params = s.findall("parameter")
				for p in params:
					self.super_class_parameters[class_name].append(p.get("expr"))
		
class Destructor(Method):
	def __init__(self, xml, parent_class):
		if xml is None :
			self.body = ""
			self.name = ""
			self.access = "public"			
			self.parent_class = parent_class
			self.return_type = ""
			self.parameters = []
		else :
			Method.__init__(self, xml, parent_class)
		
###################################		 
class Attribute(Visitable):
	def __init__(self, xml):
		self.name = xml.get('name',"")
		self.type = xml.get('type',"")
		self.init_value = xml.get("init-value", None)
		
	def getIdent(self):
		return self.name
	
	def getType(self):
		return self.type
	
	def getInit(self):
		return self.init_value
		
###################################

class Class(Visitable):
	def __init__(self, xml, class_diagram):

		self.xml = xml
		self.class_diagram = class_diagram
		self.name = xml.get("name", "")
		self.abstract_method_names = [] # this value will be written to by super_class_linker
		
		self.constructors = []
		self.destructors = []
		self.methods = []
		self.statechart = None

		self.inports = []
		self.outports = []
		self.attributes = []
		self.associations = []
		self.super_classes = []
		self.super_class_objs = {} # maps super class names to super class objects
		
		self.process()
		
	def getName(self):
		return self.name

	def isAbstract(self):
		return len(self.abstract_method_names) > 0
		
	def processMethod(self, method_xml) :
		name = method_xml.get("name", "")
		if name == self.name :
			self.constructors.append(Constructor(method_xml, self))
		elif name == '~' + self.name:
			self.destructors.append(Destructor(method_xml, self))
		else :
			if name in reserved:
				raise CompilerException("Reserved word \"" + name + "\" used as method in class <" + self.name + ">.")
			new_method = Method(method_xml, self)
			self.methods.append(new_method)

	def processAttribute(self, attribute_xml):
		attribute = Attribute(attribute_xml)
		if attribute.name in reserved:
			raise CompilerException("Reserved word \"" + attribute.name + "\" used as variable in class <" + self.name + ">.")

		self.attributes.append(attribute)
	
	def processInheritances(self, inheritances):
		# process each inheritance, stores a dict with each subclass as the key
		# and a list of tuples (superclass, priority) as the value. The priority
		# tells us which class to inherit from first for multiple inheritance. Gives
		# a WARNING with a given inheritance order if two priorities are the same

		for i in inheritances :
			self.super_classes.append((i.get("class",""),i.get("priority",1)))

		self.super_classes.sort(lambda a, b: cmp(b[1], a[1])) # sort from high priority to low priority
		priorityChecker = {}
		for super_class, priority in self.super_classes:
			if priority in priorityChecker:
				checkIt = priorityChecker[priority]
			else:
				checkIt = []
			if super_class not in checkIt:
				checkIt.append(super_class)
			priorityChecker[priority] = checkIt
		for priority, checkIt in priorityChecker.iteritems():
			if len(checkIt) > 1:
				Logger.showWarning("Class <" + self.name + "> inherits from classes <" + ", ".join(checkIt) + "> with same priority <" + str(priority) + ">. Document inheritance order is used.")

		self.super_classes = [entry[0] for entry in self.super_classes]
		
	def processAssociations(self, associations):
		for a in associations :
			class_name = a.get("class","")
			if not class_name :
				raise CompilerException("Faulty association.")
			card_min_string = a.get("min","0")
			try :
				card_min = int(card_min_string)
				if card_min < 0 :
					raise ValueError()
			except ValueError :
				raise CompilerException("Faulty card-min value in association.")
			card_max_string = a.get("max","N")
			if card_max_string == "N" :
				card_max = -1
			else :
				try :
					card_max = int(card_max_string)
					if card_max < card_min :
						raise ValueError()
				except ValueError :
					raise CompilerException("Faulty card-max value in association.") 
			
			association_name = a.get("name","")
			if not association_name :
				raise CompilerException("Faulty association. No name.")
			if association_name in reserved : 
				raise CompilerException("Reserved word \"" + association_name + "\" used as association name in class <" + self.name + ">.")
			self.associations.append(
				Association(class_name, card_min, card_max, association_name)
			)

	

	def process(self):
		inports = self.xml.findall("inport")
		for i in inports:
			name = i.get("name")
			if name in self.inports:
				raise CompilerException("Found 2 inports with the same name : " + name + ".")
			self.inports.append(name)

		outports = self.xml.findall("outport")
		for i in outports:
			name = i.get("name")
			if name in self.outports:
				raise CompilerException("Found 2 outports with the same name : " + name + ".")
			self.outports.append(name)

		associations = []
		inheritances = []
		relationships = self.xml.findall("relationships")
		for relationship_wrapper in relationships :
			associations.extend(relationship_wrapper.findall("association"))
			inheritances.extend(relationship_wrapper.findall("inheritance"))
			
		self.processAssociations(associations)
		self.processInheritances(inheritances)

		attributes = self.xml.findall("attribute")
		for a in attributes:
			self.processAttribute(a)

		methods = self.xml.findall("method")
		for m in methods:
			self.processMethod(m)

		constructors = self.xml.findall("constructor")
		for c in constructors:
			self.constructors.append(Constructor(c, self))

		destructors = self.xml.findall("destructor")
		for d in destructors:
			self.destructors.append(Destructor(d, self))
		
		if len(self.constructors) > 1 :
			raise CompilerException("Multiple constructors no longer supported!")

		if len(self.destructors) > 1 :
			raise CompilerException("Multiple destructors defined for class <" + self.name + ">.")

		if len(self.constructors) < 1 :
			# add a default constructor
			self.constructors.append(Constructor(None,self))

		if len(self.destructors) < 1 :
			# add a default destructor
			self.destructors.append(Destructor(None,self))

		statecharts = self.xml.findall("scxml")
		if len(statecharts) > 1 :
			raise CompilerException("Multiple statecharts found in class <" + self.name + ">.")
		if len(statecharts) == 1 :
			self.statechart = StateChart(self, statecharts[0])
			
###################################
class ClassDiagram(Visitable):
	def __init__(self, input_file):
		diagram_dir = os.path.dirname(input_file)
		tree = ET.parse(input_file)
		self.root = tree.getroot()
		self.name = self.root.get("name", "")
		self.author = self.root.get("author", "")
		descriptions = self.root.findall("description")
		self.language = self.root.get("language", "")
		if descriptions : 
			self.description = descriptions[0].text
		else :
			self.description = ""

		xml_classes = self.root.findall("class")
		# make sure at least one class is given
		if not xml_classes :
			raise CompilerException("Found no classes to compile.")

		# check if class diagram is valid
		# unique class names
		self.class_names = []
		substituted_xml_classes = []
		for xml_class in xml_classes :
			class_src = xml_class.get("src", "")
			class_default = xml_class.get("default", "")
			if class_src != "":
				if not os.path.isabs(class_src):
					class_src = os.path.join(diagram_dir, class_src)
				substituted_xml_class = ET.parse(class_src).getroot()
			else:
				substituted_xml_class = xml_class
			substituted_xml_class.is_default = (class_default.lower() == "true")
			name = substituted_xml_class.get("name", "")
			if name == "" :
				raise CompilerException("Missing or emtpy class name.")
			if name in self.class_names :
				raise CompilerException("Found 2 classes with the same name : " + name + ".")
			self.class_names.append(name)
			substituted_xml_classes.append(substituted_xml_class)
	
		# process in and output ports
		inports = self.root.findall("inport")
		names = []
		for xml_inport in inports :
			name = xml_inport.get("name", "")
			if name in names :
				raise CompilerException("Found 2 INPorts with the same name : " + name + ".")
			names.append(name)
		self.inports = names
		
		outports = self.root.findall("outport")
		names = []
		for xml_outport in outports :
			name = xml_outport.get("name", "")
			if name in names :
				raise CompilerException("Found 2 OUTPorts with the same name : " + name + ".")
			names.append(name)
		self.outports = names
			
		
		# any inital import code that has to come at the top of the generate file
		tops = self.root.findall("top")
		self.includes = []
		if len(tops) == 1 :
			self.top = tops[0].text
		elif len(tops) > 1 : 
			raise CompilerException("Class diagram can only have one <top> element.")
		else :
			self.top = ""
		
		# process each class in diagram
		self.classes = []
		default_classes = []
	
		for xml_class in substituted_xml_classes:
			processed_class = None
			try :
				processed_class = Class(xml_class, self)
			except CompilerException as e :
				e.message = "Class <" + xml_class.get("name", "") + "> failed compilation. " + e.message
				raise e
	
			# let user know this class was successfully loaded
			Logger.showInfo("Class <" + processed_class.name + "> has been successfully loaded.")
			self.classes.append(processed_class)
			if xml_class.is_default :
				default_classes.append(processed_class)
			
		if not default_classes or len(default_classes) > 1:
			if len(self.classes) == 1 :
				Logger.showInfo("Only one class given. Using <" + self.classes[0].getName() + "> as the default class.")
				default_classes.append(self.classes[0])
			else :
				raise CompilerException("Provide one and only one default class to instantiate on start up.")
		self.default_class = default_classes[0]

		# check if there's a test
		self.test = None
		test_nodes = self.root.findall("test")
		if test_nodes:
			test_node = test_nodes[0]

			input_nodes = test_node.findall("input")
			if input_nodes:
				input_node = input_nodes[0]
				test_input = DiagramTestInput(input_node)
			else:
				test_input = None

			expected_nodes = test_node.findall("expected")
			if expected_nodes:
				expected_node = expected_nodes[0]
				test_expected = DiagramTestExpected(expected_node)
			else:
				test_expected = None

			self.test = DiagramTest(test_input, test_expected)


class DiagramTest(Visitable):
	def __init__(self, i, expected):
		self.input = i
		self.expected = expected

class DiagramTestEvent(Visitable):
	def __init__(self, xml):
		self.name = xml.get("name")
		self.port = xml.get("port")
		self.parameters = []
		parameter_nodes = xml.findall("parameter")
		for parameter_node in parameter_nodes:
			val = parameter_node.get("value")
			expr = parameter_node.get("expr")
			if val:
				self.parameters.append(val) # expected events use 'val'
			elif expr:
				self.parameters.append(expr) # input events use 'expr'
			else:
				raise CompilerException("Parameter has no value/expr.")

class DiagramTestInputEvent(DiagramTestEvent):
	def __init__(self, xml):
		DiagramTestEvent.__init__(self, xml)
		self.time = xml.get("time")

class DiagramTestInput(Visitable):
	def __init__(self, xml):
		self.input_events = []
		event_nodes = xml.findall("event")
		for event_node in event_nodes:
			e = DiagramTestInputEvent(event_node)
			self.input_events.append(e)

class DiagramTestExpectedSlot(Visitable):
	def __init__(self, xml):
		self.expected_events = []
		event_nodes = xml.findall("event")
		for event_node in event_nodes:
			e = DiagramTestEvent(event_node)
			self.expected_events.append(e)

class DiagramTestExpected(Visitable):
	def __init__(self, xml):
		self.slots = []
		slot_nodes = xml.findall("slot")
		for slot_node in slot_nodes:
			s = DiagramTestExpectedSlot(slot_node)
			self.slots.append(s)

