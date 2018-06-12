'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

from ..util.infinity import INFINITY
from .arule import ARule
from ..tcore.resolver import Resolver


class SRule(ARule):
    '''
        Applies the transformation as long as matches can be found.
    '''
    def __init__(self, LHS, RHS, max_iterations=INFINITY,sendAndApplyDeltaFunc=None):
        '''
            Applies the transformation as long as matches can be found.
            @param LHS: The pre-condition pattern (LHS + NACs).
            @param RHS: The post-condition pattern (RHS).
            @param max_iterations: The maximum number of times to apply the transformation.
        '''
        super(SRule, self).__init__(LHS, RHS,sendAndApplyDeltaFunc)
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

            # Rule has been applied once, so it's a success anyway
            self.is_success = True
            if self.I.iterations == self.I.max_iterations:
                return packet
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


class SRule_r(SRule):
    '''
        Applies the transformation on one match.
    '''
    def __init__(self, LHS, RHS, max_iterations=INFINITY, external_matches_only=False, custom_resolution=lambda packet: False):
        '''
            Applies the transformation as long as matches can be found.
            @param LHS: The pre-condition pattern (LHS + NACs).
            @param RHS: The post-condition pattern (RHS).
            @param max_iterations: The maximum number of times to apply the transformation.
            @param external_matches_only: Resolve conflicts ignoring the matches found in this SRule.
            @param custom_resolution: Override the default resolution function.
        '''
        super(SRule_r, self).__init__(LHS, RHS, max_iterations)
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
            # Rule has been applied once, so it's a success anyway
            self.is_success = True
            if self.I.iterations == self.I.max_iterations:
                return packet
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
