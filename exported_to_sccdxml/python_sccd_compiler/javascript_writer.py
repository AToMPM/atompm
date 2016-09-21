from visitor import Visitor
from generic_language_constructs import *

class JavascriptWriter(CLikeWriterBase):
	def __init__(self, outputter):
		self.out = outputter

	### VISIT METHODS ###

	def visit_ArrayContains(self, a):
		array = a.getArrayExpression()
		el = a.getElementExpression()

		self.out.extendWrite("(")
		array.accept(self)
		self.out.extendWrite(".indexOf(")
		el.accept(self)
		self.out.extendWrite(") !== -1)")

	def visit_ArrayExpression(self, a):
		elements = a.getElements()
		if len(elements) == 0:
			self.out.extendWrite("new Array()")
		else:
			self.out.extendWrite("[")
			self.writeCommaSeparated(elements)
			self.out.extendWrite("]")

	def visit_ArrayIndexOf(self, a):
		array = a.getArrayExpression()
		el = a.getElementExpression()

		array.accept(self)
		self.out.extendWrite(".indexOf(")
		el.accept(self)
		self.out.extendWrite(")")

	def visit_ArrayLength(self, a):
		a.getArrayExpression().accept(self)
		self.out.extendWrite(".length")

	def visit_ArrayPushBack(self, a):
		array = a.getArrayExpression()
		el = a.getElementExpression()

		array.accept(self)
		self.out.extendWrite(".push(")
		el.accept(self)
		self.out.extendWrite(")")

	def visit_AST(self, ast):
		self.writeAll(ast.getEntries())

	def visit_Class(self, c):
		class_name = c.getIdentifier()
		constructor = c.getConstructor()
		super_classes = c.getSuperClassIdentifierList()
		description = c.getDescription()

		self.out.write()
		if description:
			self.writeComment(description)
		constructor.accept(self)
		if super_classes:
			self.out.write(class_name + ".prototype = new Object();")
			self.out.write("(function() {")
			self.out.indent()
			for s in super_classes:
				# workaround for multiple inheritance
				self.out.write("var proto = new " + s + "();")
				self.out.write("for (prop in proto) {")
				self.out.indent()
				self.out.write(class_name + ".prototype[prop] = proto[prop];")
				self.out.dedent()
				self.out.write("}")
			self.out.dedent()
			self.out.write("})();")
		self.writeAll(c.getMembers())

	def visit_Constructor(self, constructor):
		class_name = constructor.getClass().getIdentifier()
		parameters = constructor.getFormalParameters()
		body = constructor.getBody()

		self.out.write("var " + class_name + " = function")
		parameters.accept(self)
		body.accept(self)
		self.out.extendWrite(";")

	def visit_EqualsOperator(self, e):
		self.out.extendWrite(" === ")

	def visit_ForLoopBody(self, body):
		for_loop = body.getForLoop()
		collection_expr = for_loop.getCollectionExpression()
		iterator_identifier = for_loop.getIteratorIdentifier()

		self.out.extendWrite(" {")
		self.out.indent()
		self.out.write("if (!")
		collection_expr.accept(self)
		self.out.extendWrite(".hasOwnProperty(" + iterator_identifier + ")) continue;")
		self.writeAll(body.getEntries())
		self.out.dedent()
		self.out.write("}")

	def visit_ForLoopCurrentElement(self, el):
		collection = el.getCollectionExpression()
		iterator = el.getIteratorIdentifier()

		collection.accept(self)
		self.out.extendWrite("["+iterator+"]")

	def visit_ForLoopIterateArray(self, loop):
		collection = loop.getCollectionExpression()
		iterator = loop.getIteratorIdentifier()
		body = loop.getBody()

		self.out.write("for (var " + iterator + " in ")
		collection.accept(self)
		self.out.extendWrite(")")
		body.accept(self)

	def visit_ForLoopIterateMapValues(self, loop):
		collection = loop.getCollectionExpression()
		iterator = loop.getIteratorIdentifier()
		body = loop.getBody()

		self.out.write("for (var " + iterator + " in ")
		collection.accept(self)
		self.out.extendWrite(")")
		body.accept(self)

	def visit_FormalParameter(self, parameter):
		self.out.extendWrite(parameter.getIdentifier())

	def visit_IncludeStatement(self, i):
		pass # javascript doesn't have an include mechanism

	def visit_LocalVariableDeclaration(self, decl):
		identifier = decl.getIdentifier()
		init_value = decl.getInitValue()

		self.out.extendWrite("var " + identifier)
		if init_value:
			self.out.extendWrite(" = ")
			init_value.accept(self)

	def visit_LogStatement(self, l):
		self.out.write("console.log(\"" + l.getMessage() + "\");")

	def visit_MapExpression(self, m):
		elements = m.getElements()
		if len(elements) == 0:
			self.out.extendWrite("new Object()")
		else:
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

		self.out.write("delete ") # this is a statement, not an expression
		map_expr.accept(self)
		self.out.extendWrite("[")
		key_expr.accept(self)
		self.out.extendWrite("];")		

	def visit_Method(self, method):
		class_name = method.getClass().getIdentifier()
		method_name = method.getIdentifier()
		description = method.getDescription()
		body = method.getBody()
		parameters = method.getFormalParameters()

		self.out.write()
		if description:
			self.writeComment(description)
		self.writeDescription(method)
		self.out.write(class_name + ".prototype." + method_name + " = function")
		parameters.accept(self)
		body.accept(self)
		self.out.extendWrite(";")

	def visit_MethodBody(self, body):
		method = body.getMethod()
		formal_parameters = method.getFormalParameters()
		formal_parameter_list = formal_parameters.getParameterList()

		self.out.extendWrite(" {")
		self.out.indent()
		# check for undefined parameters and replace them with default values
		for p in formal_parameter_list:
			p_id = p.getIdentifier()
			p_default = p.getDefaultValue()
			if p_default:
				self.out.write("if (" + p_id + " === undefined) " + p_id + " = ")
				p_default.accept(self)
				self.out.extendWrite(";")
		self.writeAll(body.getEntries())
		self.out.dedent()
		self.out.write("}")

	def visit_NoneExpression(self, n):
		self.out.extendWrite("null")

	def visit_Package(self, package):
		name = package.getIdentifier()
		description = package.getDescription()

		self.writeComment("package \"" + name + "\"")
		if description:
			self.writeComment(description)
		self.out.write("var " + name + " = {};")
		self.out.write("(function() {")
		for d in package.getDeclarations():
			d_id = d.getIdentifier()
			d.accept(self)
			self.out.write()
			self.out.write("// add symbol '" + d_id + "' to package '" + name + "'")
			self.out.write(name + "." + d_id + " = " + d_id + ";")
		self.out.write("})();")

	def visit_RuntimeModuleIdentifier(self, r):
		self.out.extendWrite("javascript_runtime")

	def visit_StaticAttribute(self, attr):
		name = attr.getIdentifier()
		init_value = attr.getInitValue()
		class_name = attr.getClass().getIdentifier()

		if init_value:
			self.out.write(class_name + ".prototype." + name + " = ")
			init_value.accept(self)
			self.out.extendWrite(";")
		else:
			self.out.write(class_name + ".prototype." + name + " = null;")

	def visit_SuperClassConstructorCall(self, call):
		super_class = call.getSuperClassIdentifier()
		params = call.getActualParameters()
		param_list = [Literal("this")] + params.getParameterList()
		params = ActualParameters(param_list)

		self.out.extendWrite(super_class)
		self.out.extendWrite(".call")
		params.accept(self)

	def visit_SuperClassDestructorCall(self, call):
		pass # Javascript doesn't have destructors

	def visit_SuperClassMethodCall(self, call):
		super_class = call.getSuperClassIdentifier()
		method_name = call.getMethodIdentifier()
		params = call.getActualParameters()
		param_list = [Literal("this")] + params.getParameterList()
		params = ActualParameters(param_list)

		self.out.extendWrite(super_class)
		self.out.extendWrite(".prototype." + method_name + ".call")
		params.accept(self)

	def visit_ThrowExceptionStatement(self, stmt):
		self.out.write("throw new Error(")
		stmt.getExpression().accept(self)
		self.out.extendWrite(");")


