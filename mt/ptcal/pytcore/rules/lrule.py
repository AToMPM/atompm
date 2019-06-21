'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

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
