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
from lrule import LRule
from symbol import try_stmt


class LQSRule(LRule):
    '''
        Applies an inner rule for each match of the LHS as long as matches can be found.
    '''
    def __init__(self, LHS, inner_rule, max_iterations=INFINITY):
        '''
            Applies an inner rule for each match of the LHS as long as matches can be found.
            @param LHS: The pre-condition pattern (LHS + NACs).
            @param inner_rule: The rule to apply in the loop.
            @param max_iterations: The maximum number of matches of the LHS.
        '''
        super(LQSRule, self).__init__(LHS, inner_rule, max_iterations)
    
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
            # Rule has been applied once, so it's a success anyway
            self.is_success = True
            
            
            if self.I.iterations == self.I.max_iterations:
                return packet
            
            ''' hergin :: motif-integration : clean Matchset before rematch because only LHS doesnot have a rewriter '''
            #packet.match_sets = {}
            #try:
            #    if  len(packet.match_sets[self.I.condition].matches) == 0:
            #        del packet.match_sets[self.I.condition]
            #except KeyError:
            #    pass
            
            # Re-Match
            packet = self.M.packet_in(packet)
            if not self.M.is_success:
                self.exception = self.M.exception
                return packet
             
            # Choose another match
            packet = self.I.next_in(packet)
            # No more iterations are left
            if not self.I.is_success:
                if self.I.exception:
                    self.exception = self.I.exception
                return packet
