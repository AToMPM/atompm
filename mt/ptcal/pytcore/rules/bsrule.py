'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

from ..util.infinity import INFINITY
from ..tcore.composer import Composer
from brule import BRule


class BSRule(Composer):
    '''
        Selects a branch in which the matcher succeeds, as long as matches can be found.
    '''
    def __init__(self, branches, max_iterations=INFINITY):
        '''
            Selects a branch in which the matcher succeeds, as long as matches can be found.
            @param branches: A list of ARules.
            @param max_iterations: The maximum number of times to apply the transformation.
        '''
        super(BSRule, self).__init__()
        self.brule = BRule(branches)
        self.max_iterations = max_iterations
        self.iterations = 0
    
    def packet_in(self, packet):
        self.exception = None
        self.is_success = False
        
        while self.iterations < self.max_iterations:
            # Re-apply the BRule
            packet = self.brule.packet_in(packet)
            if not self.brule.is_success:
                self.exception = self.brule.exception
                return packet
            else:
                self.is_success = True
            self.iterations += 1
          
        return packet
