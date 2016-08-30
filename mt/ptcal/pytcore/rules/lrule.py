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
from ..tcore.matcher import Matcher
from ..tcore.iterator import Iterator


class LRule(Composer):
    '''
        Applies an inner rule for each match of the LHS.
    '''
    def __init__(self, LHS, inner_rule, max_iterations=INFINITY):
        '''
            Applies an inner rule for each match of the LHS.
            @param LHS: The pre-condition pattern (LHS + NACs).
            @param inner_rule: The rule to apply in the loop.
            @param max_iterations: The maximum number of matches of the LHS.
        '''
        super(LRule, self).__init__()
        self.M = Matcher(condition=LHS, max=max_iterations)
        self.I = Iterator(max_iterations=max_iterations)
        self.inner_rule = inner_rule
    
    def packet_in(self, packet):
        self.exception = None
        self.is_success = False
        # Match
        packet = self.M.packet_in(packet)
        if not self.M.is_success:
            self.exception = self.M.exception
            return packet
        # Choose the first match
        packet = self.I.packet_in(packet)
        if not self.I.is_success:
            self.exception = self.I.exception
            return packet

        while True:
            # Apply the inner rule
            packet = self.inner_rule.packet_in(packet)
            if not self.inner_rule.is_success:
                if self.inner_rule.exception:
                    self.exception = self.inner_rule.exception
                return packet
            
                
            # Clean the packet: required since there is no Rewriter in a Query
            if  len(packet.match_sets[self.I.condition].matches) == 0:
                del packet.match_sets[self.I.condition]
            # Choose another match
            packet = self.I.next_in(packet)
            # No more iterations are left
            if not self.I.is_success:
                if self.I.exception:
                    self.exception = self.I.exception
                else:
                    # Output success packet
                    self.is_success = True
                return packet
