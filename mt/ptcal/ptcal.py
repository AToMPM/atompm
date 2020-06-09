'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import re, json, uuid, threading, itertools, traceback, logging, sys

if sys.version_info[0] < 3:
    import cPickle as pickle
    import StringIO as StringIO
    from Queue import *
    from _abcoll import Iterable
else:
    import pickle as pickle
    import io as StringIO
    from queue import *

from random import Random
from .utils import Utilities as utils
from .tcontext import ModelTransformationContext, ExhaustContext
from .tconstants import TConstants as TC
from .compiler import ModelAndRuleCompiler
from .pytcore.core.himesis import HConstants as HC
from .pytcore.rules.ndarule import NDARule
from .pytcore.tcore.messages import Packet
from .accurate_time import time as clock
from .accurate_time import set_start_time
set_start_time()

import cProfile, pstats

''' hergin :: motif-integration start '''
from .motifcontext import MotifContext
from .tcorecontext import TCoreContext
from .pytcore.tcore.messages import Pivots
''' hergin :: motif-integration end '''

import igraph as ig
#import pydot
import datetime
from random import *
from threading import *

from .barrier import *
from .synchgraph import *
from itertools import *
#from petrinet import *

from pprint import isreadable
from math import *

import os

''' 
    py-t-core abstraction layer 
    
    _lock                               used to synchronize access to self._changelogs
    _changelogs                     used to hold asworker changelogs
    _M                                  the himesis graph we're transforming
    _mtContexts                     the current transformation contexts
    _transfData                     a mapping between transformation filenames and 
                                        their data  
    _userTransfs                    stores the transformations loaded by the user 
                                        (needed to return to the pre-run state after 
                                        running)
    _execmode                       the current execution mode 
    _debugOn                            indicates whether or not debugging is enabled
    _debugProgrammedBreak       a blocking flag used to freeze the execution of a
                                        transformation until the user explicitly resumes,
                                        at which point we continue precisely where we left
                                        off
    _mtContexts2debugClients    used to map ModelTransformationContexts to their 
                                        associated atompm debugging window, if any
    _aswCommTools                   bundle of properties and functions that enable and
                                        facilitate sending requests to our parent 
                                        mtworker's asworker
    _aswNextSequenceNumber      used to determine if a changelog is received out
                                        of order, and if a pending changelog is now ready
                                        to be handled
    username                            the user's username 
    defaultDCL                      the user's preferred designer code language '''
class PyTCoreAbstractionLayer :
    def __init__(self,aswCommTools,mtwid) :
        self._lock                         = threading.Condition()
        self._changelogs                   = []
        self._M                            = None
        ''' hergin :: motif-integration start '''
        self.packet                        = None
        self.globalDeltas                  = []
        self.incUpdates                     = True
        self.sendDeltas                    = True
        ''' hergin :: motif-integration end '''
        self._mtContexts                   = []
        self._transfData                   = {}
        self._userTransfs              = []
        self._execmode                     = 'STOPPED'
        self._debugOn                      = False
        self._debugProgrammedBreak     = threading.Event()
        self._debugProgrammedBreak.set()
        self._mtContexts2debugClients = {}
        self._aswCommTools             = aswCommTools
        self._aswNextSequenceNumber   = None
        self.username                      = None
        self.defaultDCL                 = TC.PYTHON
        self._mtwid                 = mtwid


        ''' Used only in COMP 522 and comp 621
        Petri Net Modules, docomposition of disconnected
        _M graph '''
        self.modules = {}
        ''' Synchronization graph for modular state spaces '''
        self.SG = None
        self.modStart = None
        self.modEnd = None
        self.flatStart = None
        self.flatEnd = None
        ''' State spaces for individual modules '''
        self.modIDtoPOS= {}
        self.SSs = {}
        #Enactment vars
        self.bdapiQueue = Queue()
        #Enactment, If this is true the OpenModel will append model to the canvas, else reload.
        self.loadedModel=False
        #Enactment, set of formalisms we load automatically to do the cleanups.
        self._loadedMMs = set()

    def processQuery(self,query):
        result = ""
        query = query['query'].replace('"',"'")
        qValue = query.split('(')[0].strip()

        if qValue == "getCount":
            typ = query.split("'")[1].strip()
            def f(e):
                return e['$ft__'].endswith(typ)
            result = "Number of '" + typ +"' in the resulting graph: " + str(len(filter(f,self.packet.graph.vs)))
            # I tried to use self.packet.graph.vs.select(tokens_eq=3) but the attribute names starting with $ didnt let me

        elif qValue == "toggleSendDelta":
            self.sendDeltas = not self.sendDeltas
            if self.sendDeltas:
                result = "Deltas will be sent at the end!"
            else:
                result = "Deltas won't be sent at the end!"

        elif qValue == "toggleIncUpdate":
            self.incUpdates = not self.incUpdates
            if self.incUpdates:
                result = "Incremental updates are on!"
            else:
                result = "Incremental updates are off!"

        self._aswPrintReq(result)

    ''' Use this to put the BDAPI response from client'''
    def _queueBDAPI(self,resp):
        self.bdapiQueue.put(resp)
    ''' send a PUT /GET/console request to the asworker '''
    def _aswPrintReq(self,msg) :
        return self._aswCommTools['httpReq']('PUT','/GET/console',{'text':msg})



    '''
        do 'callback()' once we've received the feedback for the last step that
        ran, if any, checking for the said feedback and handling any newly 
        received feedback   every TC.WAIT_ON_CHLOG_DELAY seconds '''
    def _doWhenLastStepFeedbackReceived(self,callback) :
        if self.incUpdates:
            def condition() :
                self._handleChangelogs()
                return self._mtContexts[-1].isLastStepFeedbackReceived()
            utils.doWhen(
                condition,
                TC.WAIT_ON_CHLOG_DELAY,
                callback)
        else:
            callback()


    '''
        synchronously verify if any changelogs have been received, and if we are 
        ready to handle them, remove them from self._changelogs and handle them

        1. sort changelogs by ascending sequence#
        2. do nothing if no self._changelogs is empty, if no model has been loaded
            yet (i.e., self._aswNextSequenceNumber == None), or if the oldest 
            changelog is still too new to be handled
        3. crash if we encouter an invalid sequence#
        4. otherwise (we're ready to handle the oldest changelog), handle the 
            oldest changelog, increment self._aswNextSequenceNumber and recurse
            back to step 1

        TBI: performance would benefit greatly from caches that map atompm ids to
              GUIDs '''
    def _handleChangelogs(self) :

        '''
            handle a single changelog '''
        def _handleChangelog(changelog) :
            def eq(a,b) : return str(a) == str(b)

            for c in changelog :
                if c['op'] == 'MKEDGE' :
                    node1 = \
                        self._M.vs.select(lambda v : eq(v['$atompmId'],c['id1']))[0]
                    node2 = \
                        self._M.vs.select(lambda v : eq(v['$atompmId'],c['id2']))[0]
                    self._M.add_edges([(node1.index, node2.index)])

                elif c['op'] == 'RMEDGE' :
                    pass

                elif c['op'] == 'MKNODE' :
                    self._compiler.addNode(self._M, json.loads(c['node']), c['id'])

                elif c['op'] == 'RMNODE' :
                    node = \
                        self._M.vs.select(lambda v : eq(v['$atompmId'],c['id']))[0]
                    self._M.delete_nodes([node.index])

                elif c['op'] == 'CHATTR' :
                    node = \
                        self._M.vs.select(lambda v : eq(v['$atompmId'],c['id']))[0]
                    self._M.vs[node.index][c['attr']] = c['new_val']

                elif c['op'] == 'LOADMM' :
                    self._compiler.parseMetamodel(
                        c['name'],
                        utils.fread(
                            '/users/%s/%s.metamodel'%(self.username,c['name'])),
                        loadMM=True)

                elif c['op'] == 'DUMPMM' :
                    self._compiler.unloadMetamodel(c['name'])

                elif c['op'] == 'RESETM' :
                    self._M = self._compiler.compileModel(c['new_model'])
                    self._M.mmTypeData = self._compiler.getMMTypeData()

                elif c['op'] == 'SYSOUT' :
                    ''' hergin :: motif-integration :: modify :: added startsWith functions '''
                    if c['text'].startswith(TC.RULE_SUCCESS_MSG) or \
                            c['text'].startswith(TC.RULE_NOT_APPLICABLE_MSG) or \
                            c['text'].startswith(TC.RULE_FAILURE_MSG) or \
                            c['text'].startswith(TC.TRANSFORMATION_DONE) or \
                            c['text'].startswith(TC.REMOTE_APPLICATION_FAILURE) :
                        self._mtContexts[-1].setLastStepFeedbackReceived()


        self._lock.acquire()
        self._changelogs.sort(key=lambda c : utils.sn2int(c['sequence#']))
        if len(self._changelogs) == 0 or \
                self._aswNextSequenceNumber == None or \
                utils.sn2int(self._changelogs[0]['sequence#']) > \
                utils.sn2int(self._aswNextSequenceNumber) :
            self._lock.release()
        else :
            sn = self._changelogs[0]['sequence#']
            if utils.sn2int(sn) < utils.sn2int(self._aswNextSequenceNumber) :
                raise ValueError('invalid changelog sequence# :: '+sn)
            else :
                logging.debug('++ ('+sn+') '+str(self._changelogs[0]['changelog']))
                _handleChangelog(self._changelogs.pop(0)['changelog'])
                self._aswNextSequenceNumber = \
                    utils.incrementSequenceNumber(self._aswNextSequenceNumber)
                self._lock.release()
                self._handleChangelogs()



    '''
        load a model (and its metamodels)

        1. compile the provided model into a himesis graph and save it to self._M
        2. synchronize self._M's mmTypeData with that of self._compiler's so that
            it gets updated as new metamodels are loaded
        3. initialize self._aswNextSequenceNumber based on the sequence# 'sn' of
            the provided model, and forget any already received out-of-date 
            changelogs

        NOTE: this function should only get called once (when the asworker 
                initially sets up this mtworker) '''
    def loadModel(self,m,mms,sn) :
        assert self._M == None, 'ptcal.loadModel() should only be called once'
        self._compiler = ModelAndRuleCompiler(
            self.username,
            self._aswCommTools['wid'],
            self.defaultDCL,
            self._mtwid)
        self._M = self._compiler.compileModel(m,mmsData=mms)
        self._M.mmTypeData = self._compiler.getMMTypeData()
        ''' hergin :: motif-integration start '''
        self.packet = Packet(self._M)
        ''' hergin :: motif-integration end '''
        self._aswNextSequenceNumber = utils.incrementSequenceNumber(sn)
        self._lock.acquire()
        self._changelogs = \
            [c for c in self._changelogs if utils.sn2int(sn) < utils.sn2int(c['sequence#'])]
        self._lock.release()

    '''
        load a PN model (and its metamodels)

        1. compile the provided model into a himesis graph and save it to self._M
        2. synchronize self._M's mmTypeData with that of self._compiler's so that
            it gets updated as new metamodels are loaded
        3. initialize self._aswNextSequenceNumber based on the sequence# 'sn' of
            the provided model, and forget any already received out-of-date 
            changelogs

        NOTE: this function should only get called once (when the asworker 
                initially sets up this mtworker) '''
    def loadModelPN(self,m,mms,sn) :
        assert self._M == None, 'ptcal.loadModel() should only be called once'
        self._compiler = ModelAndRuleCompiler(self.username)
        self._M = self._compiler.compileModelPN(m,mmsData=mms)
        disjoint = self._M.decompose(mode=ig.WEAK)
        #create dictionary of modules
        for mod in disjoint:
            self.modules [ uuid.uuid4()] = mod
        self._M.mmTypeData = self._compiler.getMMTypeData()
        self._aswNextSequenceNumber = utils.incrementSequenceNumber(sn)
        self._lock.acquire()
        self._changelogs = \
            [c for c in self._changelogs if utils.sn2int(sn) < utils.sn2int(c['sequence#'])]
        self._lock.release()



    ''' setup internal state to reflect given runtime configuration '''
    def _loadRuntimeConfiguration(self,rc) :
        if 'looseSubtypingMM' in rc :
            self._compiler.RC__looseSubtypingMM = rc['looseSubtypingMM']



    '''
        read in some json that describes a model transformation from file 'fname',
        store in self._transfData, and push a new ModelTransformationContext onto
        self._mtContexts '''
    def _loadTransform(self,fname) :
        if fname not in self._transfData :
            self._transfData[fname] = \
                utils.fread('/users/%s/%s'%(self.username,fname))

        ''' hergin :: motif-integration start '''
        if TC.MOTIFMM in self._transfData[fname]['metamodels']:
            self._mtContexts.append(MotifContext(fname,self))
        elif TC.TCOREMM in self._transfData[fname]['metamodels']:
            self._mtContexts.append(TCoreContext(fname,self))
        elif TC.TRANSFMM in self._transfData[fname]['metamodels']:
            self._mtContexts.append(ModelTransformationContext(self._transfData[fname],fname))
        ''' hergin :: motif-integration end '''



    '''
        load a set of user-specified transformations and forget anything 
        previously loaded
        
        1. forget previously loaded transformations and compiled rules
        2. reset 'session' area
        3. load transformations
        4. remember loaded transformations '''
    def loadTransforms(self,fnames) :
        self._transfData    = {}
        self._mtContexts    = []
        self._compiler.forgetCompiledRules()
        self._M.session = {}

        for fname in fnames :
            self._loadTransform(fname)
        self._userTransfs = fnames



    ''' 
        returns the filename and compiled form of the next rule to run
        
        1. fetch the current transformation context
        2. retrieve and load runtime configuration options, if any
        3. if transformatio debugging is enabled and we're entering a 
            ModelTransformationContext for the first time, we
            a) remember self._execmode and set self._execmode to PAUSE
            b) notify the user of the impending "programmed debugging pause"
            c) request a new atompm instance loaded with the transformation model
                corresponding to the current transformation context
            d) unset the _debugProgrammedBreak flag and make a blocking call that
                waits for another thread to reset it (via 
                self._startDebugProgrammedBreak())... this may occur in a number of
                cases if when this occurs
                i.   user presses stop --> self._execmode == 'STOPPING' : 
                        _nextRule() returns an error which in turn triggers the 
                        stopping of the current transformation
                ii.  user disables debugging --> self._execmode == 'PAUSE' : 
                        self._execmode is restored to its previous value and execution
                        continues as planned (i.e., _nextRule() returns with the next 
                        rule to run)
                iii. user presses play/step --> self._execmode == 'PLAY/STEP' : 
                        same behaviour as ii.                       
        4. call its nextStep() function to get the next transformation step
            a) if the step is not an object (i.e., is an application code)
                i. if there is more than 1 loaded transformation context, 
                    j.   pop the newly completed transformation context
                    jj.  if the next context (which may be a "parent" transformation
                          or the next of multiple loaded transformations) is a parent,
                          update its last step application info
                   jjj. make a recursive call to get the next rule to run from 
                          within the "next" context
                ii. otherwise, simply return the said application code              
            b) if the step is an error, return it
            c) otherwise, determine the type of the step (via the node's $type 
                attribute or by inspecting the 'metamodels' array in the provided 
                .model file) 
                    i.  Rules get stored in 'nr' to be later returned 
                    ii. Transformations and Exhausts[Randoms] cause the pushing of a
                         new transformation context onto self._mtContexts, and of a
                         recursive call to get the next rule to run from within that
                         new context      
        5. return the rule name and compiled form 
        
        NOTE:: in step 4c), while in debug mode, we highlight transformations, 
                 exhausts and rules before recursing on them or returning them,
                 respectively '''
    def _nextRule(self) :
        mtc = self._mtContexts[-1]
        self._loadRuntimeConfiguration(mtc.getRuntimeConfiguration())

        if self._debugOn and not mtc.isTransformationUnderWay() and \
                (type(mtc) == MotifContext or type(mtc) == TCoreContext) : # hergin :: motif-integration modify
            _execmode = self._execmode
            self._execmode = 'PAUSE'
            self._aswPrintReq(TC.DEBUGGING_HALT)
            self._requestClientDebugWindow(mtc.fname)
            self._startDebugProgrammedBreak()
            if self._execmode == 'STOPPING' :
                return {'$err':'transformation stopped during debugging pause'}
            elif self._execmode == 'PAUSE' or \
                    self._execmode == 'PLAY'  or \
                    self._execmode == 'STEP' :
                self._execmode = _execmode
        self.bdapiQueue = Queue()
        ns = mtc.nextStep()

        if ns.__class__ != {}.__class__ :
            if len(self._mtContexts) > 1 :
                self._mtContexts = self._mtContexts[:-1]
                if self._mtContexts[-1].isTransformationUnderWay() :
                    self._mtContexts[-1].setLastStepApplicationInfo(ns)
                return self._nextRule()
            else :
                return ns

        elif '$err' in ns :
            return ns['$err']

        else :
            def highlightUpcomingStep() :
                for _mtc in reversed(self._mtContexts) :
                    if id(_mtc) in self._mtContexts2debugClients :
                        debugClient = self._mtContexts2debugClients[id(_mtc)]
                        self._requestNodeHighlight(
                            debugClient['host'],
                            debugClient['aswid'],
                            _mtc.getCurrentStepId())
                        break

            if 'id' in ns :
                fulltype = mtc.t['nodes'][ns['id']]['$type']

                ''' hergin :: motif-integration start '''
                if fulltype == mtc.metamodel+"/CRule":
                    if self._debugOn :
                        highlightUpcomingStep()

                    self._loadTransform(ns['rule'])

                    return self._nextRule()

                elif fulltype.startswith(TC.TCOREMM) or \
                        fulltype.startswith(TC.MOTIFMM):
                    if self._debugOn :
                        highlightUpcomingStep()

                    return ns
                    ''' hergin :: motif-integration end '''

                elif fulltype == TC.TRANSFMM+'/Rule' :
                    if self._debugOn :
                        highlightUpcomingStep()

                    return {'fname':ns['fname'],
                            'cr':self._compiler.compileRule(None,ns['fname'])}

                #Enactment OpenModel blob, pathToFormalism is present is MM, but not used here,
                #for functionality of opening window with formalisms is in WriteModel.
                #pathToFormalism should be removed from MM for OpenModel (was not removed due to 
                #language evolution).
                elif fulltype == TC.TRANSFMM+'/OpenModel' :
                    if self._debugOn :
                        highlightUpcomingStep()
                    fname = mtc.t['nodes'][ns['id']]['pathToModel']['value']
                    #formalism = mtc.t['nodes'][ns['id']]['pathToFormalism']['value']
                    formalism = ""
                    return {'fname':fname,'formalism':formalism,'rtype':'OpenModel'}
                #Enactment WriteModel blob
                elif fulltype == TC.TRANSFMM+'/WriteModel' :
                    if self._debugOn :
                        highlightUpcomingStep()
                    fname = mtc.t['nodes'][ns['id']]['pathToModel']['value']
                    formalism = mtc.t['nodes'][ns['id']]['pathToFormalism']['value']
                    return {'fname':fname,'formalism':formalism,'rtype':'WriteModel'}
                elif fulltype == TC.TRANSFMM+'/Transformation' :
                    if self._debugOn :
                        highlightUpcomingStep()

                    self._loadTransform(ns['fname'])
                    return self._nextRule()

                elif fulltype == TC.TRANSFMM+'/Exhaust' :
                    self._mtContexts.append( ExhaustContext(mtc.t,ns['id']) )
                    return self._nextRule()

                elif fulltype == TC.TRANSFMM+'/ExhaustRandom' :
                    self._mtContexts.append( ExhaustContext(mtc.t,ns['id'],self._randomGen) )
                    return self._nextRule()
            else :

                ''' hergin :: motif-integration start '''
                if 'trafoResult' in ns:
                    return ns;
                    ''' hergin :: motif-integration end '''

                contents = utils.fread('/users/%s/%s'%(self.username,ns['fname']))

                if self._debugOn :
                    highlightUpcomingStep()

                if TC.RULEMM in contents['metamodels'] :
                    return {'fname':ns['fname'],
                            'cr':self._compiler.compileRule(contents,ns['fname'])}

                elif TC.TRANSFMM in contents['metamodels'] :
                    self._transfData[ns['fname']] = contents
                    self._loadTransform(ns['fname'])
                    return self._nextRule()

                raise ValueError( \
                    'file does not contain valid rule or transformation '+ \
                    'model :: '+ns['fname'])


    ''' Enactment do OpenModel magic
    '''
    def runOpenModelRule(self, fname="",formalism=""):
        unload = ""
        if not fname:
            return (None,TC.FAILED)
        else:
            if not formalism:
                self._aswPrintReq('auto loading model :: '+fname)
                try:
                    with open(os.getcwd()+'/users/'+self.username+fname) as f:
                        pass
                except IOError as e:
                    self._aswPrintReq('failed opening a file :: '+fname)
                    return (None,TC.FAILED)
                if not self.loadedModel:
                    method = '_loadModelForTransform'
                    if len(self._loadedMMs) == 0:
                        self._loadedMMs = self._compiler._loadedMMs.copy()
                    diff = self._compiler._loadedMMs.difference(self._loadedMMs)
                    for u in diff:
                        unload += u+'.defaultIcons.metamodel,'
                else:
                    method = '_appendModelForTransform'
                resp = self._aswCommTools['httpReq'](
                    'PUT',
                    '/GET/console',
                    {'text':'CLIENT_BDAPI :: '+
                            '{"func":"'+method+'",'+
                            ' "args":'+
                            '{"fname":"'+fname+'",'+
                            '"unload":"'+unload+'",'+
                            ' "callback-url":"/__mt/bdapiresp?wid='+
                            self._aswCommTools['wid']+'"}}'})
                resp = self.bdapiQueue.get(block=True,timeout=5000)
                if not resp['resp'] == 'ok':
                    return (None,TC.FAILED)
                else:
                    if not self.loadedModel:
                        self.loadedModel = True
                    return (None,TC.SUCCEEDED)
            #Was used to open new window with loaded formalisms and pause the transform, now 
            #this functionality is in WriteMOdel.       
            else:
                pass
    #               Keep for now....
    #               self._aswPrintReq('pausing transform')
    #               self._execmode = 'PAUSE'
    #               self._aswPrintReq('opening new window for manual step:: '+fname)
    #               try:
    #                   with open(os.getcwd()+'/users/'+self.username+fname) as f:
    #                       exists = 'true'
    #               except IOError as e:
    #                       exists = 'false'
    #               resp = self._aswCommTools['httpReq'](
    #               'PUT',
    #               '/GET/console',
    #               {'text':'CLIENT_BDAPI :: '+
    #                   '{"func":"_createEmptyModelInNewWindow",'+
    #                   ' "args":'+
    #                       '{"fname":"'+fname+'","exists":"'+exists+'",'+'"formalism":"'+formalism+'",'
    #                       ' "callback-url":"/__mt/bdapiresp?wid='+
    #                               self._aswCommTools['wid']+'"}}'})
    #               self.loadedModel = False
    #               return (None,TC.SUCCEEDED)

    ''' Enactment do WriteModel magic
    '''
    def runWriteModelRule(self,fname="",formalism=""):
        if not fname:
            #this makes next openmodel call a load model instead of append.
            #basically use this trick to clean up canvas and have new model: 
            #first place WriteModel blob without fname,
            #followed by OpenModel. 
            self.loadedModel = False
            return (None,TC.SUCCEEDED)
        else:
            #No formalism specified, save model
            if not formalism:
                self._aswPrintReq('auto saving model :: '+fname)
                resp = self._aswCommTools['httpReq'](
                    'PUT',
                    '/GET/console',
                    {'text':'CLIENT_BDAPI :: '+
                            '{"func":"_writeModelAfterTransform",'+
                            ' "args":'+
                            '{"fname":"'+fname+'",'+
                            ' "callback-url":"/__mt/bdapiresp?wid='+
                            self._aswCommTools['wid']+'"}}'})
                #Need to wait for the model to load.
                resp = self.bdapiQueue.get(block=True,timeout=5000)
                if resp['resp'] == 'ok':
                    self.loadedModel = False
                    return (None,TC.SUCCEEDED)
                else:
                    (None,TC.FAILED)
            #Formalism specified, open new window, with loaded formalism and/or model.
            else:
                self._aswPrintReq('pausing transform')
                self._execmode = 'PAUSE'
                self._aswPrintReq('opening new window for manual step:: '+fname)
                try:
                    with open(os.getcwd()+'/users/'+self.username+fname) as f:
                        #open existing model
                        exists = 'true'
                except IOError as e:
                    #or save model with the fname provided
                    exists = 'false'
                resp = self._aswCommTools['httpReq'](
                    'PUT',
                    '/GET/console',
                    {'text':'CLIENT_BDAPI :: '+
                            '{"func":"_createEmptyModelInNewWindow",'+
                            ' "args":'+
                            '{"fname":"'+fname+'","exists":"'+exists+'",'+'"formalism":"'+formalism+'",'
                                                                                                    ' "callback-url":"/__mt/bdapiresp?wid='+
                            self._aswCommTools['wid']+'"}}'})
                self.loadedModel = False
                return (None,TC.SUCCEEDED)


    '''
        synchronously save 1 changelog into self._changelogs '''
    def onchangelog(self,c) :
        self._lock.acquire()
        self._changelogs.append(c)
        self._lock.release()



    '''
        causes the execution of the current transformation(s) to pause (by 
        preventing _play()'s next call to _step(), if any) '''
    def pause(self) :
        self._execmode = 'PAUSE'

        if not self.incUpdates:
            req = self.buildEditHttpReq(self.globalDeltas)
            self.globalDeltas = []
            resp = self._aswCommTools['httpReq']('POST','/batchEdit',req)
            if not utils.isHttpSuccessCode(resp['statusCode']) :
                self.stop()
                self._aswPrintReq(TC.REMOTE_APPLICATION_FAILURE + resp['reason'])
                return
            self._handleChangelogs()



    '''
        play()
        calls _play() if it isn't already running (i.e., if we're already in PLAY
        mode, a timed call to _play() has already been placed) and if there isn't
        already another thread currently paused on _debugProgrammedBreak... if 
        there is such a thread, it is unpaused (via _stopDebugProgrammedBreak())
        and the current thread terminates immediately           


        _play()
        schedules an action for when feedback from the last step is received... 
        the action is
            1. return if we're no longer in PLAY mode
            2. take one _step()
            3. schedule a recursive call to _play() in TC.INTER_RULE_DELAY 
                seconds '''
    def play(self) :

        self.start_time = clock()
        if self._execmode == 'STOPPED':
            self._randomGen = Random(0)
        if self._execmode != 'PLAY' :
            self._execmode = 'PLAY'
            if not self._stopDebugProgrammedBreak() :
                self._play()
    def _play(self) :
        if self.incUpdates:
            self._doWhenLastStepFeedbackReceived(
                lambda : self._execmode == 'PLAY' and \
                         self._step() and \
                         utils.setTimeout(TC.INTER_RULE_DELAY,self._play))
        else:
            self._doWhenLastStepFeedbackReceived(
                lambda : self._execmode == 'PLAY' and \
                         self._step() and \
                         self._play())



    ''' 
        associate the newly created debugging window described by 'clientInfo'
        to the ModelTransformationContext that requested its creation '''
    def registerDebugClient(self,clientInfo) :
        clientInfo = json.loads(clientInfo)
        for mtc in reversed(self._mtContexts) :
            if hasattr(mtc,'fname') and mtc.fname == clientInfo['fname'] :
                self._mtContexts2debugClients[id(mtc)] = clientInfo



    ''' 
        request a new atompm client via the client backdoor API... the new client
        will be loaded with the specified model and sufficient information to 
        identify and communicate with the client will be POSTed to the callback 
        url '''
    def _requestClientDebugWindow(self,fname) :
        return self._aswCommTools['httpReq'](
            'PUT',
            '/GET/console',
            {'text':'CLIENT_BDAPI :: '+
                    '{"func":"_loadModelInNewWindow",'+
                    ' "args":'+
                    '{"fname":"'+fname+'",'+
                    ' "callback-url":"/__mt/debugClient?wid='+
                    self._aswCommTools['wid']+'"}}'})



    '''
        request that the specified node from the specified atompm instance be 
        highlighted '''         
    def _requestNodeHighlight(self,host,aswid,asid,timeout=1000) :
        return utils.httpReq(
            'PUT',
            host,
            '/GET/console?wid='+aswid,
            {'text':'CLIENT_BDAPI :: '+
                    '{"func":"_highlight",'+
                    ' "args":'+
                    '{"asid":"'+asid+'",'+
                    ' "timeout":'+str(timeout)+'}}'})

    ''' hergin :: motif-integration :: START :: put this to outside of step function '''
    ''' also added self '''

    '''
        go through a rule's deltas and (1) produce a batchEdit request, and 
        (2) undo them

        NOTE: we undo the deltas for 2 reasons
                1. so that changes become driven by asworker changelogs (like in 
                    csworkers)
                2. so that we don't need to figure out which entries in received
                    changelogs correspond to user-operations and which ones 
                    correspond to the effects of the constructed batchEdit 
        NOTE: since we sometimes need to use the result from one request as the
                parameter of another (i.e., create a node, update *it*), we use
                the 'mknodes' map to remember which requests created which new 
                nodes... this also allows to know which nodes already exist and
                which ones were created by the last rule 
        NOTE: because creation of connector nodes and their linking to their 
                ends is described in non-contiguous deltas, we use the 'mknodes'
                map to remember incomplete connector creation requests until the
                appropriate MKEDGE deltas are encountered '''
    def buildEditHttpReq(self,deltas) :
        reqs             = []
        mknodes          = {}
        neighborhood = None

        '''
            construct an atompmId given a node... the result will be
            a) a 'macro' to be replaced by the result of an earlier request 
                within the batchEdit, if the node was created by the last rule
            b) the atompmId stored within the node, if the node already has 
                a counter-part in atompm '''
        def atompmInstanceId(node) :
            if node[HC.GUID] in mknodes :
                return '$'+str(mknodes[node[HC.GUID]])+'$'
            else :
                return node['$atompmId']


        for d in deltas :
            if d['op'] == 'RMNODE' :
                reqs.append({ \
                    'method':'DELETE',
                    'uri':d['attrs'][HC.FULLTYPE]+'/'+ \
                          d['attrs']['$atompmId']+'.instance'})

            elif d['op'] == 'MKNODE' :
                mknodes[d['guid']] = len(reqs)
                node = self._M.vs[self._M.get_node(d['guid'])]
                if neighborhood == None :
                    neighborhood = neighborhood = [n[HC.FULLTYPE]+'/'+n['$atompmId']+'.instance' for n in d['neighborhood']]
                if node[HC.CONNECTOR_TYPE] :
                    reqs.append({ \
                        'method':'POST',
                        'uri':node[HC.FULLTYPE]+'.type',
                        'reqData':
                            {'src':None,
                             'dest':None,
                             'hitchhiker':
                                 {'segments':None,
                                  'asSrc':None,
                                  'asDest':None,
                                  'neighborhood':neighborhood}}})
                else :
                    reqs.append({ \
                        'method':'POST',
                        'uri':node[HC.FULLTYPE]+'.type',
                        'reqData':{'hitchhiker':{'neighborhood':neighborhood}}})

            elif d['op'] == 'RMEDGE' :
                pass

            elif d['op'] == 'MKEDGE' :
                def isConnectorMKNODE(req):
                    return 'dest' in req['reqData']

                if d['guid1'] in mknodes :
                    req = reqs[ mknodes[d['guid1']] ]
                    if isConnectorMKNODE(req) :
                        node2 = self._M.vs[self._M.get_node(d['guid2'])]
                        id      = atompmInstanceId(node2)
                        req['reqData']['dest'] = \
                            req['reqData']['hitchhiker']['asDest'] = \
                            node2[HC.FULLTYPE]+'/'+id+'.instance'

                if d['guid2'] in mknodes :
                    req = reqs[ mknodes[d['guid2']] ]
                    if isConnectorMKNODE(req) :
                        node1 = self._M.vs[self._M.get_node(d['guid1'])]
                        id      = atompmInstanceId(node1)
                        req['reqData']['src'] = \
                            req['reqData']['hitchhiker']['asSrc'] = \
                            node1[HC.FULLTYPE]+'/'+id+'.instance'

            elif d['op'] == 'CHATTR' :
                node = self._M.vs[self._M.get_node(d['guid'])]
                id   = atompmInstanceId(node)
                reqs.append({ \
                    'method':'PUT',
                    'uri':node[HC.FULLTYPE]+'/'+id+'.instance',
                    'reqData':{'changes':{d['attr']:d['new_val']}}})

            elif d['op'] == 'LOADMM' :
                reqs.append({ \
                    'method':'PUT',
                    'uri':'/current.metamodels',
                    'reqData':
                        {'mm':'/%s%s.metamodel'%(self.username,d['name'])}})
        if self.incUpdates:
            for d in reversed(deltas) :
                if d['op'] == 'RMNODE' :
                    newNodeIndex = self._M.add_node(newNodeGuid=d['attrs'][HC.GUID])
                    for attr,val in d['attrs'].items() :
                        self._M.vs[newNodeIndex][attr] = val

                elif d['op'] == 'MKNODE' :
                    node = self._M.vs[self._M.get_node(d['guid'])]
                    self._M.delete_nodes([node.index])

                elif d['op'] == 'RMEDGE' :
                    node1 = self._M.vs[self._M.get_node(d['guid1'])]
                    node2 = self._M.vs[self._M.get_node(d['guid2'])]
                    self._M.add_edges([(node1.index, node2.index)])

                elif d['op'] == 'MKEDGE' :
                    pass

                elif d['op'] == 'CHATTR' :
                    node = self._M.vs[self._M.get_node(d['guid'])]
                    node[d['attr']] = d['old_val']

                elif d['op'] == 'LOADMM' :
                    pass
        ''' hergin :: motif-integration modify: succeeded rule name + time '''
        #reqs.append({\
        #        'method':'PUT',
        #        'uri':'/GET/console',
        #        'reqData':{'text':TC.RULE_SUCCESS_MSG+" ("+self._mtContexts[-1]._lastStep['alias']+":"+self._mtContexts[-1]._lastStep['name']+") in "+str(self._mtContexts[-1]._lastStep['time'])}})
        #        'reqData':{'text':TC.RULE_SUCCESS_MSG}})
        return reqs

    ''' hergin :: motif-integration :: END :: put this to outside of step function '''

    '''
        author: hergin
        sendAndApplyDelta()
        If debug mode:
            Sends and applies the inputted deltas to the model and UI instance.
        else:
            Collect deltas in a globalDeltas variable to handle later
    '''
    def sendAndApplyDelta(self,deltas):
        if self.incUpdates:
            req  = self.buildEditHttpReq(deltas)
            resp = self._aswCommTools['httpReq']('POST','/batchEdit',req)
            if not utils.isHttpSuccessCode(resp['statusCode']) :
                self.stop()
                self._aswPrintReq(TC.REMOTE_APPLICATION_FAILURE + resp['reason'])
                return
            self._handleChangelogs()
        else:
            self.globalDeltas.extend(deltas)
        self.packet.deltas = []


    '''
        step()
        wrapper around _step() that ensures that step requests from user are 
        ignored when in PLAY mode, and that valid requests only go through (i.e.,
        actually call _step()) when feedback for the last step is received... 
        moreover, as is the case for play(), if there is already another thread
        currently paused on _debugProgrammedBreak, it is unpaused (via 
        _stopDebugProgrammedBreak()) and the current thread terminates immediately  


        _step()
        fetch and run next rule

        1. fetch next rule
            a) if next rule is not a {} (i.e., all available transformations have
                terminated and _nextRule() returned the resulting application code),
                report application code and stop()
            b) if an error is returned, report it and stop()
            c) otherwise, 
                i.   run rule (returns (deltas|error,applicationInfo))
                ii.  set ran rule's application info
                iii. if rule was n/a, report this
                iii. if rule failed, report this and error
                iii. otherwise,
                    j.   construct a batchEdit operation based on the rule's effects,
                          and unfo the said effects
                    jj.  send off the batchEdit
                    jjj. stop() if the batchEdit fails 

        NOTE: this function assumes that feedback for the last step has already
                been received '''
    def step(self) :
        if not hasattr(self, 'start_time'):
            self.start_time = clock()
        if self._execmode == 'PLAY' :
            pass
        else :
            if self._execmode == 'STOPPED':
                self._randomGen = Random(0)
            self._execmode = 'STEP'
            if not self._stopDebugProgrammedBreak() :
                self._doWhenLastStepFeedbackReceived(self._step)
    def _step(self) :


        '''
            run the specified rule and return a tuple describing its execution '''
        def runRule(r) :

            ''' hergin :: motif-integration start '''
            #self._aswPrintReq('launching rule :: '+r['fname'])
            #ar = NDARule(r['cr']['lhs'],r['cr']['rhs'],rng=self._randomGen)
            mtc = self._mtContexts[-1]
            if mtc.metamodel == TC.MOTIFMM or mtc.metamodel == TC.TCOREMM:
                ar = r['rule']
            else:
                ar = NDARule(r['cr']['lhs'],r['cr']['rhs'],rng=self._randomGen,sendAndApplyDeltaFunc=self.sendAndApplyDelta)

            if mtc.nextInput == "packetIn":
                startTime=clock()

                self.packet = ar.packet_in(self.packet)

                mtc.setLastStepExecTime(clock()-startTime)

            elif mtc.nextInput == "nextIn":
                startTime=clock()
                self.packet = ar.next_in(self.packet)
                mtc.setLastStepExecTime(clock()-startTime)

            elif mtc.nextInput == "cancelIn":
                startTime=clock()
                self.packet = ar.cancelIn(self.packet)
                mtc.setLastStepExecTime(clock()-startTime)

            elif mtc.nextInput == "successIn":
                startTime=clock()
                self.packet = ar.success_in(self.packet)
                mtc.setLastStepExecTime(clock()-startTime)

            ''' hergin :: motif-integration end '''

            if ar.is_success :
                return (self.packet.deltas,TC.SUCCEEDED)
            elif not ar.is_success :
                ''' hergin :: motif-integration start (Some terminology fixed) '''
                if ar.exception :
                    return (str(ar.exception),TC.EXCEPTION)
                else :
                    return (None,TC.FAILED)
                ''' hergin :: motif-integration end '''


        try :
            nr = self._nextRule()
        except Exception :
            print(traceback.format_exc())
            nr = {'$err':traceback.format_exc()}

        ''' hergin :: motif-integration start TRAFO RESULT: in case of a CRule_end, pop it from context and continue the rest '''
        while 'trafoResult' in nr:
            if len(self._mtContexts)==1:

                if not self.incUpdates and self.sendDeltas:
                    ''' hergin TO BE MODIFIED - release mode will change '''
                    req = self.buildEditHttpReq(self.globalDeltas)
                    self.globalDeltas = []
                    resp = self._aswCommTools['httpReq']('POST','/batchEdit',req)
                    if not utils.isHttpSuccessCode(resp['statusCode']) :
                        self.stop()
                        self._aswPrintReq(TC.REMOTE_APPLICATION_FAILURE + resp['reason'])
                        return
                    self._handleChangelogs()

                self._aswPrintReq(TC.TRANSFORMATION_DONE+nr['trafoResult']+" in "+str(self._mtContexts[-1].totalExecutionTime/1000.0)+" seconds, in total "+str((clock()-self.start_time)/1000.0))
                self.stop()
                return
            else:
                prevTrafo=self._mtContexts.pop()
                self._mtContexts[-1].setLastStepExecTime(prevTrafo.totalExecutionTime)
                self._mtContexts[-1].setLastStepApplicationInfo(nr['trafoResult'])
                try :
                    nr = self._nextRule()
                except Exception :
                    nr = {'$err':traceback.format_exc()}

        if nr.__class__ != {}.__class__ :
            self._aswPrintReq(TC.TRANSFORMATION_DONE + nr)
            self.stop()
            return

        elif '$err' in nr :
            self._aswPrintReq(TC.NO_NEXT_RULE+nr['$err'])
            self._stop()
            return

        else :
            if 'rtype' in nr:
                type = nr['rtype']
                if type == 'OpenModel':
                    (res,ai) = self.runOpenModelRule(nr['fname'],nr['formalism'])
                elif type == 'WriteModel':
                    (res,ai) = self.runWriteModelRule(nr['fname'],nr['formalism'])
                self._mtContexts[-1].setLastStepApplicationInfo(ai)
                self._mtContexts[-1].setLastStepFeedbackReceived()
                return True
            else:
                (res,ai) = runRule(nr)
            self._mtContexts[-1].setLastStepApplicationInfo(ai)

            if ai == TC.FAILED and self.incUpdates:
                ''' hergin :: motif-integration modify (which rule is not succeeded) '''
                self._aswPrintReq(TC.RULE_FAILURE_MSG+" ("+self._mtContexts[-1]._lastStep['alias']+":"+self._mtContexts[-1]._lastStep['name']+")")
            elif ai == TC.EXCEPTION and self.incUpdates:
                self._aswPrintReq(TC.RULE_EXCEPTION_MSG + res)
            else :
                ''' hergin :: motif-integration :: start '''

                mtc = self._mtContexts[-1]
                if self.incUpdates:
                    if mtc.metamodel == TC.MOTIFMM or mtc.metamodel == TC.TCOREMM:
                        self._aswPrintReq(TC.RULE_SUCCESS_MSG+" ("+self._mtContexts[-1]._lastStep['alias']+":"+self._mtContexts[-1]._lastStep['name']+")")
                    else:
                        self._aswPrintReq(TC.RULE_SUCCESS_MSG)
                self._mtContexts[-1].setLastStepFeedbackReceived()

                ''' hergin :: motif-integration :: end '''

        return True



    '''
        stop()
        sets self._execmode to STOPPING and schedules a call to _stop() for when
        feedback from the last step is received... being in STOPPING mode implies
        that the _play() loop, if any, will be broken, and that incoming user 
        requests will be rejected... in the case where there is already another 
        thread currently paused on _debugProgrammedBreak, it is unpaused (via 
        _stopDebugProgrammedBreak()) which leads to the transformation being 
        stopped from within that thread; the current thread terminates immediately


        _stop()
        1. restores self._mtContexts to right after the user loaded his 
            transformation(s) (i.e., to before we actually [partially] ran it)
        2. resets self._mtContexts2debugClients
        3. sends a console message to notify the user that the transformation has
            stopped
        4. sets self._execmode to STOPPED (i.e., we're done STOPPING and can 
            handle new requests) '''
    def isStopped(self)  :  return self._execmode == 'STOPPED'
    def isStopping(self) :  return self._execmode == 'STOPPING'
    def stop(self) :

        if not self.incUpdates:
            req = self.buildEditHttpReq(self.globalDeltas)
            self.globalDeltas = []
            resp = self._aswCommTools['httpReq']('POST','/batchEdit',req)
            if not utils.isHttpSuccessCode(resp['statusCode']) :
                self.stop()
                self._aswPrintReq(TC.REMOTE_APPLICATION_FAILURE + resp['reason'])
                return
            self._handleChangelogs()

        self._execmode = 'STOPPING'
        #Used for enactment, prevents open being append.
        self.loadedModel = False
        if not self._stopDebugProgrammedBreak() :
            self._doWhenLastStepFeedbackReceived(self._stop)
    def _stop(self) :
        self._mtContexts = []
        for fname in self._userTransfs :
            self._loadTransform(fname)
        self._mtContexts2debugClients = {}
        self._aswPrintReq(TC.TRANSFORMATION_STOPPED)
        self._execmode = 'STOPPED'



    '''
        enter a "programmed debugging pause" (i.e. unset the _debugProgrammedBreak
        flag and block until another thread resets it '''
    def _startDebugProgrammedBreak(self) :
        self._debugProgrammedBreak.clear()
        self._debugProgrammedBreak.wait()



    '''
        if the _debugProgrammedBreak flag is not set (this can only happen when 
        another thread unset it to enter a programmed debugging pause), set it and
        return true, otherwise do nothing and return false

        NOTE:: this function returns true iff there is a thread waiting on 
                 _debugProgrammedBreak '''
    def _stopDebugProgrammedBreak(self) :
        if not self._debugProgrammedBreak.isSet() :
            self._debugProgrammedBreak.set()
            return True
        return False



    ''' 
        toggle the _debugOn flag and report debugger status to atompm... when 
        disabling debugging, any current programmed debugging pauses are stopped
        (and execution resumes normally)


        while in DEBUG MODE, 
        . entering a ModelTransformationContext for the first time triggers
            a) setting self._execmode to PAUSE
            b) notifying the user of the "programmed debugging pause"
            c) spawning of a new atompm instance loaded with the relevant 
                transformation model
            d) entering programmed debugging pause that can be broken by 
                _stopDebugProgrammedBreak() which is triggered by
                i.   disabling transformation debugging; OR
                ii.  pressing "play", "step" or "stop"
            
        . before running a rule, it or its enclosing ExhaustContext's associated
            atompm node is highlighted '''
    def toggleDebugMode(self) :
        self._debugOn = not self._debugOn

        if self._debugOn :
            self._aswPrintReq(TC.DEBUGGING_ON)
        else :
            self._stopDebugProgrammedBreak()
            self._aswPrintReq(TC.DEBUGGING_OFF)

'''
    #Perform flat reachability analysis
  #This is what creates the simple reachability graph.
  #If the Petri nets are disjoint there will be several PNs "modules" that will be calculated in parallel.  
    def PNFull(self,fname='',dot=False):
        #if not self.modules:
        self._handleChangelogs()
        self.modules = {}       
        self.modStart = time()
        disjoint = self._M.decompose(mode=ig.WEAK)
        #Let's compile PN graph out of generic himesis graph and create dictionary with unique IDs
        barier = barrier(len(disjoint)+1) #barier, modules + synch thread
        for mod in disjoint:
            queue = Queue()
            uid = uuid.uuid4()
            key = str(uid)[:str(uid).index('-')]
            module = PnModule(self.toPN(mod),queue, barier,True)
            self.modules [ key] = module
            module.start()
        barier.wait()
        print 'Time elapsed flat analysis %f'%(time() - self.modStart)
        self.modules [ key].summary()
        self.modStart = time()
    #do the test of reachability here. 
        #self.reachabilityTestFlat()
        print 'Find place elapsed flat analysis %f'%(time() - self.modStart)
        for key,mod in self.modules.items():
            if dot:
        #can take too long to plot for large state space and/or hand dot binary
        #here we output the reacability graph in svg
                mod.graph(key=key,fname=fname)
            else:
        #here we output reachability graph in xml
                mod.reachtoxml(fname,key)
 

    #peroform modular analysis, use at your own risk. Toolbar does not enable this, experimental 
    def analyzePN(self):
        #First lets break model into submodels
        self.modStart = time()
        #if not self.modules:
        self.modules = {}
        disjoint = self._M.decompose(mode=ig.WEAK)
        barier = barrier(len(disjoint)+1) #barier, modules + synch thread
        for mod in disjoint:
            queue = Queue()
            module = PnModule(self.toPN(mod),queue, barier)
            self.modules [ module.getKey()] = module
            module.start()
        barier.wait() #wait till all threads stop doing first phase.
        M0 = []
        TFenabled = []
        TF = {}
        work = [] 
        tofire = []
        for key,mod in self.modules.items():
            TF[key] = mod.TFS
            M0.append('%s-%d'%(key,0))
        ind=0
        self.sg = synchgraph(len(self.modules),M0)
        work.append(M0) 
        res={}
        while work:
            M = work.pop()
            for key,mod in self.modules.items():
                TFenabled.append( mod.getEnabledTFs())
            tofire = reduce(set.intersection,map(set,TFenabled))    
            for key,mod in self.modules.items():
                mod.que.put(tofire)
            barier.wait() #lets wait for threads, they may building local graphs still
            end = False
            for key,mod in self.modules.items():
                if not mod.result:
                    end = True
                res[key] = mod.result #got results now produce new states for syngraph and archs.
            if not end:
                work.append(M)
            else:
                #self.sg.graph()
                for key,mod in self.modules.items():
                    mod.SC()
                    mod.graph()
                    mod.que.put(['@exit'])
                self.sg.markSCC(self.modules)
                self.sg.graph()
                print '---------------------------'
                print 'Time elapsed modular analysis %f'%(time() - self.modStart)
                for key,mod in self.modules.items():
                    mod.summary()
                    print '---------------------------'
                print 'Synch graph:'
                self.sg.summary()
                print '---------------------------'
                self.modStart = time()
                self.reachabilityTestModular()
                print 'Find place elapsed modular analysis %f'%(time() - self.modStart)
                return
            #main result
            fr ={}
            to = {}
            for key,value in res.items():
                for k,v in value.items():
                    if not k in fr:
                        fr[k] = []
                        fr[k].append([])
                        fr[k].append([])
                    fr[k][0].append(v[0])
                    fr[k][1].append(v[1])
            from_prod=[]
            to_prod = []
            T=None
            for key,value in fr.items():
                T = key
                #res = list(list(itertools.product(*value[0]))[0])
                from_prod.append(list( list(itertools.product(*value[0]))))
                to_prod.append(list (list(itertools.product (*value[1]))))
            self.sg.addMarkingBatch(T,from_prod,to_prod)
            #ENABLE
            self.sg.graph(ind)
            ind+=1;
            #
            
            #   self.sg.addMarking(from_prod[i],to_prod[i],T)
            res.clear()
            TFenabled = []
            #ENABLE
            #self.sg.graph()    
                    
                    
            TM = {} #dict by tf transition inside slists of lists of start and end states
            
    #compile into our PN representation
    def toPN(self,mod):
        oldtonew = {}
        g = ig.Graph(0,directed=True)
        for node in mod.vs:
            if not node['$type'].find('Place') == -1 or not node['$type'].find('Transition') == -1:
                g.add_vertices(1)
                index = g.vcount()-1
                oldtonew[node.index]=index
                g.vs[index]['name'] = node['name']
                if not node['$type'].find('Place') == -1:
                    g.vs[index]['type'] = 'P'
                    g.vs[index]['nbTokens'] = node['nbTokens']
                elif not node['$type'].find('Transition') == -1:
                    g.vs[index]['type'] = 'T'
                    g.vs[index]['fusion'] = node['fusion']
            elif not node['$type'].find('P2T') == -1:
                node['type'] = 'P2T'
            elif not node['$type'].find('T2P') == -1:
                node['type'] = 'T2P'
        
        #Let's connect
        P2T = mod.vs.select(type_eq = 'P2T')
        T2P = mod.vs.select(type_eq = 'T2P')
        for p2t in P2T:
            to = mod.successors(p2t.index)
            fr = mod.predecessors(p2t.index)
            try:
                p2tid = g.get_eid(oldtonew[fr[0]],oldtonew[to[0]])
            except:
                g.add_edges([(oldtonew[fr[0]],oldtonew[to[0]])])
                p2tid = g.get_eid(oldtonew[fr[0]],oldtonew[to[0]])
                g.es[p2tid]['weight'] = p2t['weight']
            else:
                old = int(g.es[p2tid]['weight'])
                g.es[p2tid]['weight'] = old + int(p2t['weight'])
        for t2p in T2P:
            to = mod.successors(t2p.index)
            fr = mod.predecessors(t2p.index)
            try: 
                t2pid = g.get_eid(oldtonew[fr[0]],oldtonew[to[0]])
            except:
                g.add_edges([(oldtonew[fr[0]],oldtonew[to[0]])])
                t2pid = g.get_eid(oldtonew[fr[0]],oldtonew[to[0]])
                g.es[t2pid]['weight'] = t2p['weight']
            else:
                old = int(g.es[t2pid]['weight'])
                g.es[t2pid]['weight'] = old + int(t2p['weight'])
            #dot graph of our petri net, not quite himesis.
            #self.graphPN('pn', g)
        return g
    
    def isReachableFlat(self,state,key=None):
        if not key:
            if self.modules.values()[0].reachable(state):
                return True
            else:
                return False
        else:
            if self.modules[key].reachable(state):
                return True
            else:
                return False

    
    def reachabilityTestModular(self):
        aa = 'a'
        bb = 'b'
        moda = {}
        modb =  {}
        moda['a2'] = 1
        #moda['a4'] = 4
        #moda['a3'] = 1
        modb['b1'] = 1
        modb['b3'] = 1
        statea = []
        stateb = []
        statea.append(moda)
        stateb.append(modb)
        if not self.isReachableFlat(statea,aa):
            print 'Modular state %s%s not reachable'%(statea,stateb)
            return False
        if not self.isReachableFlat(stateb,bb):
            print 'Modular state %s%s not reachable'%(statea,stateb)
            return False
        scca = self.modules[aa].reachableMod(statea)
        print 'A SCC of ancestors %s'%scca
        sccb = self.modules[bb].reachableMod(stateb)
        print 'B SCC of ancestors %s'%sccb
        result = list( list(itertools.product(scca,sccb)))
        
        for node in result:
            v = []
            a = 'a-%d'%node[0]
            b = 'b-%d'%node[1]
            v.append(a)
            v.append(b)
            id = self.sg.statePresentReach(v)
            if not id == -1:
                print 'Modular state %s%s reachable'%(statea,stateb)
                return True
            
        print 'Modular state %s%s not reachable'%(statea,stateb)
        return False
        
        
        
        
    def reachabilityTestFlat(self):
        moda = {}
        modb =  {}
        moda['a1'] = 1
        moda['a4'] = 2
        #moda['a3'] = 1
        #modb['b3'] = 2
        modb['b5'] = 3
        state = []
        state.append(moda)
        state.append(modb)
        if self.isReachableFlat(state):
            print 'Flat state %s reachable'%state
        else:
            print 'Flat state %s not reachable'%state
            
    def graph(self,key,g):
        vattr=''
        eattr = ''
        nodes = {}
        graph = pydot.Dot(key, graph_type='digraph')
        dateTag = datetime.datetime.now().strftime("%Y-%b-%d_%H-%M-%S")
        for v in g.vs:
            vattr +='('
            i = len(v['M'])
            for key,value in v['M'].items():
                vattr += '%s-%s'%(key,value)
                if not i-1 == 0:
                    vattr+=','
                i -=1
            vattr +=')'
            nodes[v.index] = pydot.Node(vattr)
            graph.add_node(nodes[v.index])
            vattr = ''
        for e in g.es:
            graph.add_edge(pydot.Edge(nodes[e.source],nodes[e.target],label=e['T']))
        graph.write_svg('graphs/STATE%s%s.svg'%(key,dateTag))   
        #graph.write_png('graphs/STATE%s%s.png'%(key,dateTag))  
    
  #use this one to output your PN net in a svg graph to analyze structure
  #and verify that compilation from Himesis to PN went fine, since we collaps 
  #repeated edges. 
   
    def graphPN(self,key,g):
        vattr=''
        eattr = ''
        nodes = {}
        graph = pydot.Dot(key, graph_type='digraph')
        dateTag = datetime.datetime.now().strftime("%Y-%b-%d_%H-%M-%S")
        for v in g.vs:
            for at in v.attributes():
                if not v[at] == None:
                    vattr += '%s->%s\n'%(at,v[at])
            nodes[v.index] = pydot.Node(vattr)
            graph.add_node(nodes[v.index])
            vattr = ''
        for e in g.es:
            graph.add_edge(pydot.Edge(nodes[e.source],nodes[e.target],label=e['weight']))
        graph.write_svg('graphs/PN%s%s.svg'%(key,dateTag))  


'''
