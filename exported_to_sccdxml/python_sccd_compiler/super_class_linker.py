from compiler_exceptions import *
from utils import Logger
from visitor import Visitor

class SuperClassLinker(Visitor):
	""" Computes the states that must be exited and entered for a specific transition if the system is to make
		that transition. 
	"""
	
	def visit_ClassDiagram(self, class_diagram): 
		for c in class_diagram.classes :
			c.accept(self)

	def visit_Class(self, c):
		# replace super class names by super class objects
		for s in c.super_classes:
			super_class = None
			for clas in c.class_diagram.classes:
				if clas.name == s:
					super_class = clas
			if super_class == None:
				Logger.showWarning("Class <" + c.name + "> has undefined super class <" + s + ">.")
			else:
				c.super_class_objs[s] = super_class

		# calculate list of abstract methods
		c.abstract_method_names = getClassAbstractMethodNames(c)

		# check if <super> tags exist for all inherited classes
		for name,obj in c.super_class_objs.iteritems():
			if obj:
				if name not in c.constructors[0].super_class_parameters:
					num_params = len(obj.constructors[0].parameters)
					if num_params > 0:
						raise CompilerException("Class <" + c.name + "> inherits <" + name + "> and <" + name + ">'s constructor has " + str(num_params) + " parameter(s), but there's no <super> entry for that class in <" + c.name + ">'s constructor.")

def getClassAbstractMethodNames(c):
	abstract_method_names = []
	non_abstract_method_names = []
	for m in c.methods:
		if m.isAbstract():
			abstract_method_names.append(m.name)
		else:
			non_abstract_method_names.append(m.name)
	for s in c.super_classes:
		if s in c.super_class_objs:
			super_abstract_method_names = getClassAbstractMethodNames(c.super_class_objs[s])
			for m_name in super_abstract_method_names:
				if m_name not in non_abstract_method_names:
					abstract_method_names.append(m_name)
	return abstract_method_names

