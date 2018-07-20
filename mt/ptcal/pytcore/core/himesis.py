'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import uuid, copy, igraph as ig


class HConstants:
    '''
        Himesis constants must start with '$' to ensure there are no name clashes 
        with user-attributes (which are prohibited from starting with '$')
    '''
    GUID                      = '$GUID__'
    METAMODELS              = '$mms__'
    MISSING_METAMODELS = '$missing_mms__'
    FULLTYPE               = '$ft__'
    CONNECTOR_TYPE      = '$ct__'
    MT_LABEL              = '$MT_label__'
    MT_CONSTRAINT          = '$MT_constraint__'
    MT_ACTION              = '$MT_action__'
    MT_SUBTYPE_MATCH      = '$MT_subtypeMatching__'
    MT_SUBTYPES          = '$MT_subtypes__'
    MT_DIRTY              = '$MT_dirty__'
    MT_PIVOT_IN          = '$MT_pivotIn__'
    MT_PIVOT_OUT         = '$MT_pivotOut__'



class Himesis(ig.Graph):
    """
        Creates a typed, attributed, directed, multi-graph.
        @param num_nodes: the total number of nodes. If not known, you can add more vertices later
        @param edges: the list of edges where each edge is a tuple representing the ids of the source and target nodes
    """
    Constants = HConstants
    EDGE_LIST_THRESHOLD = 10**3


    @staticmethod
    def is_RAM_attribute(attr_name):
        return not attr_name.startswith('$')

    def __init__(self, name='', num_nodes=0, edges=[]):
        """
            Creates a typed, attributed, directed, multi-graph.
            @param name: the name of this graph
            @param num_nodes: the total number of nodes. If not known, you can add more vertices later
            @param edges: the list of edges where each edge is a tuple representing the ids of the source and target nodes
        """
        ig.Graph.__init__(self, directed=True, n=num_nodes, edges=edges)
        if not name:
            name = self.__class__.__name__
        self.name = name

        # mmTypeData: enables add_node() to properly initialize to-be nodes s.t. they reflect the default values specified by their metamodels
        # _guid2index: a fast lookup of the node's index by its guid
        # session: area which provides a clean and efficient way to remember information across rules
        self.mmTypeData = {}
        self._guid2index = {}
        self.session = {}

    def copy(self):
        cpy = ig.Graph.copy(self)
        cpy._guid2index = copy.deepcopy(self._guid2index)
        ''' hergin :: motif-integration FIX for mmTypeData bug '''
        cpy.mmTypeData = copy.deepcopy(self.mmTypeData)
        cpy.session = copy.deepcopy(self.session)

        cpy.name = copy.deepcopy(self.name)
        return cpy

    def __copy__(self):
        return self.copy()

    def __deepcopy__(self, memo):
        return self.__copy__()

    def __str__(self):
        s = super(Himesis, self).__str__()
        return self.name + ' ' + s[s.index('('):] + ' ' + str(self[Himesis.Constants.GUID])

    def get_id(self):
        """
            Returns the unique identifier of the graph
        """
        return self[Himesis.Constants.GUID]

    def node_iter(self):
        """
            Iterates over the nodes in the graph, by index
        """
        return range(self.vcount())

    def edge_iter(self):
        """
            Iterates over the edges in the graph, by index
        """
        return range(self.ecount())

    def add_node(self, fulltype=None, isConnector=None, newNodeGuid=None):
        newNodeIndex = self.vcount()
        if newNodeGuid == None :
            newNodeGuid = uuid.uuid4()
        self.add_vertices(1)
        self.vs[newNodeIndex][Himesis.Constants.GUID] = newNodeGuid
        self.vs[newNodeIndex][Himesis.Constants.FULLTYPE] = fulltype
        self.vs[newNodeIndex][Himesis.Constants.CONNECTOR_TYPE] = isConnector
        if fulltype in self.mmTypeData :
            for attr,val in self.mmTypeData[fulltype].items():
                self.vs[newNodeIndex][str(attr)] = val
        self._guid2index[newNodeGuid] = newNodeIndex
        return newNodeIndex

    def delete_nodes(self, nodes):
        self.delete_vertices(nodes)
        # Regenerate the lookup because node indices have changed
        self._guid2index = dict((self.vs[node][Himesis.Constants.GUID], node) for node in self.node_iter())

    def get_node(self,guid):
        """
            Retrieves the node instance with the specified guid
            @param guid: The guid of the node.
        """
        if guid in self._guid2index:
            if self._guid2index[guid] >= self.vcount() or \
                    self.vs[self._guid2index[guid]][Himesis.Constants.GUID] != guid :
                self._guid2index = dict((self.vs[node][Himesis.Constants.GUID], node) for node in self.node_iter())
            try:
                return self._guid2index[guid]
            except KeyError:
                #TODO: This should be a TransformationLanguageSpecificException
                raise KeyError('Invalid node id. Make sure to only delete nodes via Himesis.delete_nodes(): ' + str(guid))
        else :
            #TODO: This should be a TransformationLanguageSpecificException
            raise KeyError('Node not found with specified id. Make sure to only create nodes via Himesis.add_node(): ' + str(guid))

    def draw(self, visual_style={}, label=None, show_guid=False, show_id=False, debug=False, width=600, height=900):
        """
        Visual graphic rendering of the graph.
        @param label: The attribute to use as node label in the figure.
                      If not provided, the index of the node is used.
        @param visual_style: More drawing options
        (see http://igraph.sourceforge.net/doc/python/igraph.Graph-class.html#__plot__ for more details).
        """
        if 'layout' not in visual_style:
            visual_style["layout"] = 'fr'
        if 'margin' not in visual_style:
            visual_style["margin"] = 10

        # Set the labels
        if not label:
            if show_guid:
                visual_style["vertex_label"] = [str(self.vs[i][Himesis.Constants.GUID])[:4] for i in self.node_iter()]
            elif show_id:
                visual_style["vertex_label"] = [str(i) for i in self.node_iter()]
            else:
                visual_style["vertex_label"] = [''] *  self.vcount()
        else:
            try:
                visual_style["vertex_label"] = self.vs[label]
                for n in self.node_iter():
                    if not visual_style["vertex_label"][n]:
                        visual_style["vertex_label"][n] = self.vs[n][Himesis.Constants.FULLTYPE]
                        if debug:
                            visual_style["vertex_label"][n] = str(n) + ':' + visual_style["vertex_label"][n]
                    elif debug:
                        visual_style["vertex_label"][n] = str(n) + ':' + visual_style["vertex_label"][n]
            except:
                raise Exception('%s is not a valid attribute' % label)

        return ig.plot(self, bbox=(0, 0, width, height), **visual_style)

    def execute(self, *args):
        raise AttributeError('This method is not implemented')


class HimesisPattern(Himesis):
    def __init__(self, name='', num_nodes=0, edges=[]):
        super(HimesisPattern, self).__init__(name, num_nodes, edges)
        self.nodes_label = {}
        self.nodes_pivot_out = {}

    def get_node_with_label(self, label):
        """
            Retrieves the index of the node with the specified label.
            @param label: The label of the node.
        """
        if not self.nodes_label:
            self.nodes_label = dict([(self.vs[i][Himesis.Constants.MT_LABEL], i) for i in self.node_iter()])
        if label in self.nodes_label:
            return self.nodes_label[label]

    def get_pivot_out(self, pivot):
        """
            Retrieves the index of the pivot node
            @param pivot: The label of the pivot.
        """
        if not self.nodes_pivot_out and Himesis.Constants.MT_PIVOT_OUT in self.vs.attribute_names():
            self.nodes_pivot_out = dict([(i, self.vs[i][Himesis.Constants.MT_PIVOT_OUT]) for i in self.node_iter()])
        if pivot in self.nodes_pivot_out:
            return self.nodes_pivot_out[pivot]


class HimesisPreConditionPattern(HimesisPattern):
    def __init__(self, name='', num_nodes=0, edges=[]):
        super(HimesisPreConditionPattern, self).__init__(name, num_nodes, edges)
        self.nodes_pivot_in = {}

    def get_pivot_in(self, pivot):
        """
            Retrieves the index of the pivot node
            @param pivot: The label of the pivot.
        """
        if not self.nodes_pivot_in and Himesis.Constants.MT_PIVOT_IN in self.vs.attribute_names():
            self.nodes_pivot_in = dict([(self.vs[i][Himesis.Constants.MT_PIVOT_IN], i) for i in self.node_iter()])
        if pivot in self.nodes_pivot_in:
            return self.nodes_pivot_in[pivot]

    def constraint(self, mtLabel2graphIndexMap, graph):
        """
            If a constraint shall be specified, the corresponding Himesis graph must override this method.
            The condition must be specified in the pattern graph and not the input graph.
            By default, the constraint evaluates to True.
            @param PreMatch: The current match, before the rewriting.
            @param graph: The whole input graph.
        """
        raise NotImplementedError('Use graph[Himesis.Constants.MT_CONSTRAINT]() instead')


class HimesisPreConditionPatternLHS(HimesisPreConditionPattern):
    def __init__(self, name='', num_nodes=0, edges=[]):
        super(HimesisPreConditionPatternLHS, self).__init__(name, num_nodes, edges)
        self.NACs = []
        self.bound_start_index = 0  # index of first bound NAC in NACs list

    def addNAC(self, nac):
        """
            Appends the NAC to this LHS pattern
        """
        if nac.LHS != self:
            nac.LHS = self
        if nac.bridge is None:
            nac.bridge = nac.compute_bridge()
        self.NACs.append(nac)

    def addNACs(self, NACs):
        """
            Stores the list of NACs in decreasing order of their size
            @param nacs: list of NACs
            @postcondition: the NACs will be stored in decreasing order of their bridge sizes
        """
        bound = []
        unbound = []
        for nac in NACs:
            nac.LHS = self
            nac.bridge_size = nac.compute_bridge()
            if nac.bridge_size > 0:
                bound.append(nac)
            else:
                unbound.append(nac)
        bound.sort(key=lambda nac: (nac.bridge_size, nac.vcount()), reverse=True)
        unbound.sort(key=lambda nac: nac.vcount(), reverse=True)
        self.NACs = unbound + bound
        self.bound_start_index = len(unbound)

    def getUnboundNACs(self):
        return self.NACs[:self.bound_start_index]

    def getBoundNACs(self):
        return self.NACs[self.bound_start_index:]

    def hasBoundNACs(self):
        return self.bound_start_index < len(self.NACs)


class HimesisPreConditionPatternNAC(HimesisPreConditionPattern):
    def __init__(self, LHS=None, name='', num_nodes=0, edges=[]):
        super(HimesisPreConditionPatternNAC, self).__init__(name, num_nodes, edges)
        self.LHS = LHS
        self.bridge_size = 0

    def set_bridge_size(self):
        """
            Computes the bridge and stores the number of its nodes.
        """
        if self.LHS is None:
            raise Exception('Missing LHS to compute bridge')
        self.bridge_size = self.compute_bridge().vcount()

    def compute_bridge(self):
        """
            Creates a HimesisPreConditionPattern defined as the intersection of graph with this instance.
            This is called the 'bridge'.
            From a topological point of view, this method computes the largest common subgraph of these two graphs.
            However, the similarity of nodes of the bridge relies on the meta-model type of the nodes. 
            Furthermore, every attribute value is the conjunction of the constraints defined in each graph.
        """
        # G1 is the smallest graph and G2 is the bigger graph
        G1 = self
        G2 = self.LHS
        if G1.vcount() > G2.vcount():
            # Swap
            G1, G2 = G2, G1
        # The bridge
        G = HimesisPreConditionPattern()
        G[Himesis.Constants.GUID] = uuid.uuid4()

        # We don't need to actually solve the largest common subgraph (LCS) problem
        # because we assume that the nodes are labelled uniquely in each graph
        # and that if a label is in G1 and in G2, then it will be in G
        if len(G1.vs) == 0:
            return G

        Labels2 = G2.vs[Himesis.Constants.MT_LABEL]
        for label in G1.vs[Himesis.Constants.MT_LABEL]:
            if label in Labels2:
                # Get the corresponding node from G1 
                v1 = G1.vs.select(lambda v : v[Himesis.Constants.MT_LABEL] == label)
                if len(v1) == 1:
                    v1 = v1[0]
                elif len(v1) == 0:
                    #unreachable line...
                    raise Exception('Label does not exist :: ' + str(label))
                else:
                    raise Exception('Label is not unique :: ' + str(label))
                # Get the corresponding node from G2
                v2 = G2.vs.select(lambda v : v[Himesis.Constants.MT_LABEL] == label)
                if len(v2) == 1:
                    v2 = v2[0]
                elif len(v2) == 0:
                    # Unreachable line...
                    raise Exception('Label does not exist :: ' + str(label))
                else:
                    raise Exception('Label is not unique :: ' + str(label))
                newNodeIndex = G.add_node()
                # Now do a conjunction of the attributes
                for attr in v1.attribute_names():
                    G.vs[newNodeIndex][attr] = v1[attr]
                for attr in v2.attribute_names():
                    # The attribute is not in v1
                    if attr not in G.vs[newNodeIndex].attribute_names():
                        G.vs[newNodeIndex][attr] = v2[attr]
                    # Give this node its own GUID attribute
                    elif attr == Himesis.Constants.GUID:
                        G.vs[newNodeIndex][Himesis.Constants.GUID] = uuid.uuid4()
                        continue
                    # Ignore non-RAM attributes ('special' and HConstants attributes)
                    elif not Himesis.is_RAM_attribute(attr):
                        continue
                    # Handle normal attribute
                    else :
                        if not v2[attr]:
                            # There is no constraint for this attribute
                            continue

                        # The attribute constraint code is the conjunction of the LHS constraint
                        # with the NAC constraint for this attribute
                        def get_evalAttrConditions(_attr,_v1,_v2) :
                            def evalAttrConditions(mtLabel2graphIndexMap,graph):
                                return G1.vs[_v1][_attr](mtLabel2graphIndexMap, graph) and \
                                       G2.vs[_v2][_attr](mtLabel2graphIndexMap, graph)
                            return evalAttrConditions
                        G.vs[newNodeIndex][attr] = get_evalAttrConditions(attr,v1.index,v2.index)
                    #else: v1[attr] == v2[attr], so we don't need to do anything more 
        # Now add the edges
        # We only need to go through the edges of the smaller graph
        for e in G1.edge_iter():
            src_label = G1.vs[G1.es[e].source][Himesis.Constants.MT_LABEL]
            tgt_label = G1.vs[G1.es[e].target][Himesis.Constants.MT_LABEL]
            src = G.vs.select(lambda v : v[Himesis.Constants.MT_LABEL] == src_label)
            tgt = G.vs.select(lambda v : v[Himesis.Constants.MT_LABEL] == tgt_label)
            if len(src) == len(tgt) == 1:
                src = src[0]
                tgt = tgt[0]
                G.add_edges([(src.index, tgt.index)])
            elif len(src) == 0 :
                #                raise Exception('Label does not exist :: '+str(src_label))
                pass
            elif len(tgt) == 0 :
                #                raise Exception('Label does not exist :: '+str(tgt_label))
                pass
            elif len(src) > 1 :
                raise Exception('Label is not unique :: ' + str(src_label))
            elif len(tgt) > 1 :
                raise Exception('Label is not unique :: ' + str(tgt_label))
        return G



class HimesisPostConditionPattern(HimesisPattern):
    def __init__(self, name='', num_nodes=0, edges=[]):
        super(HimesisPostConditionPattern, self).__init__(name, num_nodes, edges)
        self.pre = None

    def action(self, mtLabel2graphIndexMap, graph):
        """
        If an action shall be specified, the corresponding Himesis graph must override this method.
        The action must be specified in the pattern graph and not the input graph.
        """
        raise NotImplementedError('Use graph[Himesis.Constants.MT_ACTION]() instead')

    # This method implements the rewriting part of the rule.
    '''    
        NOTE 
            certain rule applications may have side-effects that aren't caused by
            the rewriting per se... at present, the only instance of this is when a
              rule produces entities of a formalism not loaded on the asworker... in 
            this case, we prepend appropriate {'op':'LOADMM','name':...} entries to
            packet.deltas 
            

        NOTE     
            when creating new nodes, information about the match is bundled so that
            the said new nodes' icons get created near the icons of nodes matched
            in the LHS 
            
        
        NOTE
            deletes must be performed last because they alter igraph indices and 
            which we use to map __pLabels to source graph nodes... however, to 
            avoid violating maximum association multiplicities, deletes in the 
            source model must be performed first... thus, RM* operations, if any,
            are placed at the start of packet.deltas 
    '''
    def execute(self, packet, match):
        graph = packet.graph

        # Changes to packet.graph are logged in packet.deltas
        packet.deltas = []

        # Init deltas with rule side-effects (see NOTE)
        for mm in self[Himesis.Constants.MISSING_METAMODELS]() :
            packet.deltas.append({'op':'LOADMM','name':mm})


        # Set the attributes of graph.vs[graphNodeIndex] to match those of self.vs[rhsNodeIndex]
        def set_attributes(rhsNodeIndex, graphNodeIndex, newNode, pLabel2graphIndexMap) :
            changedSomething = False
            for attrName in self.vs[rhsNodeIndex].attribute_names() :
                if Himesis.is_RAM_attribute(attrName) :
                    attrVal = self.vs[rhsNodeIndex][attrName]
                    if attrVal == None :
                        # Not 'really' an attribute
                        continue
                    oldVal = None
                    if not newNode :
                        oldVal = graph.vs[graphNodeIndex][attrName]
                    try :
                        newVal = self.vs[rhsNodeIndex][attrName](pLabel2graphIndexMap, graph)
                        if oldVal != newVal :
                            graph.vs[graphNodeIndex][attrName] = newVal
                            packet.deltas.append(
                                {'op':'CHATTR',
                                 'guid':graph.vs[graphNodeIndex][Himesis.Constants.GUID],
                                 'attr':attrName,
                                 'old_val':oldVal,
                                 'new_val':newVal})
                            changedSomething = True
                    except Exception as e :
                        raise Exception("An error has occurred while computing the value of the attribute '%s' :: %s" % (attrName, e))
            return changedSomething

        # Build a dictionary {label: node index} mapping each label of the pattern to a node in the graph to rewrite.
        # Because of the uniqueness property of labels in a rule, we can store all LHS labels
        # and subsequently add the labels corresponding to the nodes to be created.
        labels = match.copy()

        # Update attribute values
        LHS_labels = self.pre_labels
        for label in LHS_labels:
            rhsNodeIndex = self.get_node_with_label(label)
            if rhsNodeIndex is None:
                continue        # not in the interface graph (LHS n RHS)
            if set_attributes(rhsNodeIndex, labels[label], False, labels) :
                graph.vs[labels[label]][Himesis.Constants.MT_DIRTY] = True

        # Create new nodes (non-connectors first)
        if self.vcount() == 0 :
            RHS_labels = []
        else :
            RHS_labels = self.vs[Himesis.Constants.MT_LABEL]
            # sort non-connectors first
            RHS_labels.sort(key=lambda x: self.vs[ self.get_node_with_label(x) ][Himesis.Constants.CONNECTOR_TYPE] or False)
            neighborhood = [graph.vs[labels[l]].attributes() for l in LHS_labels]

        new_labels = []
        for label in RHS_labels:
            rhsNodeIndex = self.get_node_with_label(label)
            if label not in LHS_labels:
                new_labels += [label]
                newNodeIndex = graph.add_node(
                    self.vs[rhsNodeIndex][Himesis.Constants.FULLTYPE],
                    self.vs[rhsNodeIndex][Himesis.Constants.CONNECTOR_TYPE])
                packet.deltas.append(
                    {'op':'MKNODE',
                     'neighborhood':neighborhood,
                     'guid':graph.vs[newNodeIndex][Himesis.Constants.GUID]})
                labels[label] = newNodeIndex
                set_attributes(rhsNodeIndex, newNodeIndex, True, labels)

        # Link new nodes (Create new edges)
        visited_edges = []
        for label in sorted(new_labels):
            for edge in self.es.select(lambda e: (e.index not in visited_edges and
                                                  (label == self.vs[e.source][Himesis.Constants.MT_LABEL] or
                                                   label == self.vs[e.target][Himesis.Constants.MT_LABEL]))):
                src_label = self.vs[edge.source][Himesis.Constants.MT_LABEL]
                tgt_label = self.vs[edge.target][Himesis.Constants.MT_LABEL]
                graph.add_edges([(labels[src_label], labels[tgt_label])])
                packet.deltas.append(
                    {'op':'MKEDGE',
                     'guid1':graph.vs[labels[src_label]][Himesis.Constants.GUID],
                     'guid2':graph.vs[labels[tgt_label]][Himesis.Constants.GUID]})
                visited_edges.append(edge.index)

        # Set the output pivots
        if Himesis.Constants.MT_PIVOT_OUT in self.vs.attribute_names():
            for node in self.vs.select(lambda v: v[Himesis.Constants.MT_PIVOT_OUT]):
                node = node.index
                label = self.vs[node][Himesis.Constants.MT_LABEL]
                pivot_out = self.vs[node][Himesis.Constants.MT_PIVOT_OUT]
                packet.global_pivots[pivot_out] = graph.vs[labels[label]][Himesis.Constants.GUID]

        # Perform the post-action
        try:
            packet.deltas.extend(self[Himesis.Constants.MT_ACTION](labels, graph))
        except Exception as e:
            raise Exception('An error has occurred while applying the post-action', e)

        # Delete nodes (automatically deletes adjacent edges)
        labels_to_delete = []
        rmnodes = []
        rmedges = []
        for label in LHS_labels:
            if label not in RHS_labels:
                labels_to_delete.append(labels[label])
                rmnodes.append({'op':'RMNODE','attrs':graph.vs[labels[label]].attributes()})
                for edge in graph.es.select(lambda e: (labels[label] == e.source or labels[label] == e.target)) :
                    found = False
                    for rmedge in rmedges :
                        if rmedge['guid1'] == graph.vs[edge.source][Himesis.Constants.GUID] and \
                                rmedge['guid2'] == graph.vs[edge.target][Himesis.Constants.GUID] :
                            found = True
                            break
                    if not found :
                        rmedges.append({'op':'RMEDGE',
                                        'guid1':graph.vs[edge.source][Himesis.Constants.GUID],
                                        'guid2':graph.vs[edge.target][Himesis.Constants.GUID]})
        if len(labels_to_delete) > 0 :
            packet.deltas = rmedges + rmnodes + packet.deltas
            graph.delete_nodes(labels_to_delete)

            ''' hergin :: motif-integration start :: remove the deleted nodes from pivots list '''
            for uuid in packet.global_pivots:
                deleted=False
                for toBeDeleted in rmnodes:
                    if toBeDeleted['attrs']['$GUID__'] == packet.global_pivots[uuid]:
                        del packet.global_pivots[uuid]
                        deleted=True
                        continue
                if deleted:
                    continue
            ''' hergin :: motif-integration end '''  
