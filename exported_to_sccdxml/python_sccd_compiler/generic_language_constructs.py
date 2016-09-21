import abc
from visitor import Visitor, Visitable


class GenericConstruct(Visitable):
	__metaclass__ = abc.ABCMeta


# base class for constructs that are a collection of other constructs
class AbstractList:
	__metaclass__ = abc.ABCMeta

	@abc.abstractmethod
	def add(self, generic_construct):
		pass


class BlockEntry(GenericConstruct):
	__metaclass__ = abc.ABCMeta

	@abc.abstractmethod
	def isEmpty(self):
		pass


class DeclarationBase:
	def __init__(self, identifier, description = None):
		self.identifier = identifier
		self.description = description # string describing declared artifact

	def getIdentifier(self):
		return self.identifier

	def getDescription(self):
		return self.description


class Statement(BlockEntry):
	pass


class Package(Statement, AbstractList, DeclarationBase):
	def __init__(self, identifier, description = None):
		DeclarationBase.__init__(self, identifier, description)
		self.declarations = []

	def add(self, item):
		self.declarations.append(MakeDeclaration(item))

	def getDeclarations(self):
		return self.declarations

	def isEmpty(self):
		return False


class FormalParameters(GenericConstruct, AbstractList):
	def __init__(self, parameter_list = None):
		if parameter_list is None: parameter_list = []
		self.parameter_list = parameter_list

	def add(self, parameter):
		self.parameter_list.append(parameter)

	def getParameterList(self):
		return self.parameter_list

class AST(GenericConstruct, AbstractList):
	def __init__(self):
		self.entries = []

	def add(self, entry):
		self.entries.append(MakeBlockEntry(entry))

	def getEntries(self):
		return self.entries


class Block(AST):
	def __init__(self):
		AST.__init__(self)

	def isEmpty(self):
		for e in self.getEntries():
			if not e.isEmpty():
				return False
		return True


class ForLoopBody(Block):
	def __init__(self, for_loop):
		Block.__init__(self)
		self.for_loop = for_loop

	def getForLoop(self):
		return self.for_loop


class MethodBody(Block):
	def __init__(self, method):
		Block.__init__(self)
		self.method = method

	def getMethod(self):
		return self.method


#class ConstructorBody(MethodBody):
#	def __init__(self, method):
#		MethodBody.__init__(self, method)

#class DestructorBody(MethodBody):
#	def __init__(self, method):
#		MethodBody.__init__(self, method)


class ClassMember(GenericConstruct, DeclarationBase):
	def __init__(self, c, identifier, description = None):
		DeclarationBase.__init__(self, identifier, description)
		self.c = c # Class

	def getClass(self):
		return self.c


class MethodBase(ClassMember):
	def __init__(self, c, identifier, description = None):
		ClassMember.__init__(self, c, identifier, description)
		self.formal_parameters = FormalParameters()
		self.body = MethodBody(self)

	def getBody(self):
		return self.body

	def getFormalParameters(self):
		return self.formal_parameters


class Method(MethodBase):
	def __init__(self, c, identifier, description = None):
		MethodBase.__init__(self, c, identifier, description)


class Constructor(MethodBase):
	def __init__(self, c, description = None):
		MethodBase.__init__(self, c, None, description)


class Destructor(MethodBase):
	def __init__(self, c, description = None):
		MethodBase.__init__(self, c, None, description)


class Class(GenericConstruct, AbstractList, DeclarationBase):
	def __init__(self, identifier, super_class_identifier_list = None, description = None):
		DeclarationBase.__init__(self, identifier, description)
		self.super_class_identifier_list = super_class_identifier_list # string
		self.constructor = Constructor(self)
		self.destructor = Destructor(self)
		self.members = []

	def getSuperClassIdentifierList(self):
		return self.super_class_identifier_list

	def getConstructor(self):
		return self.constructor

	def getDestructor(self):
		return self.destructor

	def add(self, class_member):
		self.members.append(class_member)

	def getMembers(self):
		return self.members


class AttributeBase(ClassMember):
	def __init__(self, c, identifier, init_value = None):
		ClassMember.__init__(self, c, identifier)
		self.init_value = MakeExpression(init_value)

	def getInitValue(self):
		return self.init_value


class Attribute(AttributeBase):
	def __init__(self, c, identifier, init_value = None):
		AttributeBase.__init__(self, c, identifier, init_value)


class StaticAttribute(AttributeBase):
	def __init__(self, c, name, init_value = None):
		AttributeBase.__init__(self, c, name, init_value)


class FormalParameter(GenericConstruct, DeclarationBase):
	def __init__(self, identifier, default_value = None, description = None):
		DeclarationBase.__init__(self, identifier, description)
		#self.identifier = identifier
		self.default_value = MakeExpression(default_value)

	def getDefaultValue(self):
		return self.default_value


class IncludeStatement(Statement):
	def __init__(self, module_path, imported_symbols = None):
		if imported_symbols is None: imported_symbols = []
		self.module_path = MakeExpressionList(module_path) # list of modules
		self.imported_symbols = imported_symbols

	def getModulePath(self):
		return self.module_path

	def getImportedSymbols(self):
		return self.imported_symbols

	def isEmpty(self):
		return False


class ReturnStatement(Statement):
	def __init__(self, expr):
		self.expr = MakeExpression(expr)

	def getExpression(self):
		return self.expr

	def isEmpty(self):
		return False

class BreakStatement(Statement):
	def isEmpty(self):
		return False	

class ThrowExceptionStatement(Statement):
	def __init__(self, expr):
		self.expr = MakeExpression(expr)

	def getExpression(self):
		return self.expr

	def isEmpty(self):
		return False


class VSpace(BlockEntry):
	def isEmpty(self):
		return True


class CommentBase(BlockEntry):
	def __init__(self, text):
		self.text = text

	def isEmpty(self):
		return True

	def getText(self):
		return self.text


class SingleLineComment(CommentBase):
	def __init__(self, text):
		CommentBase.__init__(self,text)


class MultiLineComment(CommentBase):
	def __init__(self, text):
		CommentBase.__init__(self,text)


class ConditionalStatementBase(Statement, AbstractList):
	def __init__(self, body = None):
		if body is None: body = Block()
		self.body = body

	def add(self, stmt):
		self.body.add(stmt)

	def getBody(self):
		return self.body

	def isEmpty(self):
		return False


class IfStatement(ConditionalStatementBase):
	def __init__(self, condition):
		ConditionalStatementBase.__init__(self)
		self.condition = MakeExpression(condition)

	def getCondition(self):
		return self.condition


class ElseStatement(ConditionalStatementBase):
	def __init__(self):
		ConditionalStatementBase.__init__(self)


class ElseIfStatement(IfStatement):
	def __init__(self, condition, is_first = False):
		IfStatement.__init__(self, condition)
		self.is_first = is_first

	# in a series of ElseIfStatements, the first ElseIfStatement will be a normal if statement
	def isFirst(self):
		return self.is_first


class ForLoopIterateBase(ConditionalStatementBase):
	def __init__(self, collection_expr, iterator_identifier):
		ConditionalStatementBase.__init__(self, ForLoopBody(self))
		self.collection_expr = MakeExpression(collection_expr)
		self.iterator_identifier = iterator_identifier

	def getCollectionExpression(self):
		return self.collection_expr

	def getIteratorIdentifier(self):
		return self.iterator_identifier


class ForLoopIterateArray(ForLoopIterateBase):
	def __init__(self, array_expr, iterator_identifier):
		ForLoopIterateBase.__init__(self, array_expr, iterator_identifier)


class ForLoopIterateMapValues(ForLoopIterateBase):
	def __init__(self, map_expr, iterator_identifier):
		ForLoopIterateBase.__init__(self, map_expr, iterator_identifier)


class ExpressionStatement(Statement):
	def __init__(self, expression):
		self.expression = expression

	def getExpression(self):
		return self.expression

	def isEmpty(self):
		return False


# block of raw code
class RawCode(BlockEntry):
	def __init__(self, text):
		self.text = text

	def getText(self):
		return self.text

	def isEmpty(self):
		return (len(self.text.strip()) == 0)


# log message to console
class LogStatement(Statement):
	def __init__(self, msg):
		self.msg = msg

	def getMessage(self):
		return self.msg

	def isEmpty(self):
		return False


class Expression(GenericConstruct):
	__metaclass__ = abc.ABCMeta

	@abc.abstractmethod
	def isCompound(self):
		pass

class SimpleExpression(Expression):
	def isCompound(self):
		return False

class CompoundExpression(Expression):
	def isCompound(self):
		return True

class RuntimeModuleIdentifier(SimpleExpression):
	pass

# Not a real language construct, simply 'glues' expressions together.
class Glue(SimpleExpression, AbstractList):
	def __init__(self):
		self.expression_list = []

	def add(self, expr):
		self.expression_list.append(MakeExpression(expr))

	def getExpressionList(self):
		return self.expression_list


class ForLoopCurrentElement(SimpleExpression):
	def __init__(self, collection_expr, iterator_identifier):
		self.collection_expr = MakeExpression(collection_expr)
		self.iterator_identifier = iterator_identifier

	def getCollectionExpression(self):
		return self.collection_expr

	def getIteratorIdentifier(self):
		return self.iterator_identifier


class Literal(SimpleExpression):
	def __init__(self, text):
		self.text = text

	def getText(self):
		return self.text


class String(Literal):
	def __init__(self, text):
		Literal.__init__(self, text)


class Property(SimpleExpression):
	def __init__(self, owner, prop):
		self.owner = MakeExpression(owner)
		self.prop = prop

	def getOwnerExpression(self):
		return self.owner

	def getProperty(self):
		return self.prop


class MapIndexedExpression(SimpleExpression):
	def __init__(self, map_expr, key_expr):
		self.map_expr = MakeExpression(map_expr)
		self.key_expr = MakeExpression(key_expr)

	def getMapExpression(self):
		return self.map_expr

	def getKeyExpression(self):
		return self.key_expr


class ArrayIndexedExpression(SimpleExpression):
	def __init__(self, array_expr, index_expr):
		self.array_expr = MakeExpression(array_expr)
		self.index_expr = MakeExpression(index_expr)

	def getArrayExpression(self):
		return self.array_expr

	def getIndexExpression(self):
		return self.index_expr


class ActualParameters(GenericConstruct, AbstractList):
	def __init__(self, parameter_list = None):
		if parameter_list is None: parameter_list = []
		self.parameter_list = MakeExpressionList(parameter_list)

	def add(self, p):
		self.parameter_list.append(MakeExpression(p))
		pass

	def getParameterList(self):
		return self.parameter_list


class FunctionCallBase(SimpleExpression):
	def __init__(self, actual_parameters = None):
		if actual_parameters is None: actual_parameters = ActualParameters()
		self.actual_parameters = MakeActualParameters(actual_parameters)

	def getActualParameters(self):
		return self.actual_parameters
	


class FunctionCall(FunctionCallBase):
	def __init__(self, function_expr, actual_parameters = None):
		FunctionCallBase.__init__(self, actual_parameters)
		self.function_expr = MakeExpression(function_expr)

	def getFunctionExpression(self):
		return self.function_expr


class SuperClassCallBase(FunctionCallBase):
	def __init__(self, super_class_identifier, actual_parameters = None):
		FunctionCallBase.__init__(self, actual_parameters)
		self.super_class_identifier = super_class_identifier

	def getSuperClassIdentifier(self):
		return self.super_class_identifier


class SuperClassConstructorCall(SuperClassCallBase):
	def __init__(self, super_class_identifier, actual_parameters = None):
		SuperClassCallBase.__init__(self, super_class_identifier, actual_parameters)


class SuperClassDestructorCall(SuperClassCallBase):
	def __init__(self, super_class_identifier):
		SuperClassCallBase.__init__(self, super_class_identifier)


class SuperClassMethodCall(SuperClassCallBase):
	def __init__(self, super_class_identifier, method_identifier, actual_parameters = None):
		SuperClassCallBase.__init__(self, super_class_identifier, actual_parameters)
		self.method_identifier = method_identifier

	def getMethodIdentifier(self):
		return self.method_identifier


class NewExpression(FunctionCallBase):
	def __init__(self, type_expr, actual_parameters = None):
		FunctionCallBase.__init__(self, actual_parameters)
		self.type_expr = MakeExpression(type_expr)

	def getTypeExpression(self):
		return self.type_expr


class SelfExpression(SimpleExpression):
	pass


class SelfProperty(Property):
	def __init__(self, prop):
		Property.__init__(self, SelfExpression(), prop)


class Operator(GenericConstruct):
	pass


class AndOperator(Operator):
	pass

class OrOperator(Operator):
	pass

class LessThanOperator(Operator):
	pass

class GreaterThanOperator(Operator):
	pass

class NotOperator(Operator):
	pass

class EqualsOperator(Operator):
	pass

class AssignmentOperator(Operator):
	pass

class ProductOperator(Operator):
	pass


class UnaryExpression(CompoundExpression):
	def __init__(self, operator, expr):
		self.operator = operator
		self.expr = MakeExpression(expr)

	def getExpression(self):
		return self.expr

	def getOperator(self):
		return self.operator


class BinaryExpression(CompoundExpression):
	def __init__(self, lhs_expr, operator, rhs_expr):
		self.lhs_expr = MakeExpression(lhs_expr)
		self.operator = operator
		self.rhs_expr = MakeExpression(rhs_expr)

	def getLhsExpression(self):
		return self.lhs_expr

	def getRhsExpression(self):
		return self.rhs_expr

	def getOperator(self):
		return self.operator


class NotExpression(UnaryExpression):
	def __init__(self, expr):
		UnaryExpression.__init__(self, NotOperator(), expr)

class AndExpression(BinaryExpression):
	def __init__(self, lexpr = None, rexpr = None):
		BinaryExpression.__init__(self, lexpr, AndOperator(), rexpr)

class OrExpression(BinaryExpression):
	def __init__(self, lexpr = None, rexpr = None):
		BinaryExpression.__init__(self, lexpr, OrOperator(), rexpr)

class LessThanExpression(BinaryExpression):
	def __init__(self, lexpr = None, rexpr = None):
		BinaryExpression.__init__(self, lexpr, LessThanOperator(), rexpr)

class GreaterThanExpression(BinaryExpression):
	def __init__(self, lexpr = None, rexpr = None):
		BinaryExpression.__init__(self, lexpr, GreaterThanOperator(), rexpr)

class EqualsExpression(BinaryExpression):
	def __init__(self, lexpr = None, rexpr = None):
		BinaryExpression.__init__(self, lexpr, EqualsOperator(), rexpr)

class AssignmentExpression(BinaryExpression):
	def __init__(self, lexpr = None, rexpr = None):
		BinaryExpression.__init__(self, lexpr, AssignmentOperator(), rexpr)

class ProductExpression(BinaryExpression):
	def __init__(self, lexpr = None, rexpr = None):
		BinaryExpression.__init__(self, lexpr, ProductOperator(), rexpr)


class FalseExpression(SimpleExpression):
	pass

class TrueExpression(SimpleExpression):
	pass


class LocalVariableDeclaration(Expression, DeclarationBase):
	def __init__(self, identifier, init_value = None, description = None):
		DeclarationBase.__init__(self, identifier, description)
		self.init_value = MakeExpression(init_value)

	def getInitValue(self):
		self.init_value

	def isCompound(self):
		return (self.init_value != None)


class MapExpression(SimpleExpression):
	def __init__(self, elements = None):
		if elements is None: elements = {}
		self.elements = MakeExpressionMap(elements)

	def getElements(self):
		return self.elements

class MapRemoveElement(Statement):
	def __init__(self, map_expr, key_expr):
		self.map_expr = MakeExpression(map_expr)
		self.key_expr = MakeExpression(key_expr)

	def getMapExpression(self):
		return self.map_expr

	def getKeyExpression(self):
		return self.key_expr

	def isEmpty(self):
		return False


class ArrayExpression(SimpleExpression, AbstractList):
	def __init__(self, elements = None):
		if elements is None: elements = []
		self.elements = MakeExpressionList(elements)

	def add(self, element):
		self.elements.append(MakeExpression(element))

	def getElements(self):
		return self.elements


class ArrayLength(SimpleExpression):
	def __init__(self, array_expr):
		self.array_expr = MakeExpression(array_expr)

	def getArrayExpression(self):
		return self.array_expr


class ArrayElementOperation(Expression):
	def __init__(self, array_expr, elem_expr):
		self.array_expr = MakeExpression(array_expr)
		self.elem_expr = MakeExpression(elem_expr)

	def getArrayExpression(self):
		return self.array_expr

	def getElementExpression(self):
		return self.elem_expr

class ArrayIndexOf(ArrayElementOperation, SimpleExpression):
	def __init__(self, array_expr, elem_expr):
		ArrayElementOperation.__init__(self, array_expr, elem_expr)

class ArrayContains(ArrayElementOperation, CompoundExpression):
	def __init__(self, array_expr, elem_expr):
		ArrayElementOperation.__init__(self, array_expr, elem_expr)

class ArrayPushBack(ArrayElementOperation, SimpleExpression):
	def __init__(self, array_expr, elem_expr):
		ArrayElementOperation.__init__(self, array_expr, elem_expr)


class NoneExpression(SimpleExpression):
	pass


# helpers

def MakeExpression(expr):
	if isinstance(expr, Expression):
		return expr
	elif isinstance(expr, basestring):
		return Literal(expr)
	elif expr is None:
		return None
	else:
		raise Exception("Can't turn argument of type '" + str(type(expr)) + "' into Expression.")

def MakeExpressionList(l):
	if not isinstance(l, list):
		raise Exception("Expected argument of type 'list'.")
	for i in range(len(l)):
		l[i] = MakeExpression(l[i])
	return l

def MakeExpressionMap(m):
	if not isinstance(m, dict):
		raise Exception("Expected argument of type 'dict'.")
	for key in m.keys():
		m[key] = MakeExpression(m[key])
	return m

def MakeBlockEntry(stmt):
	if isinstance(stmt, BlockEntry):
		return stmt
	elif isinstance(stmt, Expression):
		return ExpressionStatement(stmt)
	elif stmt is None:
		return None
	else:
		raise Exception("Can't turn argument of type '" + str(type(stmt)) + "' into BlockEntry.")

def MakeDeclaration(obj):
	if isinstance(obj, DeclarationBase):
		return obj
	else:
		raise Exception("Can't turn argument of type '" + str(type(stmt)) + "' into DeclarationBase.")

def MakeActualParameters(obj):
	if isinstance(obj, ActualParameters):
		return obj
	elif isinstance (obj, list):
		return ActualParameters(obj)
	else:
		raise Exception("Can't turn argument of type '" + str(type(obj)) + "' into ActualParameters.")

"""def MakeFormalParameter(parameter, default_value):
	if isinstance(parameter, FormalParameter):
		return parameter
	elif default_value:
		return FormalParameter(parameter, default_value)
	else:
		return FormalParameter(parameter)"""


class GenericWriterBase(Visitor):
	__metaclass__ = abc.ABCMeta

	# overrides Visitor.generic_visit
	def generic_visit(self, node):
		raise Exception("Writer has no visit method for node of type '" + str(type(node)) + "'.")

	#### HELPERS ####

	def writeAll(self, l):
		for item in l:
			item.accept(self)

	def writeTuple(self, obj):
		self.out.extendWrite("(")
		self.writeCommaSeparated(obj)
		self.out.extendWrite(")")

	@abc.abstractmethod
	def writeComment(self, text):
		pass

	@abc.abstractmethod
	def writeMultiLineComment(self, text):
		pass

	def writeCommaSeparated(self, l):
		for i in range(len(l)):
			if i != 0:
				self.out.extendWrite(", ")
			l[i].accept(self)

	def writeDescription(self, decl):
		description = decl.getDescription()
		if description:
			self.writeComment(description)

	def writeCompoundExpr(self, expr):
		if expr.isCompound():
			self.out.extendWrite("(")
		expr.accept(self)
		if expr.isCompound():
			self.out.extendWrite(")")

	#### VISIT METHODS BASE IMPLEMENTATIONS ####

	def visit_ArrayIndexedExpression(self, i):
		a = i.getArrayExpression()
		index = i.getIndexExpression()

		a.accept(self)
		self.out.extendWrite("[")
		index.accept(self)
		self.out.extendWrite("]")

	def visit_ActualParameters(self, p):
		self.writeTuple(p.getParameterList())

	def visit_AssignmentOperator(self, assign):
		self.out.extendWrite(" = ")

	def visit_BinaryExpression(self, b):
		lhs = b.getLhsExpression()
		rhs = b.getRhsExpression()
		op = b.getOperator()

		self.writeCompoundExpr(lhs)
		op.accept(self)
		self.writeCompoundExpr(rhs)

	def visit_FormalParameters(self, p):
		self.writeTuple(p.getParameterList())

	def visit_FunctionCall(self, f):
		func = f.getFunctionExpression()
		params = f.getActualParameters()

		func.accept(self)
		params.accept(self)

	def visit_Glue(self, g):
		self.writeAll(g.getExpressionList())

	def visit_GreaterThanOperator(self, g):
		self.out.extendWrite(" > ")

	def visit_LessThanOperator(self, l):
		self.out.extendWrite(" < ")

	def visit_Literal(self, l):
		self.out.extendWrite(l.getText())

	def visit_MultiLineComment(self, c):
		self.writeMultiLineComment(c.getText())

	def visit_ProductOperator(self, p):
		self.out.extendWrite(" * ")

	def visit_Property(self, p):
		owner = p.getOwnerExpression()
		prop = p.getProperty()

		owner.accept(self)
		self.out.extendWrite("." + prop)

	def visit_RawCode(self, c):
		self.out.writeCodeCorrectIndent(c.getText())

	def visit_SingleLineComment(self, comment):
		self.writeComment(comment.getText())

	def visit_String(self, string):
		self.out.extendWrite("\"" + string.getText().replace("\"", "\\\"") + "\"")

	def visit_UnaryExpression(self, u):
		expr = u.getExpression()
		op = u.getOperator()

		op.accept(self)
		self.writeCompoundExpr(expr)

	def visit_VSpace(self, v):
		self.out.write()


class CLikeWriterBase(GenericWriterBase):

	### HELPERS ###

	def writeComment(self, text):
		self.out.write("// " + text)

	def writeMultiLineComment(self, text):
		self.out.write("/* " + text + "*/")

	### VISIT METHODS ###

	def visit_AndOperator(self, a):
		self.out.extendWrite(" && ")

	def visit_Block(self, b):
		self.out.extendWrite(" {")
		self.out.indent()
		self.writeAll(b.getEntries())
		self.out.dedent()
		self.out.write("}")

	def visit_BreakStatement(self, b):
		self.out.write("break;")

	def visit_ElseStatement(self, else_stmt):
		self.out.extendWrite(" else ")
		else_stmt.getBody().accept(self)

	def visit_ElseIfStatement(self, else_if):
		condition = else_if.getCondition()
		body = else_if.getBody()

		if else_if.isFirst():
			self.out.write("if (")
		else:
			self.out.extendWrite(" else if (")
		condition.accept(self)
		self.out.extendWrite(")")
		body.accept(self)

	def visit_EqualsOperator(self, e):
		self.out.extendWrite(" == ")

	def visit_ExpressionStatement(self, stmt):
		self.out.write() # expressions never begin with a newline
		stmt.getExpression().accept(self)
		self.out.extendWrite(";")

	def visit_FalseExpression(self, f):
		self.out.extendWrite("false")

	def visit_IfStatement(self, if_stmt):
		condition = if_stmt.getCondition()
		body = if_stmt.getBody()

		self.out.write("if (")
		condition.accept(self)
		self.out.extendWrite(")")
		body.accept(self)

	def visit_NewExpression(self, new):
		type_expr = new.getTypeExpression()
		params = new.getActualParameters()

		self.out.extendWrite("new ")
		type_expr.accept(self)
		params.accept(self)

	def visit_NotOperator(self, n):
		self.out.extendWrite("!")

	def visit_OrOperator(self, o):
		self.out.extendWrite(" || ")

	def visit_ReturnStatement(self, r):
		self.out.write("return ")
		r.getExpression().accept(self)
		self.out.extendWrite(";")

	def visit_SelfExpression(self, s):
		self.out.extendWrite("this")

	def visit_TrueExpression(self, t):
		self.out.extendWrite("true")


