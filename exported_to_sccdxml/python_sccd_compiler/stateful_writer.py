# Used by generic_generator to create an AST of generic language constructs
# while visiting an AST of SCCD constructs

from generic_language_constructs import *

class ExpressionWrapper(SimpleExpression, AbstractList):
	def __init__(self, expr = None):
		self.expr = expr

	def add(self, expr):
		if self.expr:
			raise Exception("Expression can only be set once.")
		self.expr = expr

	def get(self):
		return self.expr


class StatefulWriter:

	def __init__(self):
		self.ast = AST()
		self.last = None
		self.stack = [self.ast]

	def get(self):
		return self.stack[-1]

	def startRecordingExpression(self):
		self.stack.append(ExpressionWrapper())

	def stopRecordingExpression(self):
		self.last = self.stack.pop()
		if not isinstance(self.last, ExpressionWrapper):
			raise Exception("Assymetry detected.")
		return self.last.get()


	def add(self, block_entry):
		self.get().add(block_entry)

	#### SHORTHANDS ####

	def addActualParameter(self, expr):
		self.get().getActualParameters().add(expr)

	def addAssignment(self, lhs, rhs):
		self.add(AssignmentExpression(lhs, rhs))

	def addInclude(self, module_path, symbols = None):
		self.add(IncludeStatement(module_path, symbols))

	def addComment(self, comment):
		self.add(SingleLineComment(comment))

	def addFormalParameter(self, parameter, default_value = None):
		self.get().getFormalParameters().add(FormalParameter(parameter, default_value))

	def addMultiLineComment(self, comment):
		self.add(MultiLineComment(comment))

	def addRawCode(self, raw):
		self.add(RawCode(raw))

	def addStaticAttribute(self, identifier, init_value):
		self.add(StaticAttribute(self.get(), identifier, init_value))

	def addVSpace(self):
		self.add(VSpace())


	#### STATEFUL OPERATIONS ####

	def begin(self, generic_construct):
		self.add(generic_construct)
		self.stack.append(generic_construct)

	def beginArray(self):
		self.begin(ArrayExpression())

	def beginClass(self, class_name, super_class_names = None, comment = None):
		self.begin(Class(class_name, super_class_names, comment))

	def beginConstructor(self):
		c = self.get().getConstructor()
		self.stack.append(c)

	def beginDestructor(self):
		d = self.get().getDestructor()
		self.stack.append(d)

	def beginElse(self):
		self.begin(ElseStatement())

	def beginElseIf(self, condition):
		self.begin(ElseIfStatement(condition, not isinstance(self.last, ElseIfStatement)))

	def beginForLoopIterateArray(self, array_expr, iterator_identifier):
		f = ForLoopIterateArray(array_expr, iterator_identifier)
		self.get().add(f)
		self.stack.append(f.getBody())

	def beginForLoopIterateMapValues(self, map_expr, iterator_identifier):
		f = ForLoopIterateMapValues(map_expr, iterator_identifier)
		self.get().add(f)
		self.stack.append(f.getBody())

	def beginFunctionCall(self, function_expr):
		f = FunctionCall(function_expr)
		self.get().add(f)
		self.stack.append(f)

	def beginGlue(self):
		g = Glue()
		self.get().add(g)
		self.stack.append(g)

	def beginIf(self, condition):
		self.begin(IfStatement(condition))


	def beginMethod(self, name, comment = None):
		m = Method(self.get(), name, comment)
		self.get().add(m)
		self.stack.append(m)

	def beginMethodBody(self):
		b = self.get().getBody()
		self.stack.append(b)

	def beginPackage(self, package_name):
		p = Package(package_name)
		self.get().add(p)
		self.stack.append(p)

	def beginSuperClassConstructorCall(self, super_class_identifier):
		c = SuperClassConstructorCall(super_class_identifier)
		self.get().add(c)
		self.stack.append(c)

	def beginSuperClassDestructorCall(self, super_class_identifier):
		c = SuperClassDestructorCall(super_class_identifier)
		self.get().add(c)
		self.stack.append(c)

	def beginSuperClassMethodCall(self, super_class_identifier, method_identifier):
		c = SuperClassMethodCall(super_class_identifier, method_identifier)
		self.get().add(c)
		self.stack.append(c)


	def end(self):
		self.stack.pop()

	def endArray(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, ArrayExpression)

	def endClass(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, Class)

	def endConstructor(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, Constructor)

	def endDestructor(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, Destructor)

	def endElse(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, ElseStatement)

	def endElseIf(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, ElseIfStatement)

	def endForLoopIterateArray(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, ForLoopBody)

	def endForLoopIterateMapValues(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, ForLoopBody)

	def endFunctionCall(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, FunctionCall)

	def endGlue(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, Glue)

	def endIf(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, IfStatement)

	def endMethod(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, Method)

	def endMethodBody(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, MethodBody)

	def endPackage(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, Package)

	def endSuperClassConstructorCall(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, SuperClassConstructorCall)

	def endSuperClassDestructorCall(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, SuperClassDestructorCall)

	def endSuperClassMethodCall(self):
		self.last = self.stack.pop()
		assert isinstance(self.last, SuperClassMethodCall)

