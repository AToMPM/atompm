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
from arule import ARule
from ..tcore.resolver import Resolver


class FRule(ARule):
    '''
        Applies the transformation on all matches found.
    '''
    def __init__(self, LHS, RHS, max_iterations=INFINITY,sendAndApplyDeltaFunc=None):
        '''
            Applies the transformation on all matches found.
            @param LHS: The pre-condition pattern (LHS + NACs).
            @param RHS: The post-condition pattern (RHS).
            @param max_iterations: The maximum number of times to apply the rule.
        '''
        super(FRule, self).__init__(LHS, RHS,sendAndApplyDeltaFunc)
        # Matcher needs to find many matches
        self.M.max = max_iterations
        self.I.max_iterations = max_iterations
    
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
            # Rewrite
            packet = self.W.packet_in(packet)
            if not self.W.is_success:
                self.exception = self.W.exception
                return packet

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


class FRule_r(ARule):
    '''
        Applies the transformation on all matches found.
    '''
    def __init__(self, LHS, RHS, max_iterations=INFINITY, external_matches_only=False, custom_resolution=lambda packet: False):
        '''
            Applies the transformation on all matches found.
            @param LHS: The pre-condition pattern (LHS + NACs).
            @param RHS: The post-condition pattern (RHS).
            @param max_iterations: The maximum number of times to apply the rule.
            @param external_matches_only: Resolve conflicts ignoring the matches found in this FRule.
            @param custom_resolution: Override the default resolution function.
        '''
        super(FRule_r, self).__init__(LHS, RHS, max_iterations)
        self.R = Resolver(external_matches_only=external_matches_only,
                          custom_resolution=custom_resolution)
    
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
            # Rewrite
            packet = self.W.packet_in(packet)
            if not self.W.is_success:
                self.exception = self.W.exception
                return packet
            # Resolve any conflicts if necessary
            packet = self.R.packet_in(packet)
            if not self.R.is_success:
                self.exception = self.R.exception
                return packet
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

