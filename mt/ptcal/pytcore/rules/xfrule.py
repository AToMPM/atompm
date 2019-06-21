'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

from ..util.infinity import INFINITY
from .frule import FRule
from ..tcore.rollbacker import Rollbacker
from ..tcore.resolver import Resolver


class XFRule(FRule):
    '''
        Applies the transformation on all matches found with roll-back capability.
    '''
    def __init__(self, LHS, RHS, max_iterations=INFINITY):
        '''
            Applies the transformation on all matches found with roll-back capability.
            @param LHS: The pre-condition pattern (LHS + NACs).
            @param RHS: The post-condition pattern (RHS).
            @param max_iterations: The maximum number of times to apply the rule.
        '''
        super(XFRule, self).__init__(LHS, RHS, max_iterations)
        # max_iterations=1 because no all matches have been exhausted after first application
        self.B = Rollbacker(condition=LHS, max_iterations=1)

    def packet_in(self, packet):
        self.exception = None
        self.is_success = False
        # Checkpoint the original packet
        self.B.packet_in(packet)
        if not self.B.is_success:
            self.exception = self.B.exception
            return packet
        # Match
        packet = self.M.packet_in(packet)
        if not self.M.is_success:
            packet = self.B.restore(packet)
            if self.M.exception:
                self.exception = self.M.exception
            elif self.B.exception:
                self.exception = self.B.exception
            return packet
        # Choose the first match
        packet = self.I.packet_in(packet)
        if not self.I.is_success:
            packet = self.B.restore(packet)
            if self.I.exception:
                self.exception = self.I.exception
            elif self.B.exception:
                self.exception = self.B.exception
            return packet
        while True:
            # Rewrite
            packet = self.W.packet_in(packet)
            if not self.W.is_success:
                packet = self.B.restore(packet)
                if self.W.exception:
                    self.exception = self.W.exception
                elif self.B.exception:
                    self.exception = self.B.exception
                return packet
            # Choose another match
            packet = self.I.next_in(packet)
            # No more iterations are left
            if not self.I.is_success:
                if self.I.exception:
                    packet = self.B.restore(packet)
                    if self.B.exception:
                        self.exception = self.B.exception
                    self.exception = self.I.exception
                    self.is_success = False
                else:
                    # Output success packet
                    self.is_success = True
                return packet

    def next_in(self, packet):
        # Only one roll-back
        self.exception = None
        self.is_success = False
        packet = self.B.next_in(packet)
        if not self.B.is_success:
            self.exception = self.B.exception
        return packet


class XFRule_r(XFRule):
    '''
        Applies the transformation on one match.
    '''
    def __init__(self, LHS, RHS, max_iterations=INFINITY, external_matches_only=False, custom_resolution=lambda packet: False):
        '''
            Applies the transformation on all matches found with roll-back capability.
            @param LHS: The pre-condition pattern (LHS + NACs).
            @param RHS: The post-condition pattern (RHS).
            @param max_iterations: The maximum number of times to apply the rule.
            @param external_matches_only: Resolve conflicts ignoring the matches found in this FRule.
            @param custom_resolution: Override the default resolution function.
        '''
        super(XFRule_r, self).__init__(LHS, RHS, max_iterations)
        self.R = Resolver(external_matches_only=external_matches_only,
                          custom_resolution=custom_resolution)

    def packet_in(self, packet):
        self.exception = None
        self.is_success = False
        # Checkpoint the original packet
        self.B.packet_in(packet)
        if not self.B.is_success:
            self.exception = self.B.exception
            return packet
        # Match
        packet = self.M.packet_in(packet)
        if not self.M.is_success:
            packet = self.B.restore(packet)
            if self.M.exception:
                self.exception = self.M.exception
            elif self.B.exception:
                self.exception = self.B.exception
            return packet
        # Choose the first match
        packet = self.I.packet_in(packet)
        if not self.I.is_success:
            packet = self.B.restore(packet)
            if self.I.exception:
                self.exception = self.I.exception
            elif self.B.exception:
                self.exception = self.B.exception
            return packet
        while True:
            # Rewrite
            packet = self.W.packet_in(packet)
            if not self.W.is_success:
                packet = self.B.restore(packet)
                if self.W.exception:
                    self.exception = self.W.exception
                elif self.B.exception:
                    self.exception = self.B.exception
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
                    packet = self.B.restore(packet)
                    if self.B.exception:
                        self.exception = self.B.exception
                    self.exception = self.I.exception
                    self.is_success = False
                else:
                    # Output success packet
                    self.is_success = True
                return packet

