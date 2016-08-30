'''*****************************************************************************
AToMPM - A Tool for Multi-Paradigm Modelling

Copyright (c) 2011 Eugene Syriani

This file is part of AToMPM.

AToMPM is free software: you can redistribute it and/or modify it under the
terms of the GNU Lesser General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later 
version.

AToMPM is distributed in the hope that it will be useful, but WITHOUT ANY 
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.  See the GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License along
with AToMPM.  If not, see <http://www.gnu.org/licenses/>.
*****************************************************************************'''

import sys
from himesis import Himesis


class Priority(object):
    """
        Implements heuristics for the HimesisMatcher algorithm.
        Determines the order in which the candidate pairs should be computed.
        By default, the order is the index order of the nodes in igraph.
        To refine this heuristic order, you should sub-class Priority and override its methods. 
    """
    def __init__(self):
        """
            Implements heuristics for the HimesisMatcher algorithm.
            Determines the order in which the candidate pairs should be computed.
            By default, the order is the index order of the nodes in igraph.
            To refine this heuristic order, you should sub-class Priority and override its methods.
        """
        self.source_graph = None
        self.pattern_graph = None
    
    def cache_info(self, source_graph, pattern_graph):
        """
            Pre-computes any information required by the order and order_all methods
            @param source_graph: The source graph.
            @param pattern_graph: The pattern graph.
        """
        pass
    
    def order_source(self, candidate_list):
        """
            Specifies the order for the terminal sets for the source graph.
            @param candidate_list: The list of possible candidates.
        """
        return sorted(candidate_list)
    
    def order_pattern(self, candidate_list):
        """
            Specifies the order for the terminal sets for the pattern graph.
            @param candidate_list: The list of possible candidates.
        """
        return sorted(candidate_list)
    
    def order_all_source(self, candidate_list):
        """
            Specifies the order for all source nodes.
            @param candidate_list: The list of possible candidates.
        """
        return candidate_list
    
    def order_all_pattern(self, candidate_list):
        """
            Specifies the order for all pattern nodes.
            @param candidate_list: The list of possible candidates.
        """
        return candidate_list


class HimesisMatcher(object):
    """
        Represents a pattern matching algorithm for typed attributed multi-graphs.
        The pattern matching algorithm is based on VF2.
    """
    def __init__(self, source_graph, pattern_graph, priority=Priority(), pred1={}, succ1={}):
        """
            Represents a pattern matching algorithm for typed attributed multi-graphs.
            @param source_graph: The source graph.
            @param pattern_graph: The pattern graph.
            @param priority: Instance of a sub-class of the Priority class.
                            It is used to determine the order in which the candidate pairs should be computed.
            @param pred1: Pre-built dictionary of predecessors in the source graph.
            @param succ1: Pre-built dictionary of successors in the source graph.
        """
        self.G1 = source_graph
        self.G2 = pattern_graph
        self.pred1 = pred1
        self.succ1 = succ1
        
        assert(isinstance(priority, Priority))
        self.priority = priority
        self.priority.source_graph = source_graph
        self.priority.pattern_graph = pattern_graph

        # Set recursion limit
        self.old_recursion_limit = sys.getrecursionlimit()
        expected_max_recursion_level = self.G2.vcount()
        if self.old_recursion_limit < 1.5 * expected_max_recursion_level:
            # Give some breathing room
            sys.setrecursionlimit(int(1.5 * expected_max_recursion_level))
        
        # Initialize the state
        self.initialize()
        
        # Check whether we are considering multi-graph
#        if reduce(lambda x,y: x or y, self.G2.is_multiple()):
#            self.cache_info_multi(self.G1_nodes, self.G2_nodes)
        
        # Scan the two graphs to cache required information.
        # Typically stores the results of expensive operation on the graphs.
        # This speeds up the algorithm significantly.
        self.cache_info()
    
    def cache_info(self):
        """
            Cache information on the nodes.
            Typically stores the results of expensive operation on the graphs.
            This speeds up the algorithm significantly.
        """
        # Cache individual nodes
        self.G1_nodes = self.G1.node_iter()
        self.G2_nodes = self.G2.node_iter()
        
#        # Memoize the predecessor & successor information:
#        # for each node store the number of neighbours and the list
#        if len(self.pred1) == 0 or len(self.succ1) == 0:
#            self.pred1 = {}
#            self.succ1 = {}
#            for node in self.G1_nodes:
#                self.pred1[node] = (len(self.G1.predecessors(node)), self.G1.predecessors(node))
#                self.succ1[node] = (len(self.G1.successors(node)), self.G1.successors(node))
#        self.pred2 = {}
#        self.succ2 = {}
#        for node in self.G2_nodes:
#            self.pred2[node] = (len(self.G2.predecessors(node)), self.G2.predecessors(node))
#            self.succ2[node] = (len(self.G2.successors(node)), self.G2.successors(node))
        
        # Cache any further data used for the heuristic prioritization for computing the candidate pair
        # This is done when initializing the priority class
        self.priority.cache_info(self.G1, self.G2)
    
    def reset_recursion_limit(self):
        """
            Restores the recursion limit.
        """
        sys.setrecursionlimit(self.old_recursion_limit)
    
    def initialize(self):
        """
            (Re)Initializes the state of the algorithm.
        """
        #=======================================================================
        # The algorithm is based on VF2.
        # The following are the data-structures used:
        #    - M_1: the current partial mapping from G1 to G2
        #    - M_2: the current partial mapping from G2 to G1
        #    - T1_in: the in-neighbours of the nodes in M_1
        #    - T2_in: the in-neighbours of the nodes in M_2
        #    - T1_out: the out-neighbours of the nodes in M_1
        #    - T2_out: the out-neighbours of the nodes in M_2
        #=======================================================================
        
        # core_1[n] contains the index of the node m paired with n, if n is in the mapping
        self.core_1 = {}   # This is M_1
        # core_2[m] contains the index of the node n paired with m, if m is in the mapping
        self.core_2 = {}   # This is M_2
        
        # The value stored is the depth of the search tree when the node became part of the corresponding set
        # Non-zero if n is in M_1 or in T_1^{in}
        self.in_1 = {}
        # Non-zero if n is in M_1 or in T_1^{out}
        self.out_1 = {}
        # Non-zero if m is in M_2 or in T_2^{in}
        self.in_2 = {}
        # Non-zero if m is in M_2 or in T_2^{out}
        self.out_2 = {}
        # To improve the performance, we also store the following vectors
        # Non-zero if n is in M_1 or in T_1^{in} or in T_1^{out}
        self.inout_1 = {}
        # Non-zero if n is in M_2 or in T_2^{in} or in T_2^{out}
        self.inout_2 = {}
        
        # Prepare the necessary data structures required for backtracking
        self.state = HimesisMatcherState(self)

        # Provide a convenient way to access the isomorphism mapping.
        self.mapping = self.core_2.copy()
    
    def are_compatibile(self, src_node, patt_node):
        """
            Verifies if a candidate pair is compatible.
            More specifically, verify degree and meta-model compatibility.
            @param src_node: The candidate from the source graph.
            @param patt_node: The candidate from the pattern graph.
        """
        sourceNode = self.G1.vs[src_node]
        patternNode = self.G2.vs[patt_node]
        
        # First check if they are of the same type
        if sourceNode[Himesis.Constants.FULLTYPE] == patternNode[Himesis.Constants.FULLTYPE]:
            # Then check for the degree compatibility
            return (self.pred2[patt_node][0] <= self.pred1[src_node][0]
                    and self.succ2[patt_node][0] <= self.succ1[src_node][0])
        # Otherwise, first check for the degree compatibility
        elif not (self.pred2[patt_node][0] <= self.pred1[src_node][0]
                and self.succ2[patt_node][0] <= self.succ1[src_node][0]):
            return False
        # Then check sub-types compatibility
        else:
            return (patternNode[Himesis.Constants.MT_SUBTYPE_MATCH]
                    and sourceNode[Himesis.Constants.FULLTYPE] in patternNode[Himesis.Constants.MT_SUBTYPES])
    
    def candidate_pairs_iter(self):
        """
            Iterator over candidate pairs of nodes in G1 and G2, according to the VF2 algorithm.
            The candidate pairs have all passed the compatibility check before output.
            @return: The candidate pair (source node, pattern node)
        """
        
        #=======================================================================
        # Here we compute P(s) = (p1,p2) the candidate pair
        # for the current partial mapping M(s).
        #=======================================================================
        
        # First try the nodes that are in both Ti_in and Ti_out
        if len(self.inout_1) > len(self.core_1) and len(self.inout_2) > len(self.core_2):
            for patt_node in self.priority.order_pattern(self.inout_2):
                if patt_node not in self.core_2:
                    break
            for src_node in self.priority.order_source(self.inout_1):
                if src_node not in self.core_1:
                    yield src_node, patt_node
        
        # If T1_out and T2_out are both non-empty:
        # P(s) = T1_out x {min T2_out}
        elif len(self.out_1) > len(self.core_1) and len(self.out_2) > len(self.core_2):
            for patt_node in self.priority.order_pattern(self.out_2):
                if patt_node not in self.core_2:
                    break
            for src_node in self.priority.order_source(self.out_1):
                if src_node not in self.core_1:
                    yield src_node, patt_node
    
        # If T1_in and T2_in are both non-empty:
        # P(s) = T1_in x {min T2_in}
        elif len(self.in_1) > len(self.core_1) and len(self.in_2) > len(self.core_2):
            for patt_node in self.priority.order_pattern(self.in_2):
                if patt_node not in self.core_2:
                    break
            for src_node in self.priority.order_source(self.in_1):
                if src_node not in self.core_1:
                    yield src_node, patt_node
    
        # If all terminal sets are empty:
        # P(s) = (N_1 - M_1) x {min (N_2 - M_2)}
        else:
            for patt_node in self.priority.order_all_pattern(self.G2_nodes):
                if patt_node not in self.core_2:
                    break
            for src_node in self.priority.order_all_source(self.G1_nodes):
                if src_node not in self.core_1:
                    yield src_node, patt_node
    
    def are_syntactically_feasible(self, src_node, patt_node):
        """
            Determines whether the two nodes are syntactically feasible,
            i.e., it ensures that adding this candidate pair does not make it impossible to find a total mapping.
            @param src_node: The candidate from the source graph.
            @param patt_node: The candidate from the pattern graph.
            @return: True if they are syntactically feasible, False otherwise.
        """
        #=======================================================================
        # The syntactic feasibility considers the topology of the two graphs.
        # It verifies that edges directly or indirectly connected to M(s + P(s))
        # does not violate the subgraph matching conditions.
        #=======================================================================
        
        # Check for self-loops
#        e1, e2 = -1, -1
#        if patt_node in self.succ2[patt_node] or patt_node in self.pred2[patt_node]:
#            if src_node in self.succ1[src_node] or src_node in self.pred1[src_node]:
#                e1 = self.G1.get_eid(src_node, src_node)
#                e2 = self.G2.get_eid(patt_node, patt_node)
#                if self.G1.count_multiple(e1) < self.G2.count_multiple(e2):
#                    return False
#            else:
#                return False
        
        # Counters for in and out edges found 
        in1 = 0
        in2 = 0
        out1 = 0
        out2 = 0
        inout1 = 0
        inout2 = 0
        
        # Checks if successors are compatible
        for successor2 in self.succ2[patt_node][1]:
            tmp = self.G2.predecessors(successor2)
            self.pred2[successor2] = (len(tmp), tmp)
            tmp = self.G2.successors(successor2)
            self.succ2[successor2] = (len(tmp), tmp)
            if successor2 not in self.core_2:
                for successor1 in self.succ1[src_node][1]:
                    tmp = self.G1.predecessors(successor1)
                    self.pred1[successor1] = (len(tmp), tmp)
                    tmp = self.G1.successors(successor1)
                    self.succ1[successor1] = (len(tmp), tmp)
                    if (self.succ2[successor2][0] <= self.succ1[successor1][0]
                        and self.pred2[successor2][0] <= self.pred1[successor1][0]
                        and successor1 not in self.core_1):
                        break
                else:
                    return False
                # They are compatible, so update the counters of the pattern node
                if self.pred2[successor2][1]:
                    in2 += 1
                if self.succ2[successor2][1]:
                    out2 += 1
                if not self.pred2[successor2][1] and not self.succ2[successor2][1]:
                    inout2 += 1
            else:
                if self.core_2[successor2] not in self.succ1[src_node][1]:
                    return False
        
        # Checks if predecessors are compatible
        for predecessor2 in self.pred2[patt_node][1]:
            tmp = self.G2.predecessors(predecessor2)
            self.pred2[predecessor2] = (len(tmp), tmp)
            tmp = self.G2.successors(predecessor2)
            self.succ2[predecessor2] = (len(tmp), tmp)
            if predecessor2 not in self.core_2:
                for predecessor1 in self.pred1[src_node][1]:
                    tmp = self.G1.predecessors(predecessor1)
                    self.pred1[predecessor1] = (len(tmp), tmp)
                    tmp = self.G1.successors(predecessor1)
                    self.succ1[predecessor1] = (len(tmp), tmp)
                    if (self.pred2[predecessor2][0] <= self.pred1[predecessor1][0]
                        and self.pred2[predecessor2][0] <= self.pred1[predecessor1][0]
                        and predecessor1 not in self.core_1):
                        break
                else:
                    return False
                # They are compatible, so update the counters of the pattern node
                if self.pred2[predecessor2][1]:
                    in2 += 1
                if self.pred2[predecessor2][1]:
                    out2 += 1
                if not self.pred2[predecessor2][1] and not self.pred2[predecessor2][1]:
                    inout2 += 1
            else:
                if self.core_2[predecessor2] not in self.pred1[src_node][1]:
                    return False
        
        # Now compute the counters of the source node
        for successor1 in self.succ1[src_node][1]:
            if successor1 not in self.core_1:
                tmp = self.G1.predecessors(successor1)
                self.pred1[successor1] = (len(tmp), tmp)
                tmp = self.G1.successors(successor1)
                self.succ1[successor1] = (len(tmp), tmp)
                if self.pred1[successor1][1]:
                    in1 += 1
                if self.succ1[successor1][1]:
                    out1 += 1
                if not self.pred1[successor1][1] and not self.succ1[successor1][1]:
                    inout1 += 1
            # For induced matches
            #else:
            #    if self.core_1[successor1] not in self.succ2[patt_node]:
            #        return False
        
        # Now compute the counters of the source node
        for predecessor1 in self.pred1[src_node][1]:
            if predecessor1 not in self.core_1:
                tmp = self.G1.predecessors(predecessor1)
                self.pred1[predecessor1] = (len(tmp), tmp)
                tmp = self.G1.successors(predecessor1)
                self.succ1[predecessor1] = (len(tmp), tmp)
                if self.pred1[predecessor1][1]:
                    in1 += 1
                if self.pred1[predecessor1][1]:
                    out1 += 1
                if not self.pred1[predecessor1][1] and not self.pred1[predecessor1][1]:
                    inout1 += 1
            # For induced matches
            #else:
            #    if self.core_1[predecessor1] not in self.pred2[patt_node]:
            #        return False
        
        # Finally, verify if all counters satisfy the subgraph matching conditions
        # For induced matches
        #return in2 <= in1 and out2 <= out1 and inout2 <= inout1
        return in2 <= in1 and out2 <= out1 and (in2 + out2 + inout2) <= (in1 + out1 + inout1)
    
    def are_semantically_feasible(self, src_node, patt_node):
        """
            Determines whether the two nodes are syntactically feasible,
            i.e., it ensures that adding this candidate pair does not make it impossible to find a total mapping.
            @param src_node: The candidate from the source graph.
            @param patt_node: The candidate from the pattern graph.
            @return: True if they are semantically feasible, False otherwise.
        """
        #=======================================================================
        # This feasibility check looks at the data stored in the pair of candidates.
        # It verifies that all attribute constraints are satisfied.
        #=======================================================================
        
        src_node = self.G1.vs[src_node]
        patt_node = self.G2.vs[patt_node]
        
        # Check for attributes value/constraint
        for attr in patt_node.attribute_names():
            # Ignore non-RAM attributes 
            if not Himesis.is_RAM_attribute(attr) :
                continue
            # If the attribute does not "in theory" exist
            # because igraph actually stores all attribute names in all nodes. 
            elif patt_node[attr] == None:
                continue

            # Node patt_node has not yet been matched to src_node... however,
            # patt_node[attr](..) is expecting a mapping of patt_node's mtLabel
            # to src_node's index in self.G1... so we build this mapping first
            mtLabel2graphIndexMap = {}
            mtLabel2graphIndexMap[ patt_node[Himesis.Constants.MT_LABEL] ] = src_node.index    

            try:
                if not patt_node[attr](mtLabel2graphIndexMap,self.G1):
                    return False
            except Exception, e:
                    #TODO: This should be a TransformationLanguageSpecificException
                raise Exception("An error has occurred while checking the constraint of the attribute '%s' :: %s" % (attr, str(e)))
        return True
    
    def _match(self):
        """
            Extends the pattern matching mapping.
            This method is recursively called to determine if the pattern G2
            can be completely matched on G1.
            @return: The mapping {pattern node index : source node index}
        """
        #=======================================================================
        # It cleans up the class variables after each recursive call.
        # If a match is found, we yield the mapping.
        #=======================================================================
        
        # Base condition when a complete match is found
        if len(self.core_2) == self.G2.vcount():
            # Save the final mapping, otherwise garbage collection deletes it
            self.mapping = self.core_2.copy()
            yield self.mapping
        else:
            for src_node, patt_node in self.candidate_pairs_iter():
                
                # Cache the predecessors and successors of the candidate pairs on the fly 
                self.pred1, self.succ1, self.pred2, self.succ2 = {}, {}, {}, {}
                self.pred1[src_node] = (len(self.G1.predecessors(src_node)), self.G1.predecessors(src_node))
                self.succ1[src_node] = (len(self.G1.successors(src_node)), self.G1.successors(src_node))
                self.pred2[patt_node] = (len(self.G2.predecessors(patt_node)), self.G2.predecessors(patt_node))
                self.succ2[patt_node] = (len(self.G2.successors(patt_node)), self.G2.successors(patt_node))
                
                if self.are_compatibile(src_node, patt_node):
                    if self.are_syntactically_feasible(src_node, patt_node):
                        if self.are_semantically_feasible(src_node, patt_node):
                            # Recursive call, adding the feasible state
                            newstate = self.state.__class__(self, src_node, patt_node)
                            for mapping in self._match():
                                yield mapping
    
                            # restore data structures
                            newstate.restore()
    
    def has_match(self, context={}):
        """
            Determines if the pattern graph can be matched on the source graph. 
            @param context: Optional predefined mapping {string:uuid}.
            @return: True if a match is found, False otherwise.
        """
        try:
            self.match_iter(context).next()
            return True
        except StopIteration:
            return False
    
    def match_iter(self, context={}):
        """
            Iterator over matchings of the pattern graph on the source graph.
            @param context: Optional predefined mapping {pattern node index: source node index}.
            @return: The mapping {pattern node index : source node index}.
        """
        self.initialize()
        for p in context:
            if self.are_semantically_feasible(context[p], p):
                self.state.__class__(self, context[p], p)
            else:
                # Additional constraints on the pivot nodes are not satisfied: no match is possible
                return
        for mapping in self._match():
            yield mapping


class HimesisMatcherState(object):
    """
        Internal representation of state for the HimesisMatcher class.
        
        This class is used internally by the HimesisMatcher class.  It is used
        only to store state specific data. There will be at most V(pattern graph) of
        these objects in memory at a time, due to the depth-first search
        strategy employed by the VF2 algorithm.
    """
    def __init__(self, matcher, src_node=None, patt_node=None):
        """
            Internal representation of state for the HimesisMatcher class.
            @param matcher: The HimesisMatcher object.
            @param src_node: The source node of the candidate pair.
            @param src_node: The pattern node of the candidate pair.
        """
        self.matcher = matcher

        # Initialize the last stored node pair.
        self.src_node = None
        self.patt_node = None
        self.depth = len(matcher.core_1)
        
        if src_node is None or patt_node is None:
            # Then we reset the class variables
            matcher.core_1 = {}
            matcher.core_2 = {}
            matcher.in_1 = {}
            matcher.in_2 = {}
            matcher.out_1 = {}
            matcher.out_2 = {}
            matcher.inout_1 = {}
            matcher.inout_2 = {}

        # Watch out! src_node == 0 should evaluate to True.
        if src_node is not None and patt_node is not None:
            # Add the node pair to the isomorphism mapping.
            matcher.core_1[src_node] = patt_node
            matcher.core_2[patt_node] = src_node
            
            # Store the node that was added last.
            self.src_node = src_node
            self.patt_node = patt_node
            
            # Now we must update the other four vectors.
            # We will add only if it is not in there already!
            self.depth = len(matcher.core_1)
            
            # First we add the new nodes...
            for vector in (matcher.in_1, matcher.out_1, matcher.inout_1):
                if src_node not in vector:
                    vector[src_node] = self.depth
            for vector in (matcher.in_2, matcher.out_2, matcher.inout_2):
                if patt_node not in vector:
                    vector[patt_node] = self.depth
                    
            # Now we add every other node...
            
            # Updates for T_1^{in}
            new_nodes_in = []
            for node in matcher.core_1:
                n = [predecessor for predecessor in matcher.G1.predecessors(node)
                     if predecessor not in matcher.core_1 and predecessor not in new_nodes_in]
                new_nodes_in += n
            for node in new_nodes_in:
                if node not in matcher.in_1:
                    matcher.in_1[node] = self.depth
                
            # Updates for T_1^{out}
            new_nodes_out = []        
            for node in matcher.core_1:
                n = [successor for successor in matcher.G1.successors(node)
                     if successor not in matcher.core_1 and successor not in new_nodes_out]
                new_nodes_out += n
            for node in new_nodes_out:
                if node not in matcher.out_1:                
                    matcher.out_1[node] = self.depth
            
            # Updates for T_1^{inout}
            for node in set(matcher.in_1.keys() + matcher.out_1.keys()):
                if node in matcher.out_1 and node in matcher.in_1 and node not in matcher.inout_1: 
                    matcher.inout_1[node] = self.depth
            
            # Updates for T_2^{in}
            new_nodes_in = []
            for node in matcher.core_2:
                n = [predecessor for predecessor in matcher.G2.predecessors(node)
                     if predecessor not in matcher.core_2 and predecessor not in new_nodes_in]
                new_nodes_in += n
            for node in new_nodes_in:
                if node not in matcher.in_2:
                    matcher.in_2[node] = self.depth
    
            # Updates for T_2^{out}
            new_nodes_out = []        
            for node in matcher.core_2:
                n = [successor for successor in matcher.G2.successors(node)
                     if successor not in matcher.core_2 and successor not in new_nodes_out]
                new_nodes_out += n
            for node in new_nodes_out:
                if node not in matcher.out_2:
                    matcher.out_2[node] = self.depth
            
            # Updates for T_2^{inout}
            for node in set(matcher.in_2.keys() + matcher.out_2.keys()):
                if node in matcher.out_2 and node in matcher.in_2 and node not in matcher.inout_2: 
                    matcher.inout_2[node] = self.depth
    
    def restore(self):
        """
            Deletes the HimesisMatcherState object and restores the class variables.
        """
        
        # First we remove the node that was added from the core vectors.
        # Watch out! src_node == 0 should evaluate to True.
        if self.src_node is not None and self.patt_node is not None:
            del self.matcher.core_1[self.src_node]
            del self.matcher.core_2[self.patt_node]

        # Now we revert the other four vectors.        
        # Thus, we delete all entries which have this depth level.
        for vector in (self.matcher.in_1, self.matcher.in_2, self.matcher.out_1, self.matcher.out_2, self.matcher.inout_1, self.matcher.inout_2):
            for node in vector.keys():
                if vector[node] == self.depth:
                    del vector[node]


class VF2(HimesisMatcher):
    """
        The native VF2 algorithm for subgraph isomorphism.
    """
    def __init__(self, G1, G2):
        """
            The native VF2 algorithm for subgraph isomorphism.
            @param G1: The bigger graph.
            @param G2: The smaller graph. 
        """
        HimesisMatcher.__init__(self, G1, G2)
    
    def match_iter(self):
        """
            Iterator over mappings of G2 on a subgraph of G1.
            @return: The mapping {pattern node uuid : source node uuid}.
        """
        for mapping in self.G1.get_subisomorphisms_vf2(self.G2):
            # mapping is a list for which mapping[i] is the source node index mapped to the pattern node index i
            # So we need to convert it into a dictionary  
            match = {}
            for pattern_node, src_node in enumerate(mapping):
                match[pattern_node] = src_node
            yield match


class SubgraphIsoMatcher(HimesisMatcher):
    """
        The VF2 algorithm for subgraph isomorphism as implemented in HimesisMatcher.
        Basically this is the same as HimesisMatcher but no node data is taken into consideration. 
    """
    def __init__(self, source_graph, pattern_graph, priority=Priority()):
        """
            The VF2 algorithm for subgraph isomorphism as implemented in HimesisMatcher.
            Basically this is the same as HimesisMatcher but no node data is taken into consideration. 
        """
        HimesisMatcher.__init__(self, source_graph, pattern_graph, priority)
    
    def are_compatibile(self, src_node, patt_node):
        """
            Verifies if a candidate pair is compatible.
            More specifically, verify degree compatibility.
            @param src_node: The candidate from the source graph.
            @param patt_node: The candidate from the pattern graph.
        """
        
        return (self.pred2[patt_node][0] <= self.pred1[src_node][0]
                and self.succ2[patt_node][0] <= self.succ1[src_node][0])
    
    def are_semantically_feasible(self, sourceNode, patternNode):
        """
            Since no data is considered, the graphs have no semantics.
            @param src_node: The candidate from the source graph.
            @param patt_node: The candidate from the pattern graph.
            @return: True always. 
        """
        return True
