'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import re, json, uuid, itertools
from .dcal import DesignerCodeAbstractionLayer
from .utils import Utilities as utils
from .tconstants import TConstants as TC
from .pytcore.core.himesis import Himesis, HConstants as HC
from .pytcore.core.himesis import HimesisPreConditionPatternLHS
from .pytcore.core.himesis import HimesisPreConditionPatternNAC
from .pytcore.core.himesis import HimesisPostConditionPattern


''' 
    implements an atompm-to-himesis model compiler and an 
    atompm-to-himesis rule compiler 
    
    _username            the user's username, needed to access files from user's
                              folder
    _aswid                the user's backend's aswid, needed to support httpreqs to
                            backend from rule code
    _defaultDCL            the user's preferred designer code language                        
    _subtypes            a mapping from metamodel types to their subtypes
    _connectorTypes    a set of known 'connector' fulltypes
    _knownMMs            a set of known metamodels (i.e., metamodels for which we've
                            computed subtype and connectorType information)
    _loadedMMs            a set of currently loaded (on the asworker) metamodels 
    _mmTypeData            a mapping of fulltypes to default attributes
    _dcal                     an instance of the DesignerCodeAbstractionLayer
    _compiledRules        a mapping between rule filenames and compiled data 

    *runtime configuration flags*
    RC__looseSubtypingMM        (see _computeSubtypes() for details) '''
class ModelAndRuleCompiler :
    def __init__(self,username,aswid,defaultDCL,mtwid) :
        self._username         = username
        self._aswid                 = aswid
        self._defaultDCL        = defaultDCL
        self._subtypes         = {}
        self._connectorTypes    = set()
        self._knownMMs            = set()
        self._loadedMMs        = set()
        self._mmTypeData        = {}
        self._mtwid            = mtwid;
        self._dcal                  = DesignerCodeAbstractionLayer(username,aswid,mtwid)
        self._compiledRules  = {}

        self.RC__looseSubtypingMM = None


    '''
        add a node to himesis graph 'hg' that reflects the contents of asworker
        node 'n' with id 'id' '''
    def addNode(self,hg,n,id) :
        newNodeIndex = \
            hg.add_node(n['$type'],n['$type'] in self._connectorTypes)
        hg.vs[newNodeIndex]['$atompmId'] = str(id)
        for attr in n :
            attr = str(attr)
            if attr.startswith('$') :
                hg.vs[newNodeIndex][attr] = n[attr]
            elif attr.startswith('____'):
                hg.vs[newNodeIndex][attr[2:]] = n[attr]['value']
            elif 'value' in n[attr]:
                hg.vs[newNodeIndex][attr] = n[attr]['value']

                #raise exception for default code in value
                default_code = '"[PYTHON]"\n"Example:\t result = True"\n"Example:\t result = getAttr()"\n\n"[JAVASCRIPT]"\n"Example:\t true"\n"Example:\t getAttr()"'
                if n[attr]['value'] == default_code:
                    raise RuntimeError("Error: Default code found in node labelled: " + str(n['$MT_label__']) + " of type " + n['$type'] )
        return newNodeIndex




    ''' 
        compile an atompm json model into a pytcore himesis graph 

        0. compute and store the relevant metamodels' subtypes and connector 
            types if we haven't already done so
        1. initialise a Himesis/HimesisPreConditionPatternLHS/... graph 'hg'
        2. in the special case where compileModel() is called as a result of a 
            user loading a model (i.e., from ptcal.loadModel(), detectable because
            himesisBaseClass==Himesis), we also (re)set self._loadedMMs to match 
            the given model's loaded metamodels
        3. if input model is empty, return 'hg'
        4. for each node in input model, create appropriate node in 'hg'
        5. for each edge in input model, create appropriate edge in 'hg'
        6. return 'hg' 

        NOTE: igraph.add_vertices() crashes when attribute names are unicode 
                strings (i.e., u'...')... this is why we convert attr names to
                ascii via 'attr = str(attr)' '''
    def compileModel(self,m,mmsData=None,name=None,himesisBaseClass=Himesis) :
        if m.__class__ != {}.__class__ :
            m = json.loads(m)

        if mmsData != None :
            if mmsData.__class__ != {}.__class__ :
                mmsData = json.loads(mmsData)
            for mm in mmsData :
                if mm not in self._knownMMs :
                    self.parseMetamodel(mm,mmsData[mm])
        else :
            for mm in m['metamodels'] :
                if mm not in self._knownMMs :
                    mmData = utils.fread(
                        '/users/%s/%s.metamodel'%(self._username,mm))
                    self.parseMetamodel(mm,mmData)

        hg = himesisBaseClass(name)
        hg[HC.METAMODELS] = set(m['metamodels'])
        hg[HC.MISSING_METAMODELS] = \
            lambda : hg[HC.METAMODELS] - self._loadedMMs
        hg[HC.GUID] = uuid.uuid4()

        if himesisBaseClass == Himesis :
            self._loadedMMs = hg[HC.METAMODELS].copy()

        if len(m['nodes']) == 0 :
            return hg

        atompmIds2himesisIndices = {}
        for id in m['nodes'] :
            atompmIds2himesisIndices[id] = self.addNode(hg,m['nodes'][id],id)

        for e in m['edges'] :
            hg.add_edges(
                [(atompmIds2himesisIndices[str(e['src'])],
                  atompmIds2himesisIndices[str(e['dest'])])])

        return hg



    '''
        compile one rule (this function defines a number of inner functions, see
        bottom for actual logic) given its atompm model 'r' and its filename 
        'fname'

        1. compile LHS, NACs and RHS into himesis graphs
        2. add remaining properties to compiled patterns (e.g., LHS.NACs) '''
    def compileRule(self,r,fname) :
        if fname in self._compiledRules :
            return self._compiledRules[fname]
        elif r == None :
            r = utils.fread('/users/%s/%s'%(self._username,fname))


        '''
            compile a pattern (e.g. LHS) into a himesis graph

            1. retrieve atompm model(s) of pattern(s) contents
            2. validate __pLabels
            3. foreach pattern>contents pair from step 1
                a) rename metamodels from (.*).pattern to just $1
                b) foreach node in contents
                    i.   rename type from (.*).pattern/__p(.*) to $1/$2
                    ii.  rename __pLabel to HC.MT_LABEL (and delete __pLabel attr)
                    iii. rename __pMatchSubtypes to HC.MT_SUBTYPE_MATCH, if any (and
                          delete __pMatchSubtypes)
                    (the model is now ready to be fed to compileModel)
                c) compile contents into himesis graph, 'hg'
                d) wrap attribute and pattern action/condition code into python 
                    functions

            NOTE: to complete pattern compilation, certain properties still need to
                    be added (e.g., pointer to NACs in LHS) '''
        def compilePattern(patternType,himesisBaseClass) :
            p2pcm = getPatternContents(patternType)
            ''' hergin :: motif-integration :: modify start '''
            if p2pcm==None or len(p2pcm)==0 or len(p2pcm.keys()) == 0 :
                ''' hergin :: motif-integration :: modify end '''
                return []

            res = validateLabels(p2pcm)
            if '$err' in res :
                return res

            hgs = []
            for p,pcm in p2pcm.items() :
                mms = []
                for mm in pcm['metamodels'] :
                    if re.search('.pattern$',mm):
                        mms.append(mm[:-len('.pattern')])
                    elif re.search('.ramified$',mm):
                        mms.append(mm[:-len('.ramified')])
                pcm['metamodels'] = mms

                for id in pcm['nodes'] :
                    n = pcm['nodes'][id]
                    matches = re.match('(.*)\.pattern/__p(.*)',n['$type']) or re.match('(.*)\.ramified/__p(.*)',n['$type'])
                    n['$type'] = matches.group(1)+'/'+matches.group(2)
                    n[HC.MT_LABEL] = n['__pLabel']['value']
                    del n['__pLabel']
                    ''' hergin :: motif-integration start '''
                    if '__pPivotIn' in n:
                        if n['__pPivotIn']['value']:
                            n[HC.MT_PIVOT_IN] = n['__pPivotIn']['value']
                        del n['__pPivotIn']
                    if '__pPivotOut' in n:
                        if n['__pPivotOut']['value']:
                            n[HC.MT_PIVOT_OUT] = n['__pPivotOut']['value']
                        del n['__pPivotOut']
                    ''' hergin :: motif-integration end '''
                    if 'value' in n['__pMatchSubtypes'] :
                        n[HC.MT_SUBTYPE_MATCH] = n['__pMatchSubtypes']['value']
                    del n['__pMatchSubtypes']

                hg = self.compileModel(
                    pcm,
                    name=fname+'_'+patternType,
                    himesisBaseClass=himesisBaseClass)

                if patternType == 'LHS' or patternType == 'NAC' :
                    wrapAttributeDesignerCode(hg,'attrCondition')
                    hg[HC.MT_CONSTRAINT] = r['nodes'][p]['Condition']['value']
                    wrapPatternConditionDesignerCode(hg)
                    for v in hg.vs :
                        v[HC.MT_DIRTY] = False
                        v[HC.MT_SUBTYPES] = (self._subtypes[v[HC.FULLTYPE]] if v[HC.FULLTYPE] in self._subtypes else [])
                elif patternType == 'RHS' :
                    wrapAttributeDesignerCode(hg,'attrAction')
                    hg[HC.MT_ACTION] = r['nodes'][p]['Action']['value']
                    wrapPatternActionDesignerCode(hg)
                elif patternType == 'RHSImport' :
                    def wrapImportedModelAttribute(val) :
                        return lambda arg1,arg2 : val
                    for v in hg.vs :
                        for attr,val in v.attributes().items() :
                            if Himesis.is_RAM_attribute(attr) and val != None :
                                v[attr] = wrapImportedModelAttribute(val)
                    hg[HC.MT_ACTION] = ''
                    wrapPatternActionDesignerCode(hg)

                hgs.append(hg)

            return hgs


        ''' 
            read in and slightly alter a model such that it can pass as a 
            traditional RHS's contents... this functions return format is
            this identical to that of getPatternContents(..)

            1. find the RHSImport node
            2. read in the model it refers to
            3. update each of that model's nodes s.t. 
                    a) they have valid __pLabels
                    b) they have empty __matchSubtypes
                    c) they have pattern types
            4. update each of that model's metamodels s.t. that become pattern 
                metamodels '''
        def getImportedModelAsPatternContents() :
            pc = {}
            for id in r['nodes'] :
                if re.search('/RHSImport$',r['nodes'][id]['$type']) :
                    pc[id] = utils.fread(
                        '/users/%s/%s'%(self._username,
                                        r['nodes'][id]['filename']['value']))

                    for nid in pc[id]['nodes'] :
                        n = pc[id]['nodes'][nid]
                        n['__pLabel'] = {'type':'string','value':'$IM_'+str(nid)}
                        n['__pMatchSubtypes'] = {}
                        matches = re.match('(.*)/(.*)',n['$type'])
                        n['$type'] = matches.group(1)+'.pattern/__p'+matches.group(2)
                    pc[id]['metamodels'] = \
                        [mm + '.pattern' for mm in pc[id]['metamodels']]
                    return pc


        ''' 
            return a dict of the form {...,id:contents,...} where 'id' describes a
              node of pattern-type 'pt' (e.g., LHS) and 'contents' is an atompm model
              that contains only 'id''s contents

            0. if 'pt' is not LHS, NAC, RHS, outsource operation 
            1. identify all nodes of type 'pt'
            2. return {} if no matches
            3. map each of step 1's results to every single node that is 
                [transitively] connected to it (except its PatternContents links)...
                  this effectively maps patterns to their contents
            4. based on results from step 3, map each match from step 1 to an 
                atompm model that contains only the pattern's contents
            5. return map from step 4 
            
            NOTE:: the outNeighbors() and getConnectedNodes() inner functions are
                     translated from identical javascript functions in 
                     mmmk.compileToIconDefinitionMetamodel
            '''
        def getPatternContents(pt) :
            if pt == 'RHSImport' :
                return getImportedModelAsPatternContents()

            def outNeighbors(source) :
                return [str(x['dest']) for x in [y for y in r['edges'] if y['src'] == source]]

            def getConnectedNodes(container,contents) :
                _contents = set()
                for n in outNeighbors(container) :
                    if not n in contents :
                        _contents.add(n)

                if len(_contents) == 0 :
                    return contents

                contents = contents | _contents
                return set(utils.flatten(
                    [getConnectedNodes(x, contents) for x in _contents]))

            pc = {}
            for id in r['nodes'] :
                if re.search('/'+pt+'$',r['nodes'][id]['$type']) :
                    pc[id] = []

            if len(pc) == 0 :
                return {}

            for p in pc :
                pc[p] = pc[p] = [x for x in getConnectedNodes(p,set()) if r['nodes'][x]['$type'] != TC.RULEMM+'/PatternContents']

                m = {'nodes':{},'edges':[],'metamodels':[]}
                mms = []
                for id in pc[p] :
                    m['nodes'][id] = r['nodes'][id]
                    mms.append( utils.getMetamodel(r['nodes'][id]['$type']) )
                m['metamodels'] = list(set(mms))
                m['edges'] = \
                    [e for e in r['edges'] if e['src'] in m['nodes']]
                pc[p] = m

            return pc


        ''' 
            ensure none of the nodes specified in the provided list of {patternId:
            patternContentsModel} have empty or duplicate __pLabels... return    error
              if any '''
        def validateLabels(p2pcm) :
            for p,pcm in p2pcm.items() :
                for id in pcm['nodes'] :
                    if '__pLabel' not in pcm['nodes'][id] :
                        return {'$err':'missing __pLabel attribute'}
                    l = pcm['nodes'][id]['__pLabel']['value']
                    if l == '' :
                        return {'$err':'empty __pLabel'}
                    elif len([x for x in pcm['nodes'] if pcm['nodes'][x]['__pLabel']['value'] == l]) > 1:
                        return {'$err':'duplicate __pLabel :: '+l}
            return {}


        '''
            store a function that evaluates designer-specified javascript attribute
              action/condition code as the value of every RAM attribute (i.e., of 
            every non-Himesis attribute or atompm $ attribute)
        
             NOTE: a little quirk of igraph is that all vertices have all attributes
                    (e.g., v1['a']=5, v2['b']=5 
                         >>  v1:{'a':5,'b':None}, v2:{'a':None,'b':6})... thus, we make
                    sure to only wrap 'real' attributes to avoid 'false' attributes
                      becoming non-None '''
        def wrapAttributeDesignerCode(hg,type) :
            ''' 
                return a python function that will properly execute designer-
                specified javascript action/condition code '''
            def wrap(code,pLabel,attr) :
                def evalAttrCode(pLabel2graphIndexMap,graph):
                    if code == '' :
                        if type == 'attrCondition':
                            return True
                        else :
                            return
                    ex = {}

                    try :
                        self._dcal.configure(
                            self._dcal.identifyLanguage(code) or self._defaultDCL,
                            graph,
                            type,
                            pLabel2graphIndexMap,
                            ex,
                            pLabel,
                            attr)
                        return self._dcal.eval(code)
                    except Exception as e :
                        if '$err' in ex :
                            raise RuntimeError(ex['$err'])
                        else :
                            raise RuntimeError( \
                                'unexpected error encountered while evaluating '+
                                type+' :: '+str(e))
                return evalAttrCode

            for v in hg.vs :
                for attr,code in v.attributes().items() :
                    if Himesis.is_RAM_attribute(attr) and code != None :
                        v[attr] = wrap(code,v[HC.MT_LABEL],attr)


        '''
            store a function that evaluates designer-specified javascript pattern
              action code as the value of pattern[MT_ACTION] '''
        def wrapPatternActionDesignerCode(hg) :
            def wrap(code) :
                def evalPatternCode(pLabel2graphIndexMap,graph):
                    if code == '' :
                        return []
                    journal = []
                    ex = {}

                    try :
                        self._dcal.configure(
                            self._dcal.identifyLanguage(code) or self._defaultDCL,
                            graph,
                            'patternAction',
                            pLabel2graphIndexMap,
                            ex,
                            journal=journal)
                        self._dcal.eval(code)
                        return journal
                    except Exception as e :
                        if '$err' in ex :
                            raise RuntimeError(ex['$err'])
                        else :
                            raise RuntimeError( \
                                'unexpected error encountered while evaluating '+
                                'pattern action code :: '+str(e))
                return evalPatternCode

            hg[HC.MT_ACTION] = wrap(hg[HC.MT_ACTION])


        '''
            store a function that evaluates designer-specified javascript pattern
              condition code as the value of pattern[MT_CONSTRAINT] '''
        def wrapPatternConditionDesignerCode(hg) :
            def wrap(code) :
                def evalPatternCode(pLabel2graphIndexMap,graph) :
                    if code == '' :
                        return True
                    ex = {}

                    try :
                        self._dcal.configure(
                            self._dcal.identifyLanguage(code) or self._defaultDCL,
                            graph,
                            'patternCondition',
                            pLabel2graphIndexMap,
                            ex)
                        return self._dcal.eval(code)
                    except Exception as e :
                        if '$err' in ex :
                            err_msg = str(ex['$err']) + " in filename: " + fname
                        else :
                            err_msg = 'unexpected error encountered while evaluating '+ \
                                'pattern condition code :: '+str(e) + " in filename: " + fname
                        raise RuntimeError(err_msg)
                return evalPatternCode

            hg[HC.MT_CONSTRAINT] = wrap(hg[HC.MT_CONSTRAINT])



        lhs  = compilePattern('LHS',HimesisPreConditionPatternLHS)
        if lhs.__class__ == {}.__class__ :
            raise ValueError(fname+' LHS compilation failed on :: '+lhs['$err'])

        nacs = compilePattern('NAC',HimesisPreConditionPatternNAC)
        if nacs.__class__ == {}.__class__ :
            raise ValueError(fname+' NAC compilation failed on :: '+nacs['$err'])

        rhs  = compilePattern('RHS',HimesisPostConditionPattern) or \
               compilePattern('RHSImport',HimesisPostConditionPattern)
        if rhs.__class__ == {}.__class__ :
            raise ValueError(fname+' RHS compilation failed on :: '+rhs['$err'])

        #lhs[0].NACs = nacs
        for nac in nacs :
            nac.LHS = lhs[0]
            nac.bridge = nac.compute_bridge()

        #lhs[0].NACs = nacs

        lhs[0].addNACs(nacs)

        ''' hergin :: motif-integration start '''
        ''' check condition for RHS for query rule '''
        if len(rhs)>0:
            rhs[0].pre = lhs[0]
            if lhs[0].vcount() > 0 :
                rhs[0].pre_labels = lhs[0].vs[HC.MT_LABEL]
            else :
                rhs[0].pre_labels = []

            self._compiledRules[fname] = {'lhs':lhs[0],'rhs':rhs[0]}
        else:
            self._compiledRules[fname] = {'lhs':lhs[0]}
        ''' hergin :: motif-integration end '''
        return self._compiledRules[fname]



    '''
        remember the types stored in the 'connectorTypes' property of the passed
          metamodel '''
    def _computeConnectorTypes(self,mm,mmData) :
        for ct in list(mmData['connectorTypes'].keys()) :
            self._connectorTypes.add(mm+'/'+ct)


    '''
        remember the information required to initialize nodes from any of mm's
        types to their default values '''
    def _computeMMTypeData(self,mm,mmData) :
        for type in mmData['types'] :
            fulltype = mm+'/'+type
            self._mmTypeData[fulltype] = {}
            for attr in mmData['types'][type] :

                # if there is no default, provide an empty string
                try:
                    self._mmTypeData[fulltype][attr['name']] = attr['default']
                except KeyError:
                    self._mmTypeData[fulltype][attr['name']] = ""


    '''
        using the 'types2parentTypes' property of the passed metamodel, construct
        and save a mapping of metamodel types to their subtypes 
        
        NOTE:: to EASE SEMANTICS SHARING (paramount when working with semantic
                   templates), we introduce the 'RC__looseSubtypingMM' compiler 
                 flag... it is used to allow mapToBaseFormalism semantics to be
                 seamlessly used by "looseSubtyping" DSLs... see example below:
                    1 mapToBaseFormalism rule:
                        match BasicState subtypes, produce BasicState
                    2 base formalism subtypes:
                        SimpleStateChart/BasicState subtypes = []
                    3 loose subtyping formalism subtypes:
                        MyDSL/BasicState subtypes = [AAA, BBB]
                    4 result
                        SimpleStateChart/BasicState subtypes = 
                            [MyDSL/BasicState, MyDSL/AAA, MyDSL/BBB]
                        >> rule can now match entities from MyDSL '''
    def _computeSubtypes(self,mm,mmData) :
        t2pt     = mmData['types2parentTypes']
        types = list(t2pt.keys())
        parents = set(itertools.chain.from_iterable(list(t2pt.values())))
        children = [t for t in types if t2pt[t] != []]
        for type in types :
            fulltype = mm+'/'+type
            if fulltype not in self._subtypes :
                self._subtypes[fulltype] = []
            if type in parents :
                for c in children :
                    if type in t2pt[c] :
                        self._subtypes[fulltype].append(mm+'/'+c)
            if self.RC__looseSubtypingMM and \
                    self.RC__looseSubtypingMM+'/'+type in self._subtypes :
                self._subtypes[fulltype].append(self.RC__looseSubtypingMM+'/'+type)
                self._subtypes[fulltype].extend(
                    self._subtypes[self.RC__looseSubtypingMM+'/'+type])


    '''
        forget all compiled rules '''
    def forgetCompiledRules(self) :
        self._compiledRules = {}



    '''
          return a reference to self._mmTypeData '''
    def getMMTypeData(self) :
        return self._mmTypeData



    '''
        compute and store the specified metamodel's default attributes, subtypes
          and connector types 

        1. if we already know 'mm' (e.g., user may be re-loading it or a newer 
            version of it),
            a) clear known subtypes for that 'mm' in-place... we do this clearing
                in-place (i.e., del L[:] vs. L = []) because compiled pattern nodes
                  have pointers to entries in self._subtypes... this implies that to
                  avoid having to recompile rules when we alter self._subtypes, 
                alterations made to existing entries need to preserve pointers
            b) clear known connector types for that 'mm'
        2. do the deed
        3. if 'loadMM' is specified (i.e., this function is called as a result of
            a user LOADMM changelog, not as a result of encountering an unknown 
            metamodel while compiling a rule '''
    def parseMetamodel(self,mm,mmData,loadMM=False) :
        if mm in self._knownMMs :
            for type in mmData['types'] :
                fulltype = mm+'/'+type
                if fulltype in self._subtypes :
                    self._subtypes[fulltype][:] = []
                if fulltype in self._connectorTypes :
                    self._connectorTypes.remove(fulltype)

        self._computeSubtypes(mm,mmData)
        self._computeConnectorTypes(mm,mmData)
        self._computeMMTypeData(mm,mmData)
        self._knownMMs.add(mm)
        if loadMM :
            self._loadedMMs.add(mm)



    '''
        remove a metamodel from the list of currently loaded (on the asworker) 
        metamodels '''
    def unloadMetamodel(self,mm):
        if mm in self._loadedMMs:
            self._loadedMMs.remove(mm)    
