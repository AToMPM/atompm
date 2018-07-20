'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

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
        remaining_branches = list(range(len(self.branches)))
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
        
