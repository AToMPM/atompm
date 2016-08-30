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
