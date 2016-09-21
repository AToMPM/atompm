import time
from constructs import FormalParameter
from code_generation import CodeGenerator, Platforms

class JavascriptGenerator(CodeGenerator):
	
	def __init__(self):
		self.supported_platforms = [Platforms.Threads, Platforms.GameLoop]
				
	def visit_ClassDiagram(self, class_diagram):
		# header
		self.fOut.write("/**");
		self.fOut.write(" * Statechart compiler by Glenn De Jonghe")
		self.fOut.write(" * Javascript generator by Joeri Exelmans")
		self.fOut.write(" * ")
		self.fOut.write(" * Date:   " + time.asctime())
		if class_diagram.name or class_diagram.author or class_diagram.description:
			self.fOut.write(" * ")
		if class_diagram.author:
			self.fOut.write(" * Model author: " + class_diagram.author)
		if class_diagram.name:
			self.fOut.write(" * Model name:   " + class_diagram.name)
		if class_diagram.description.strip():
			self.fOut.write(" * Model description:")
			self.fOut.indent()
			self.fOut.write(class_diagram.description.strip())
			self.fOut.dedent()
		self.fOut.write(" */")
		
		self.fOut.write()

		self.fOut.write("// put everything in an object (serves as \"namespace\")")
		self.fOut.write(class_diagram.name + " = {};")
		self.fOut.write()
		self.fOut.write("// closure scope")
		self.fOut.write("(function() {")
		self.fOut.write()
		
		#visit children
		for c in class_diagram.classes :
			c.accept(self)
			self.fOut.write("// put class in global diagram object")
			self.fOut.write(class_diagram.name + '.' + c.name + ' = ' + c.name + ';')
			self.fOut.write()
		 
		#writing out ObjectManager
		self.fOut.write('var ObjectManager = function(controller) {')
		self.fOut.indent()
		self.fOut.write("ObjectManagerBase.call(this, controller);")
		self.fOut.dedent()
		self.fOut.write("};")
		self.fOut.write()

		self.fOut.write("ObjectManager.prototype = new ObjectManagerBase();")
		self.fOut.write()
		
		self.fOut.write('ObjectManager.prototype.instantiate = function(class_name, construct_params) {')
		self.fOut.indent()
		for index, c in enumerate(class_diagram.classes) :
			if index == 0 : 
				self.fOut.write()
			else :
				self.fOut.extendWrite(' else ')
			self.fOut.extendWrite('if (class_name === "' + c.name + '") {')
			self.fOut.indent()
			if c.statechart :
				self.fOut.write('var instance = new ' + c.name + '(this.controller')
				param_count = 0
				for p in c.constructors[0].parameters:
					self.fOut.extendWrite(', construct_params[' + str(param_count) + ']')
					param_count += 1
				self.fOut.extendWrite(');')
			else :
				self.fOut.write('var instance = new ' + c.name + '(')
				param_count = 0
				for p in c.constructors[0].parameters:
					if (param_count != 0):
						self.fOut.extendWrite(', ')
					self.fOut.extendWrite('construct_params[' + str(param_count) + ']')
					param_count += 1
				self.fOut.extendWrite(');');
			self.fOut.write('instance.associations = new Object();')
			for a in c.associations :
				a.accept(self)
			self.fOut.dedent()
			self.fOut.write('}')
		self.fOut.write('return instance;')
		self.fOut.dedent()
		self.fOut.write("};")

		self.fOut.write()
		self.fOut.write("// put in global diagram object")
		self.fOut.write(class_diagram.name + '.ObjectManager = ObjectManager;')

		self.fOut.write()
		if self.platform == Platforms.Threads :
			controller_sub_class = "JsEventLoopControllerBase"
		elif self.platform == Platforms.GameLoop :
			controller_sub_class = "GameLoopControllerBase"

		# write out __init__ method
		if class_diagram.default_class.constructors :
			self.writeControllerConstructor(class_diagram, controller_sub_class, class_diagram.default_class.constructors[0].parameters)
		else :
			self.writeControllerConstructor(class_diagram, controller_sub_class)

		self.fOut.write("Controller.prototype = new " + controller_sub_class + "();")
		self.fOut.write()
		self.fOut.write("// put in global diagram object")
		self.fOut.write(class_diagram.name + '.Controller = Controller;')
		self.fOut.write()
		self.fOut.write("})();")
		self.fOut.write()

	#helper method
	def writeControllerConstructor(self, class_diagram, controller_sub_class, parameters = []):
		self.writeConstructorSignature("Controller", parameters + [FormalParameter("keep_running", "", "true"), FormalParameter("finished_callback", "", None)])
		self.fOut.indent()
		self.fOut.write(controller_sub_class + ".call(this, new ObjectManager(this), keep_running, finished_callback);")
		for i in class_diagram.inports:
			self.fOut.write('this.addInputPort("' + i + '");')
		for i in class_diagram.outports:
			self.fOut.write('this.addOutputPort("' + i + '");')
		actual_parameters = [p.getIdent() for p in parameters]
		self.fOut.write('this.object_manager.createInstance("'+ class_diagram.default_class.name +'", [' +  ', '.join(actual_parameters)+ ']);')
		self.fOut.dedent()
		self.fOut.write('};')
		self.fOut.write()

	def visit_Class(self, class_node):
		"""
		Generate code for Class construct
		"""

		if class_node.super_classes:
			super_classes = []
			for super_class in class_node.super_classes:
				super_classes.append(super_class)
		else:
			super_classes = ["RuntimeClassBase"]

		#visit children
		for i in class_node.constructors :
			i.accept(self)

		self.fOut.write()
		self.fOut.write(class_node.name + ".prototype = new " + super_classes[0] + "();")
		self.fOut.write()

		if class_node.statechart is not None:
			# assign each node a unique ID
			self.fOut.write("// Unique IDs for all statechart nodes")
			for (i,node) in enumerate(class_node.statechart.composites + class_node.statechart.basics):
				self.fOut.write(class_node.name + ".prototype." + node.full_name + " = " + str(i) + ";")
			self.fOut.write()

		#visit children
		for i in class_node.destructors :
			i.accept(self)
		for i in class_node.methods :
			i.accept(self)
		if class_node.statechart is not None:
			class_node.statechart.accept(self)

		self.writeMethodSignature(class_node.name, "user_defined_constructor", class_node.constructors[0].getParams())

		self.fOut.indent()

		for super_class in class_node.super_classes:
			self.fOut.write(super_class + ".prototype.user_defined_constructor.call(this")
			for p in class_node.constructors[0].super_class_parameters[super_class]:
				self.fOut.extendWrite(", " + p)
			self.fOut.extendWrite(");")


		self.writeCodeCorrectIndent(class_node.constructors[0].body)
		
		self.fOut.dedent()
		self.fOut.write("};")
		self.fOut.write()
		
		self.writeMethodSignature(class_node.name, "start")
		self.fOut.indent()
		self.fOut.write(super_classes[0] + ".prototype.start.call(this);")
		for default_node in class_node.statechart.root.defaults:
			if default_node.is_composite:
				self.fOut.write("this.enterDefault_" + default_node.full_name + "();")
			elif default_node.is_basic:
				self.fOut.write("this.enter_" + default_node.full_name + "();")
		self.fOut.dedent()
		self.fOut.write("};")
		self.fOut.write()

	#helper method
	def writeConstructorSignature(self, prototype_name, parameters = []):
		self.fOut.write("var " + prototype_name + " = function(")		   
		for param in parameters :
			if parameters.index(param) != 0:
				self.fOut.extendWrite(', ')
			param.accept(self)
		self.fOut.extendWrite(") {")
		self.fOut.indent()
		for param in parameters :
			if param.hasDefault() :
				self.fOut.write("if (" + param.getIdent() + " === undefined) " +
					param.getIdent() + " = " + param.getDefault() + ";")
		self.fOut.dedent()

	#helper method
	def writeMethodSignature(self, prototype_name, method_name, parameters = []):
		self.fOut.write(prototype_name + ".prototype." + method_name + " = function(")
		for param in parameters :
			if parameters.index(param) != 0 :
				self.fOut.extendWrite(', ')
			param.accept(self)
		self.fOut.extendWrite(") {")
		self.fOut.indent()
		for param in parameters :
			if param.hasDefault() :
				self.fOut.write("if (!" + param.getIdent() + ") " +
					param.getIdent() + " = " + param.getDefault() + ";")
		self.fOut.dedent()
		
	#helper method
	def writeMethod(self, prototype_name, name, parameters, return_type, body):
		self.writeMethodSignature(prototype_name, name, parameters)
		self.fOut.indent()
		if body.strip():
			self.writeCodeCorrectIndent(body)
		self.fOut.write()
		self.fOut.dedent()
		self.fOut.write("};");
		
	def visit_FormalParameter(self, formal_parameter):
		self.fOut.extendWrite(formal_parameter.getIdent())
		
	def visit_Constructor(self, constructor):
		self.fOut.write("// Constructor")
		parameters =  [FormalParameter("controller", "", None)] + constructor.getParams()
		self.writeConstructorSignature(constructor.parent_class.name, parameters)
		self.fOut.indent()

		if constructor.parent_class.super_classes:
			self.fOut.write(constructor.parent_class.super_classes[0] + ".call(this);")
		else:
			self.fOut.write("RuntimeClassBase.call(this);")

		self.fOut.write()
		self.fOut.write("if (controller) {")
		self.fOut.indent()

		#visit input, output ports
		self.fOut.write("// User defined input ports")
		self.fOut.write("this.inports = new Object();")
		for p in constructor.parent_class.inports:
			self.fOut.write("this.inports[\""+p+"\"] = controller.addInputPort(\""+p+"\", this);")

		#for p in class_node.outports:

		# write attributes
		if constructor.parent_class.attributes:
			self.fOut.write()
			self.fOut.write("// User defined attributes")
			for attribute in constructor.parent_class.attributes:
				if attribute.init_value is None :
					self.fOut.write("this." +  attribute.name + " = null;")
				else :
					self.fOut.write("this." +  attribute.name + " = " + attribute.init_value + ";")
			self.fOut.write()

		# if there is a statechart
		if constructor.parent_class.statechart is not None:			
			self.fOut.write("this.controller = controller;")
			self.fOut.write("this.object_manager = controller.object_manager;")
			self.fOut.write("this.current_state = new Object();")
			self.fOut.write("this.history_state = new Object();")
			if constructor.parent_class.statechart.nr_of_after_transitions:
				self.fOut.write("this.timers = new Object();")
			self.fOut.write()
			self.fOut.write("// Initialize statechart")
			
			if constructor.parent_class.statechart.histories:
				for node in constructor.parent_class.statechart.combined_history_parents:
					self.fOut.write("this.history_state[" + constructor.parent_class.name + "." + node.full_name + "] = new Array();")
				self.fOut.write()

			for c in constructor.parent_class.statechart.composites :
				self.fOut.write("this.current_state[this." + c.full_name + "] = new Array();")

		self.fOut.write()
		self.fOut.write("// Call user defined constructor")
		self.fOut.write(constructor.parent_class.name + ".prototype.user_defined_constructor.call(this")
		for p in constructor.getParams():
			self.fOut.extendWrite(", ")
			p.accept(self)
		self.fOut.extendWrite(");")


		self.fOut.dedent()
		self.fOut.write("}")
		self.fOut.dedent()
		self.fOut.write("};")
		self.fOut.write()

	def visit_Destructor(self, destructor):
		self.fOut.write("// User defined destructor")

		self.writeMethodSignature(destructor.parent_class.name, "user_defined_destructor", [])
		self.fOut.indent()
		if destructor.body.strip():
			self.writeCodeCorrectIndent(destructor.body)

		if destructor.parent_class.super_classes:
			self.fOut.write()
			self.fOut.write("// Call super class destructors")
			for super_class in destructor.parent_class.super_classes:
				self.fOut.write(super_class + ".prototype.user_defined_destructor.call(this);")

		self.fOut.dedent()
		self.fOut.write("};");
		self.fOut.write()
		
	def visit_Method(self, method):
		self.fOut.write("// User defined method")
		self.writeMethod(method.parent_class.name, method.name, method.parameters, method.return_type, method.body)
		
	def visit_Association(self, association):
		self.fOut.write('instance.associations["' + association.name + '"] = new Association("' + association.to_class + '", ' + str(association.min) + ', ' + str(association.max) + ');')
		
	#helper method
	def writeTransitionsRecursively(self, current_node):

		self.writeMethodSignature(current_node.statechart.class_obj.name, "transition_" + current_node.full_name, [FormalParameter("event", "event")])
		self.fOut.indent()
		
		valid_children = []
		for child in current_node.children :
			if child.is_composite or child.is_basic :
				valid_children.append(child)  
		 
		self.fOut.write("var catched = false;")
		do_dedent = False
		if current_node.solves_conflict_outer :
			self.writeFromTransitions(current_node)
			if current_node.is_parallel_state or current_node.is_composite :
				self.fOut.write("if (!catched) {")
				self.fOut.indent()
				do_dedent = True
			
		if current_node.is_parallel_state:
			for child in valid_children :	 
				self.fOut.write("catched = this.transition_" + child.full_name + "(event) || catched")
		elif current_node.is_composite:
			for i, child in enumerate(valid_children) :
				if i > 0 :
					self.fOut.write("else ")
				else :
					self.fOut.write()
				self.fOut.extendWrite("if (this.current_state[this." + current_node.full_name + "][0] === this." + child.full_name + ") {")
				self.fOut.indent()
				self.fOut.write("catched = this.transition_" + child.full_name + "(event);")
				self.fOut.dedent()
				self.fOut.write("}")
				
		if current_node.solves_conflict_outer :
			if do_dedent :
				self.fOut.dedent()
				self.fOut.write("}")
		elif len(current_node.transitions) > 0 :
				self.fOut.write("if (!catched) {")
				self.fOut.indent()
				self.writeFromTransitions(current_node)
				self.fOut.dedent()
				self.fOut.write("}");
			
		self.fOut.write("return catched;")
		self.fOut.dedent()
		self.fOut.write("};");
		self.fOut.write();
		
		for child in valid_children :
			self.writeTransitionsRecursively(child)
				
	#helper method
	def writeFromTransitions(self, current_node): 
		# get all transition out of this state
		out_transitions = current_node.transitions
		if len(out_transitions) == 0 :
			return
		
		self.fOut.write('var enableds = new Array();')
		for index, transition in enumerate(out_transitions, start=1):
			self.writeTransitionCondition(transition, index)
			
		self.fOut.write("if (enableds.length > 1) {")
		self.fOut.indent()
		self.fOut.write('console.log("Runtime warning : indeterminism detected in a transition from node ' +  current_node.full_name+ '. Only the first in document order enabled transition is executed.")')
		self.fOut.dedent()
		self.fOut.write("}")
		self.fOut.write()
		self.fOut.write("if (enableds.length > 0) {")
		self.fOut.indent()
		self.fOut.write('var enabled = enableds[0];')	  
			  
		for index, transition in enumerate(out_transitions, start=1):
			self.writeTransitionAction(transition, index)
		
		self.fOut.write('catched = true;')   
		self.fOut.dedent()
		self.fOut.write("}")
		self.fOut.write()
		
	def visit_FormalEventParameter(self, formal_event_parameter):
		self.fOut.extendWrite(formal_event_parameter.name)
		
	def writeFormalEventParameters(self, transition):
		parameters = transition.getTrigger().getParameters()
		if(len(parameters) > 0) :
			self.fOut.write('var parameters = event.parameters;')
			for index, parameter in enumerate(parameters):
				self.fOut.write()
				self.fOut.write("var ")
				parameter.accept(self)
				self.fOut.extendWrite(' = parameters[' + str(index) + '];')
		
		
	def writeTransitionAction(self, transition, index):
		if index > 1 :
			self.fOut.write("else ")
		else :
			self.fOut.write()
		self.fOut.extendWrite("if (enabled === " + str(index) + ") {")
		self.fOut.indent()

		# handle parameters to actually use them			 
		self.writeFormalEventParameters(transition)
		
		exits = transition.getExitNodes()
		
		# write out exit actions
		if not exits[-1].is_basic:
			self.fOut.write("this.exit_" + exits[-1].full_name + "();")
		else:
			for node in exits:
				if node.is_basic:
					self.fOut.write("this.exit_" + node.full_name + "();")
					
		# write out trigger actions
		transition.getAction().accept(self)
		
		for (entering_node, is_ending_node) in transition.getEnterNodes() : 
			if is_ending_node :
				if entering_node.is_composite:
					self.fOut.write("this.enterDefault_" + entering_node.full_name + "();")
				elif entering_node.is_history:
					if (entering_node.is_history_deep) :
						self.fOut.write("this.enterHistoryDeep_" + entering_node.parent.full_name + "();")
					else :
						self.fOut.write("this.enterHistoryShallow_" + entering_node.parent.full_name + "();")
				else:
					self.fOut.write("this.enter_" + entering_node.full_name + "();")
			else :
				if entering_node.is_composite:
					self.fOut.write("this.enter_" + entering_node.full_name + "();")

		self.fOut.dedent()
		self.fOut.write("}")
						
	def writeTransitionCondition(self, transition, index):
		trigger = transition.getTrigger()
		if not trigger.isUC():  
			self.fOut.write('if (event.name === "' + trigger.getEvent() + '"' + ((' && event.port === "' + trigger.getPort()+'"') if trigger.getPort() != "" else '') + ') {')
			self.fOut.indent()   
		# evaluate guard
		if transition.hasGuard() :   
			# handle parameters for guard evaluation	   
			self.writeFormalEventParameters(transition)

			self.fOut.write('if (')
			transition.getGuard().accept(self)
			self.fOut.extendWrite(') {')
			self.fOut.indent()	
			
		self.fOut.write("enableds.push(" + str(index) + ");")

		if transition.hasGuard() :
			self.fOut.dedent()
			self.fOut.write("}")
		if not trigger.isUC() :
			self.fOut.dedent()
			self.fOut.write("}")
		self.fOut.write()
	
	def visit_EnterAction(self, enter_method):
		parent_node = enter_method.parent_node
		self.writeMethodSignature(parent_node.statechart.class_obj.name, "enter_" + parent_node.full_name, [])
		self.fOut.indent()
		# take care of any AFTER events
		for transition in parent_node.transitions :
			trigger = transition.getTrigger()
			if trigger.isAfter() :
				self.fOut.write("this.timers[" + str(trigger.getAfterIndex()) + "] = ")
				trigger.after.accept(self)
				self.fOut.extendWrite(" * 1000.0; /* convert ms to s */")
		if enter_method.action:
			enter_method.action.accept(self)
		self.fOut.write("this.current_state[this." + parent_node.parent.full_name + "].push(this." + parent_node.full_name + ");")
		self.fOut.dedent()
		self.fOut.write("};")
		self.fOut.write()
		
	#helper method
	def writeEnterDefault(self, entered_node):
		self.writeMethodSignature(entered_node.statechart.class_obj.name, "enterDefault_" + entered_node.full_name, [])
		self.fOut.indent()
		self.fOut.write("this.enter_" + entered_node.full_name + "();")
		if entered_node.is_composite:
			l = entered_node.defaults
			for i in l:
				if i.is_composite:
					self.fOut.write("this.enterDefault_" + i.full_name + "();")
				elif i.is_basic:
					self.fOut.write("this.enter_" + i.full_name + "();")
		self.fOut.dedent()
		self.fOut.write("};")
		self.fOut.write()
		 
	def visit_ExitAction(self, exit_method):
		exited_node = exit_method.parent_node
		self.writeMethodSignature(exited_node.statechart.class_obj.name, "exit_" + exited_node.full_name, [])
		self.fOut.indent()
		
		#If the exited node is composite take care of potential history and the leaving of descendants
		if exited_node.is_composite :
			#handle history
			if exited_node.save_state_on_exit :
				self.fOut.write("this.history_state[this." + exited_node.full_name + "] = this.current_state[this." + exited_node.full_name + "];")
			
			#Take care of leaving children
			children = exited_node.children
			if exited_node.is_parallel_state:
				for child in children:
					if not child.is_history :
						self.fOut.write("this.exit_" + child.full_name + "();")
			else:
				for child in children:
					if not child.is_history :
						self.fOut.write("if (this.current_state[this." + exited_node.full_name + "].indexOf(this." + child.full_name +  ") !== -1) {")
						self.fOut.indent()
						self.fOut.write("this.exit_" + child.full_name + "();")
						self.fOut.dedent()
						self.fOut.write("}")
		
		
		# take care of any AFTER events
		for transition in exited_node.transitions :
			trigger = transition.getTrigger()
			if trigger.isAfter() :
				self.fOut.write("delete this.timers[" + str(trigger.getAfterIndex()) + "];")
				
		#Execute user-defined exit action if present
		if exit_method.action:
			exit_method.action.accept(self)
			
		#Adjust state
		self.fOut.write("this.current_state[this." + exited_node.parent.full_name + "] = new Array();") # SPECIAL CASE FOR ORTHOGONAL??
		
		self.fOut.dedent()
		self.fOut.write("};")
		self.fOut.write()
		
			
	#helper method
	def writeEnterHistory(self, entered_node, is_deep):
		self.writeMethodSignature(entered_node.statechart.class_obj.name, "enterHistory" + ("Deep" if is_deep else "Shallow") + "_" + entered_node.full_name, [])
		self.fOut.indent()
		self.fOut.write("if (this.history_state[this." + entered_node.full_name + "].length === 0) {")
		self.fOut.indent()
		defaults = entered_node.defaults

		for node in defaults:
			if node.is_basic :
				self.fOut.write("this.enter_" + node.full_name + "();")
			elif node.is_composite :
				self.fOut.write("this.enterDefault_" + node.full_name + "();")

		self.fOut.dedent()
		self.fOut.write("} else {")
		self.fOut.indent()
		children = entered_node.children
		if entered_node.is_parallel_state:
			for child in children:
				if not child.is_history :
					self.fOut.write("this.enterHistory" + ("Deep" if is_deep else "Shallow") + "_" + child.full_name + "();")
		else:
			for child in children:
				if not child.is_history :
					self.fOut.write("if (this.history_state[this." + entered_node.full_name + "].indexOf(this." + child.full_name + ") !== -1) {")
					self.fOut.indent()
					if child.is_composite:
						if is_deep :
							self.fOut.write("this.enter_" + child.full_name + "()")
							self.fOut.write("this.enterHistoryDeep_" + child.full_name + "()")
						else :
							self.fOut.write("this.enterDefault_" + child.full_name + "()")
					else:
						self.fOut.write("this.enter_" + child.full_name + "()")
					self.fOut.dedent()
					self.fOut.write("}")
		self.fOut.dedent()
		self.fOut.write("}")
		self.fOut.dedent()
		self.fOut.write("};")
		self.fOut.write()

	def visit_StateChart(self, statechart):
		self.fOut.write("// Statechart enter/exit action method(s) :")
		self.fOut.write()
		
		#visit enter and exit action of children
		for i in statechart.composites + statechart.basics:
			if i is not statechart.root :
				i.enter_action.accept(self)
				i.exit_action.accept(self)

		# write out statecharts methods for enter/exit state
		if len(statechart.composites) > 1 :
			self.fOut.write("// Statechart enter/exit default method(s) :")
			self.fOut.write()
			for i in statechart.composites :
				if i is not statechart.root :
					self.writeEnterDefault(i)

		# write out statecharts methods for enter/exit history
		if statechart.histories:
			self.fOut.write("// Statechart enter/exit history method(s) :")
			self.fOut.write()
			for i in statechart.shallow_history_parents:
				self.writeEnterHistory(i, False)
			for i in statechart.deep_history_parents:
				self.writeEnterHistory(i, True) 
		   
		   
		self.fOut.write("// Statechart transitions :")	 
		self.fOut.write()
		self.writeTransitionsRecursively(statechart.root)			
				
		# write out transition function
		self.fOut.write("// Execute transitions")
		self.writeMethodSignature(statechart.class_obj.name, "transition", [FormalParameter("event", "Event", "new Event()")])
		self.fOut.indent()
		self.fOut.write("this.state_changed = this.transition_" + statechart.root.full_name + "(event);")
		self.fOut.dedent()
		self.fOut.write("};");
		self.fOut.write()

		# write out inState function
		self.fOut.write("// inState method for statechart")
		self.writeMethodSignature(statechart.class_obj.name, "inState", [FormalParameter("nodes", "Array")])
		#self.fOut.write("def inState(self, nodes):")
		self.fOut.indent()
		self.fOut.write("for (var c in this.current_state) {")
		self.fOut.indent()
		self.fOut.write("if (!this.current_state.hasOwnProperty(c)) continue;")

		self.fOut.write("var new_nodes = new Array();")
		self.fOut.write("for (var n in nodes) {")
		self.fOut.indent()
		self.fOut.write("if (!nodes.hasOwnProperty(n)) continue;")
		self.fOut.write("if (this.current_state[c].indexOf(nodes[n]) === -1) {")
		self.fOut.indent()
		self.fOut.write("new_nodes.push(nodes[n]);")
		self.fOut.dedent()
		self.fOut.write("}")
		self.fOut.dedent()
		self.fOut.write("}")
		self.fOut.write("nodes = new_nodes;")
		self.fOut.write("if (nodes.length === 0) {")
		self.fOut.indent()
		self.fOut.write("return true;")
		self.fOut.dedent()

		self.fOut.write("}")
		self.fOut.dedent()
		self.fOut.write("}")
		self.fOut.write("return false;")
		self.fOut.dedent()
		self.fOut.write("};")
		self.fOut.write()

	def visit_ExpressionPartString(self, bare_string):
		self.fOut.extendWrite(bare_string.string)
		
	def visit_SelfReference(self, self_reference):
		self.fOut.extendWrite("this")
		
	def visit_StateReference(self, state_ref):
		self.fOut.extendWrite("[" + ",".join(["this." + node.full_name for node in state_ref.getNodes()]) + "]")
		
	def visit_InStateCall(self, in_state_call):
		self.fOut.extendWrite("this.inState(")
		in_state_call.target.accept(self)
		self.fOut.extendWrite(")")
		
	def visit_RaiseEvent(self, raise_event):
		if raise_event.isNarrow() or raise_event.isBroad():
			self.fOut.write('var send_event = new Event("' + raise_event.getEventName() + '", null, [')
		elif raise_event.isLocal():
			self.fOut.write('this.addEvent(new Event("' + raise_event.getEventName() + '", null, [')
		elif raise_event.isOutput():
			self.fOut.write('this.controller.outputEvent(new Event("' + raise_event.getEventName() + '", "' + raise_event.getPort() + '", [')
		elif raise_event.isCD():
			self.fOut.write('this.object_manager.addEvent(new Event("' + raise_event.getEventName() + '", null, [this, ')
		first_param = True
		for param in raise_event.getParameters() :
			if first_param :
				first_param = False
			else :
				self.fOut.extendWrite(',')
			param.accept(self)
		if raise_event.isNarrow():
			self.fOut.extendWrite(']);')
			self.fOut.write('this.object_manager.addEvent(new Event("narrow_cast", null, [this, ' + raise_event.getTarget() + ' , send_event]));')
		elif raise_event.isBroad():
			self.fOut.extendWrite(']);')
			self.fOut.write('this.object_manager.addEvent(new Event("broad_cast", null, [send_event]));')
		else :
			self.fOut.extendWrite(']));')
			
	def visit_Script(self, script):
		self.writeCodeCorrectIndent(script.code)
		
	def visit_Log(self, log):
		self.fOut.write('console.log("' + log.message + '");')
		
	def visit_Assign(self, assign):
		self.fOut.write()
		assign.lvalue.accept(self)
		self.fOut.extendWrite(" = ")
		assign.expression.accept(self)
	
