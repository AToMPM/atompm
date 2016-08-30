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

from ..tcore.composer import Composer
from ..util.seeded_random import Random


class BRule(Composer):
    '''
        Selects a branch in which the matcher succeeds.
    '''
    def __init__(self, branches):
        '''
            Selects a branch in which the matcher succeeds.
            @param branches: A list of ARules.
        '''
        super(BRule, self).__init__()
        self.branches = branches
    
    def packet_in(self, packet):
        self.exception = None
        self.is_success = False
        remaining_branches = range(len(self.branches))
        ''' hergin motif-integration ::: clone commented in observance of not need
             report bugs if have '''
        #original = packet.clone()
        # Success on the first branch that is in success
        while len(remaining_branches) > 0:
            branch_no = Random.choice(remaining_branches)
            branch = self.branches[branch_no]
            packet = branch.packet_in(packet)
            if not branch.is_success:
                if branch.exception is not None:
                    self.exception = branch.exception
                    break
                else:
                    # Ignore this branch for next try
                    remaining_branches.remove(branch_no)
                    #packet = original.clone()
            else:
                self.is_success = True
                break
        return packet
        
