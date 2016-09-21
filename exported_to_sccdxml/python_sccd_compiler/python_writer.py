from generic_language_constructs import *

class PythonWriter(GenericWriterBase):
	def __init__(self, outputter):
		self.out = outputter


	def writeComment(self, text):
		self.out.write("# " + text)

	def writeMultiLineComment(self, text):
		self.out.write("\"\"\"\n" + text + "\n\"\"\"")

	def visit_AndOperator(self, a):
		self.out.extendWrite(" and ")

	def visit_ArrayContains(self, a):
		array = a.getArrayExpression()
		el = a.getElementExpression()

		el.accept(self)
		self.out.extendWrite(" in ")
		array.accept(self)

	def visit_ArrayExpression(self, a):
		self.out.extendWrite("[")
		self.writeCommaSeparated(a.getElements())
		self.out.extendWrite("]")

	def visit_ArrayIndexOf(self, a):
		array = a.getArrayExpression()
		el = a.getElementExpression()

		array.accept(self)
		self.out.extendWrite(".index(")
		el.accept(self)
		self.out.extendWrite(")")

	def visit_ArrayLength(self, a):
		self.out.extendWrite("len(")
		a.getArrayExpression().accept(self)
		self.out.extendWrite(")")

	def visit_ArrayPushBack(self, a):
		array = a.getArrayExpression()
		el = a.getElementExpression()

		array.accept(self)
		self.out.extendWrite(".append(")
		el.accept(self)
		self.out.extendWrite(")")

	def visit_AST(self, ast):
		self.writeAll(ast.getEntries())

	def visit_Block(self, b):
		self.out.indent()
		self.writeAll(b.getEntries())
		if b.isEmpty():
			self.out.write("pass")
		self.out.dedent()

	def visit_BreakStatement(self, b):
		self.out.write("break")

	def visit_Class(self, c):
		class_name = c.getIdentifier()
		constructor = c.getConstructor()
		super_classes = c.getSuperClassIdentifierList()
		description = c.getDescription()

		self.out.write()
		if description:
			self.writeComment(description)
		self.out.write("class " + class_name)
		if super_classes:
			self.out.extendWrite("(" + ", ".join(super_classes) + ")")
		self.out.extendWrite(":")
		self.out.indent()
		constructor.accept(self)
		self.writeAll(c.getMembers())
		self.out.dedent()

	def visit_Constructor(self, constructor):
		#class_name = constructor.getClass().getIdentifier()
		parameters = constructor.getFormalParameters()
		body = constructor.getBody()

		self.out.write("def __init__")
		parameters.accept(self)
		self.out.extendWrite(":")
		body.accept(self)

	def visit_Destructor(self, destructor):
		#class_name = destructor.getClass().getIdentifier()
		parameters = destructor.getFormalParameters()
		body = destructor.getBody()

		self.out.write("def __del__")
		parameters.accept(self)
		self.out.extendWrite(":")
		body.accept(self)

	def visit_ElseStatement(self, else_stmt):
		self.out.write("else:")
		else_stmt.getBody().accept(self)

	def visit_ElseIfStatement(self, else_if):
		condition = else_if.getCondition()
		body = else_if.getBody()

		if else_if.isFirst():
			self.out.write("if ")
		else:
			self.out.write("elif ")
		condition.accept(self)
		self.out.extendWrite(":")
		body.accept(self)

	def visit_EqualsOperator(self, e):
		self.out.extendWrite(" == ")

	def visit_ExpressionStatement(self, stmt):
		self.out.write() # expressions don't begin with a newline
		stmt.expression.accept(self)

	def visit_FalseExpression(self, f):
		self.out.extendWrite("False")

	def visit_FormalParameter(self, parameter):
		self.out.extendWrite(parameter.getIdentifier())
		if parameter.getDefaultValue():
			self.out.extendWrite(" = None") # correct default value will be assigned in function body

	def visit_FormalParameters(self, p):
		params = [Literal("self")] + p.getParameterList()
		self.writeTuple(params)

	def visit_ForLoopCurrentElement(self, el):
		#collection = el.getCollectionExpression()
		iterator = el.getIteratorIdentifier()

		self.out.extendWrite(iterator)

	def visit_ForLoopIterateArray(self, loop):
		collection = loop.getCollectionExpression()
		iterator = loop.getIteratorIdentifier()
		body = loop.getBody()

		self.out.write("for " + iterator + " in ")
		collection.accept(self)
		self.out.extendWrite(":")
		body.accept(self)

	def visit_ForLoopIterateMapValues(self, loop):
		collection = loop.getCollectionExpression()
		iterator = loop.getIteratorIdentifier()
		body = loop.getBody()

		self.out.write("for " + iterator + " in ")
		collection.accept(self)
		self.out.extendWrite(".itervalues():")
		body.accept(self)

	def visit_IfStatement(self, if_stmt):
		condition = if_stmt.getCondition()
		body = if_stmt.getBody()

		self.out.write("if ")
		condition.accept(self)
		self.out.extendWrite(":")
		body.accept(self)

	def visit_IncludeStatement(self, i):
		module_path = i.getModulePath()
		imported_symbols = i.getImportedSymbols()

		self.out.write("from ")
		for j in range(len(module_path)):
			if j != 0:
				self.out.extendWrite(".")
			module_path[j].accept(self)
		self.out.extendWrite(" import ")
		if imported_symbols:
			self.writeCommaSeparated(imported_symbols)
		else:
			self.out.extendWrite("*")

	def visit_LocalVariableDeclaration(self, decl):
		identifier = decl.getIdentifier()
		init_value = decl.getInitValue()

		self.out.extendWrite(decl.getIdentifier())
		if init_value:
			self.out.extendWrite(" = ")
			init_value.accept(self)

	def visit_LogStatement(self, l):
		self.out.write("print \"" + l.getMessage() + "\"")

	def visit_MapExpression(self, m):
		elements = m.getElements()
		self.out.extendWrite("{")
		keys = elements.keys()
		for i in range(len(keys)):
			if i != 0:
				self.out.extendWrite(", ")			
			self.out.extendWrite(keys[i] + " : ")
			self.out.extendWrite(" : ")
			elements[keys[i]].accept(self)
		self.out.extendWrite("}")

	def visit_MapIndexedExpression(self, i):
		m = i.getMapExpression()
		key = i.getKeyExpression()

		m.accept(self)
		self.out.extendWrite("[")
		key.accept(self)
		self.out.extendWrite("]")

	def visit_MapRemoveElement(self, stmt):
		map_expr = stmt.getMapExpression()
		key_expr = stmt.getKeyExpression()

		self.out.write() # this is a statement, not an expression
		map_expr.accept(self)
		self.out.extendWrite(".pop(")
		key_expr.accept(self)
		self.out.extendWrite(", None)")

	def visit_Method(self, method):
		class_name = method.getClass().getIdentifier()
		method_name = method.getIdentifier()
		description = method.getDescription()
		body = method.getBody()
		parameters = method.getFormalParameters()

		self.out.write()
		if description:
			self.writeComment(description)
		self.out.write("def " + method_name + "")
		parameters.accept(self)
		self.out.extendWrite(":")
		body.accept(self)

	def visit_MethodBody(self, body):
		method = body.getMethod()
		formal_parameters = method.getFormalParameters()
		formal_parameter_list = formal_parameters.getParameterList()

		self.out.indent()
		# check for undefined parameters and replace them with default values
		for p in formal_parameter_list:
			p_id = p.getIdentifier()
			p_default = p.getDefaultValue()
			if p_default:
				self.out.write("if " + p_id + " == None: " + p_id + " = ")
				p_default.accept(self)
		self.writeAll(body.getEntries())
		if body.isEmpty():
			self.out.write("pass")
		self.out.dedent()

	def visit_NewExpression(self, new):
		type_expr = new.getTypeExpression()
		params = new.getActualParameters()

		type_expr.accept(self)
		params.accept(self)

	def visit_NoneExpression(self, n):
		self.out.extendWrite("None")

	def visit_NotOperator(self, n):
		self.out.extendWrite("not ")

	def visit_OrOperator(self, o):
		self.out.extendWrite(" or ")

	def visit_Package(self, package):
		name = package.getIdentifier()
		description = package.getDescription()

		self.writeComment("package \"" + name + "\"")
		if description:
			self.writeComment(description)
		self.writeAll(package.getDeclarations())

	def visit_ReturnStatement(self, r):
		self.out.write("return ")
		r.getExpression().accept(self)

	def visit_RuntimeModuleIdentifier(self, r):
		self.out.extendWrite("python_runtime")

	def visit_SelfExpression(self, s):
		self.out.extendWrite("self")

	def visit_StaticAttribute(self, attr):
		name = attr.getIdentifier()
		init_value = attr.getInitValue()
		#class_name = attr.getClass().getIdentifier()

		if init_value:
			self.out.write(name + " = ")
			init_value.accept(self)
		else:
			self.out.write(name + " = None")

	def visit_SuperClassConstructorCall(self, call):
		super_class = call.getSuperClassIdentifier()
		params = call.getActualParameters()
		param_list = [Literal("self")] + params.getParameterList()
		params = ActualParameters(param_list)

		self.out.extendWrite(super_class)
		self.out.extendWrite(".__init__")
		params.accept(self)

	def visit_SuperClassDestructorCall(self, call):
		super_class = call.getSuperClassIdentifier()
		params = call.getActualParameters()
		param_list = [Literal("self")] + params.getParameterList()
		params = ActualParameters(param_list)

		self.out.extendWrite("if hasattr(")
		self.out.extendWrite(super_class)
		self.out.extendWrite(", \"__del__\"):")
		self.out.indent()
		self.out.write(super_class)
		self.out.extendWrite(".__del__")
		params.accept(self)
		self.out.dedent()

	def visit_SuperClassMethodCall(self, call):
		super_class = call.getSuperClassIdentifier()
		method_name = call.getMethodIdentifier()
		params = call.getActualParameters()
		param_list = [Literal("self")] + params.getParameterList()
		params = ActualParameters(param_list)

		self.out.extendWrite(super_class + "." + method_name)
		params.accept(self)

	def visit_ThrowExceptionStatement(self, stmt):
		self.out.write("raise Exception(")
		stmt.getExpression().accept(self)
		self.out.extendWrite(")")

	def visit_TrueExpression(self, t):
		self.out.extendWrite("True")

