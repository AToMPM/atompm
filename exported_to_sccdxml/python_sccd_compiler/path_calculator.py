from compiler_exceptions import *
from visitor import Visitor

class PathCalculator(Visitor):
	""" Computes the states that must be exited and entered for a specific transition if the system is to make
		that transition. 
	"""
	
	def visit_ClassDiagram(self, class_diagram): 
		for c in class_diagram.classes :
			c.accept(self)

	def visit_Class(self, c):
		if c.statechart:
			c.statechart.accept(self)
		
	def visit_StateChart(self, statechart):
		for node in statechart.basics + statechart.composites:
			node.accept(self)
					 
	def visit_StateChartNode(self, node):
		for transition in node.transitions :
			transition.accept(self)
			
	def visit_StateChartTransition(self, transition):
		#Find the scope of the transition (lowest common proper ancestor)
		#TODO: Could it be made more efficient if we calculated the LCA from the source node and just one of the target nodes?
		LCA = self.calculateLCA(transition)
		
		#Calculate exit nodes
		transition.exit_nodes = [transition.parent_node]
		for node in transition.parent_node.getAncestors() :
			if (node == LCA) :
				break
			transition.exit_nodes.append(node)
	   
		#Calculate enter nodes
		transition.enter_nodes = []
		
		#we then add the branching paths to the other nodes
		for target_node in transition.target.target_nodes :
			to_append_list = [(target_node, True)]
			for anc in target_node.getAncestors() :
				if anc == LCA : #If we reach the LCA in the ancestor hierarchy we break
					break;
				to_add = True;  #boolean value to see if the current ancestor should be added to the result
				for enter_node_entry in transition.enter_nodes :
					if anc == enter_node_entry[0] :
						to_add = False #If we reach an ancestor in the hierarchy that is already listed as enter node, we don't add and break
						break
				if to_add:
					to_append_list.append((anc, False)) #Only the first from the ancestor list should get True
				else :
					break
					
			to_append_list.reverse() #the enter sequence should be in the reverse order of the ancestor hierarchy
			transition.enter_nodes.extend(to_append_list)

		# Calculate arena
		current = LCA
		while not current.is_composite:
			current = current.parent
		transition.arena = current

	def calculateLCA(self, transition):
		"""
		Calculates the lowest common ancestor of a transition
		""" 
		for anc in transition.parent_node.getAncestors() :
			all_descendants = True 
			for node in transition.target.getNodes() :
				if not node.isDescendantOf(anc) :
					all_descendants = False
					break
			if all_descendants :
				return anc
		return None
