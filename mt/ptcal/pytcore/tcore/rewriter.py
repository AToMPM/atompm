'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

from rule_primitive import RulePrimitive
from messages import TransformationException
from ..core.himesis import Himesis
from ...tconstants import TConstants as TC
from ...utils import Utilities as utils


class Rewriter(RulePrimitive):
    '''
        Transforms the matched source model elements according to the specified post-condition pattern.
    '''
    def __init__(self, condition,sendAndApplyDeltaFunc):
        '''
            Transforms the bound graph of the source graph into what the specification of the post-condition pattern.
            @param condition: The the post-condition pattern.
        '''
        super(Rewriter, self).__init__()
        self.condition = condition
        
        self.sendAndApplyDeltaFunc = sendAndApplyDeltaFunc
    
    def __str__(self):
        s = super(Rewriter, self).__str__()
        s = s.split(' ')
        s.insert(1, '[%s]' % self.condition.name)
        return reduce(lambda x, y: x + ' ' + y, s)
    
    def packet_in(self, packet):
        self.exception = None
        self.is_success = False
        if self.condition.pre[Himesis.Constants.GUID] not in packet.match_sets:
            self.is_success = False
            # TODO: This should be a TransformationLanguageSpecificException 
            self.exception = TransformationException()
            self.exception.packet = packet
            return packet
        else:
            match = packet.match_sets[self.condition.pre[Himesis.Constants.GUID]].match2rewrite
            mapping = match.to_label_mapping(packet.graph)
            # Apply the transformation on the match
            try:
                self.condition.execute(packet, mapping)     # Sets dirty nodes as well
            except Exception, e:
                self.is_success = False
                self.exception = TransformationException(e)
                self.exception.packet = packet
                self.exception.transformation_unit = self
                return packet
            
            # Remove the match
            packet.match_sets[self.condition.pre[Himesis.Constants.GUID]].match2rewrite = None
            if  len(packet.match_sets[self.condition.pre[Himesis.Constants.GUID]].matches) == 0:
                del packet.match_sets[self.condition.pre[Himesis.Constants.GUID]]
            
            #print self.condition
            
            ''' hergin :: motif-integration :: start '''
            self.sendAndApplyDeltaFunc(packet.deltas)
            ''' hergin :: motif-integration :: end '''

            self.is_success = True
            return packet
