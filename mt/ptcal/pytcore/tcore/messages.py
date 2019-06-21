'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import copy, traceback
from ..core.himesis import Himesis

# Abstract class
class Message(object): pass


class TransformationException(Message, Exception):
    class ExceptionStatus:
        ACTIVE = 'active'
        HANDLING = 'handling'
        HANDLED = 'handled'
    '''
        The model of an exception occurrence.
    '''
    def __init__(self, instance=None, msg=''):
        super(Exception, self).__init__()
        self.inner_exception = instance
        self.msg = msg
        if instance and msg == '':
            self.msg = self.inner_exception.args[0]
        self.detail = ''
        if instance and len(self.inner_exception.args) > 1:
            self.detail = self.inner_exception.args[1]
        self.packet = None
        self.start_time = 0
        self.end_time = 0
        self.status = TransformationException.ExceptionStatus.ACTIVE
        self.transformation_unit = None
        self.transformation_context = None
        if instance:
            self.transformation_context = traceback.format_exc()
        self.debug_msg = """%s: %s
Detail: %s
Status: %s
Start: %f  - End: %f
Packet: %s
Unit: %s
Context:%s
""" % (self.inner_exception.__class__.__name__, self.msg, self.detail,
       self.status, self.start_time, self.end_time, self.packet,
       self.transformation_unit, self.transformation_context)

    def __str__(self):
        #        return self.debug_msg
        return self.msg + '\n' + str(self.transformation_context)


class Cancel(Message):
    '''
        This message is used to cancel the current activity of a primitive.
    '''
    def __init__(self):
        self.exclusions = []    # the primitives to not be cancelled

    def __str__(self):
        return 'Cancel - exclusion = %s' % self.exclusions



class Packet(Message):
    '''
        Holds the current graph and the different matches.
    '''
    def __init__(self, graph=None):
        self.graph = graph               # the source graph
        self.deltas = []                 # holds the modifications produced by a rule    
        self.match_sets = {}             # holds of the matches for each pre-condition pattern already matched
        self.current = None              # points to the guid identifying the current match set
        self.global_pivots = Pivots()    # {pivot name: source node guid}

    def __str__(self):
        ms = ''.join(['''
        %s: %s''' % (k, self.match_sets[k]) for k in sorted(self.match_sets)])
        if ms == '':
            ms = str(None)
        s = '''Packet (%s)
    graph: %s
    deltas: %s
    match_sets: %s
    pivots: %s''' % (self.current, self.graph, self.deltas, ms, self.global_pivots)
        return s

    def clone(self):
        cpy = Packet()
        cpy.graph = self.graph.copy()
        cpy.deltas = self.deltas[:]
        cpy.global_pivots = copy.copy(self.global_pivots)
        cpy.current = self.current
        cpy.match_sets = copy.deepcopy(self.match_sets)
        return cpy

    def copy_readonly(self):
        cpy = Packet()
        cpy.graph = self.graph
        cpy.deltas = self.deltas
        cpy.global_pivots = copy.copy(self.global_pivots)
        cpy.current = self.current
        cpy.match_sets = copy.deepcopy(self.match_sets)
        return cpy

    def copy_state(self, conditionId):
        cpy = Packet()
        cpy.graph = self.graph.copy()
        cpy.deltas = self.deltas[:]
        cpy.global_pivots = copy.copy(self.global_pivots)
        cpy.current = self.current
        if conditionId in self.match_sets:
            cpy.match_sets = {conditionId: copy.copy(self.match_sets[conditionId])}
        return cpy

    def set_state(self, packet):
        self.graph = packet.graph
        self.deltas = packet.deltas
        self.global_pivots = packet.global_pivots
        self.current = packet.current
        if packet.match_sets is not None:
            self.match_sets.update(packet.match_sets)

    def clear_state(self):
        self.deltas = []
        self.match_sets = {}
        self.current = None
        self.global_pivots = Pivots()

    def __copy__(self):
        return self.copy_readonly()

    def __deepcopy__(self, memo):
        return self.__copy__()

    #    def get_curr_matchset(self):
    #        return self.match_sets[self.current]
    #
    #    def get_match2rewrite(self, condition):
    #        return self.match_sets[condition].matches[self.match_sets[condition].match2rewrite]
    #
    #    def get_curr_match2rewrite(self):
    #        return self.match_sets[self.current].matches[self.match_sets[self.current].match2rewrite]
    #
    #    def remove_match2rewrite(self, condition):
    #        # Remove the match to rewrite
    #        del self.match_sets[condition].matches[self.match_sets[condition].match2rewrite]
    #        # If the corresponding match set has become empty, remove it too
    #        if len(self.match_sets[condition].matches) == 0:
    #            del self.match_sets[condition]
    #
    #    def get_local_pivots(self):
    #        return self.match_sets[self.current].matches[self.match_sets[self.current].match2rewrite].local_pivots

    def clean(self):
        '''
            Unflags dirty matches
        '''
        for cond in self.match_sets:
            for match in self.match_sets[cond].matches:
                match.clean(self)


class MatchSet:
    '''
        Holds the different matches of a pre-condition.
    '''
    def __init__(self):
        self.match2rewrite = None   # the selected match to be transformed
        self.matches = []           # TODO: should it be a generator?
    # TODO: Should we store all the matches and let the iterator explicitly choose one randomly? Or rely on the matching algorithm and save memory space?

    def __str__(self):
        s = '''MatchSet (%s): %s''' % (self.match2rewrite, self.matches)
        return s

    def __copy__(self):
        cpy = MatchSet()
        cpy.match2rewrite = self.match2rewrite
        cpy.matches = [copy.copy(match) for match in self.matches]
        return cpy

    def __deepcopy__(self, memo):
        cpy = MatchSet()
        cpy.match2rewrite = self.match2rewrite
        cpy.matches = [copy.deepcopy(match) for match in self.matches]
        return cpy



class Match(dict):
    '''
        Wraps the mapping from the label of a pre-condition pattern model element
        to the node index of the corresponding source model element.
    '''
    def __init__(self):
        super(Match, self).__init__()   # {pattern node label : source node guid}
        self.local_pivots = Pivots()    # {pivot name : source node guid}

    def __copy__(self):
        cpy = copy.copy(super(Match, self))
        cpy.local_pivots = copy.copy(self.local_pivots)
        return cpy

    def __deepcopy__(self, memo):
        cpy = copy.deepcopy(super(Match, self))
        cpy.local_pivots = copy.deepcopy(self.local_pivots)
        return cpy

    def is_dirty(self, packet):
        '''
            Determines whether a source model element is dirty.
            @param packet: The packet on which the mappings are bound.
        '''
        for v in self.values():
            node = packet.graph.get_node(v)
            node = packet.graph.vs[node]
            if node is not None:
                # Check dirty flag
                if Himesis.Constants.MT_DIRTY in node.attribute_names() and node[Himesis.Constants.MT_DIRTY]:
                    return True
            else:
                # It was deleted
                return True
        return False

    def clean(self, packet):
        for v in self.values():
            node = packet.graph.get_node(v)
            node = packet.graph.vs[node]
            if node and Himesis.Constants.MT_DIRTY in node.attribute_names():
                node[Himesis.Constants.MT_DIRTY] = False

    def to_label_mapping(self, source_graph):
        '''
            Converts the match to a mapping dictionary {label: source node index}.
        '''
        mapping = {}
        for label in self.keys():
            try:
                sourceNode = source_graph.get_node(self[label])
            except KeyError:
                raise Exception('The matched node %s does not exist' % label)
            if sourceNode is not None:
                mapping[label] = sourceNode
            else:
                raise Exception('The matched node %s does not exist' % label)
        return mapping

    def to_mapping(self, source_graph, pattern_graph):
        '''
            Converts the match to a mapping dictionary {pattern node index: source node index}.
        '''
        mapping = {}
        for label in self.keys():
            patternNode = pattern_graph.get_node_with_label(label)
            if patternNode is not None:
                sourceNode = source_graph.get_node(self[label])
                mapping[patternNode] = sourceNode
        return mapping

    def from_mapping(self, mapping, source_graph, pattern_graph):
        '''
            Extracts all matches from a mapping dictionary {pattern node index: source node index}
            and adds them to this object in the form {pattern label: source node guid}.
            Relevant pivots are also extracted.
        '''
        for pattern_node in mapping:
            #print "Pattern Graph: ", pattern_graph
            #print "len(Pattern Graph.vs): ", pattern_graph.vcount()
            #print "Pattern Node: ", pattern_node
            if pattern_node < pattern_graph.vcount():
                #print "Pattern Graph.vs[pattern_node]: ", pattern_graph.vs[pattern_node]
                label = pattern_graph.vs[pattern_node][Himesis.Constants.MT_LABEL]
                guid = source_graph.vs[mapping[pattern_node]][Himesis.Constants.GUID]
                self[label] = guid

        self.local_pivots.from_mapping(mapping, source_graph, pattern_graph)



class Pivots(dict):
    '''
        Wraps the binding from a pivot name to a source model element.
    '''
    def __init__(self):
        super(Pivots, self).__init__()     # {pivot name : source node guid}
        self.has_source_node_indices = False

    def __copy__(self):
        cpy = copy.copy(super(Pivots, self))
        cpy.has_source_node_indices = self.has_source_node_indices
        return cpy

    def __deepcopy__(self, memo):
        cpy = copy.deepcopy(super(Pivots, self))
        cpy.has_source_node_indices = self.has_source_node_indices
        return cpy

    def to_source_node_indices(self, source_graph):
        for p in self.keys():
            sourceNode = source_graph.get_node(self[p])
            self[p] = sourceNode
        self.has_source_node_indices = True

    def to_mapping(self, source_graph, pattern_graph):
        '''
            Converts the pivots to a mapping dictionary {pattern node index: source node index}.
        '''
        mapping = {}
        if not self.has_source_node_indices:
            for p in self.keys():
                patternNode = pattern_graph.get_pivot_in(p)
                if patternNode is not None:
                    sourceNode = source_graph.get_node(self[p])
                    mapping[patternNode] = sourceNode
        else:
            for p in self.keys():
                patternNode = pattern_graph.get_pivot_in(p)
                if patternNode is not None:
                    mapping[patternNode] = self[p]
        return mapping

    def from_mapping(self, mapping, source_graph, pattern_graph):
        '''
            Extracts all pivots from a mapping dictionary {pattern node index: source node index}
            and adds them to this object in the form {pivot name: source node guid}.
        '''
        for p in mapping:
            pivot = pattern_graph.get_pivot_out(p)
            if pivot is not None:
                guid = source_graph.vs[mapping[p]][Himesis.Constants.GUID]
                if guid is not None:
                    self[pivot] = guid
                else:
                    #TODO: This should be a TransformationLanguageSpecificException
                    raise Exception('The bound node has no Guid')


# Define the nil packet
NIL_PACKET = Packet()
