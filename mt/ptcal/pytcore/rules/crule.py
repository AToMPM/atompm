'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

from ..tcore.composer import Composer
from ...tconstants import TConstants as TC

class CRule(Composer):

    def __init__(self,motifContext):
        self._mtContexts = []
        self._mtContexts.append(motifContext)
        self.cruleEnd = False
        self.packet = None
    
    def packet_in(self, packet):
        
        self.cruleEnd = False
        self._mtContexts[-1]._expired=False
        self._mtContexts[-1]._lastStep={}
        
        self.exception = None
        self.is_success = False
        self.packet = packet
        while not self.cruleEnd:
            result = self._step()
            self.is_success = result if result != None else False
        
        return self.packet
            

    def _nextRule(self) :
        mtc = self._mtContexts[-1]

        ns = mtc.nextStep()

        if 'id' in ns :
        
            fulltype = mtc.t['nodes'][ns['id']]['$type']
            
            if fulltype == mtc.metamodel+"CRule":
                
                #self._loadTransform(ns['rule'])
                
                return self._nextRule()
                
            elif fulltype.startswith('/Formalisms/__Transformations__/Transformation/T-Core') or\
                    fulltype.startswith('/Formalisms/__Transformations__/Transformation/MoTif'):
                    
                return ns

        elif 'trafoResult' in ns:
            return ns;
        
    def _step(self) :       

        def runRule(r) :
            
            ar = r['rule']
            
            self.packet = ar.packet_in(self.packet)

            if ar.is_success :
                return (self.packet.deltas,TC.SUCCEEDED)
            elif not ar.is_success :
                if ar.exception :
                    return (str(ar.exception),TC.EXCEPTION)
                else :
                    return (None,TC.FAILED)

        try :
            nr = self._nextRule()
        except Exception :
            self.cruleEnd = True
            return

        if 'trafoResult' in nr:
            self.cruleEnd = True
            return nr['trafoResult']

        if nr.__class__ != {}.__class__ :
            self.cruleEnd = True
            return

        elif '$err' in nr :
            self.cruleEnd = True
            return

        else :
            (res,ai) = runRule(nr)
            
            self._mtContexts[-1].setLastStepApplicationInfo(ai)

            if ai == TC.FAILED :
                pass
                #self._aswPrintReq(TC.RULE_FAILURE_MSG+" ("+self._mtContexts[-1]._lastStep['alias']+":"+self._mtContexts[-1]._lastStep['name']+")")
            elif ai == TC.EXCEPTION :
                pass
                #self._aswPrintReq(TC.RULE_EXCEPTION_MSG + res)
            else :
                return True
                #self._mtContexts[-1].setLastStepFeedbackReceived()
