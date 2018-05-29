'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

from ..tcore.composer import Composer
from ..tcore.matcher import Matcher
from ..tcore.iterator import Iterator
from ..tcore.rewriter import Rewriter
from ..tcore.resolver import Resolver

class ARule(Composer):
    '''
        Applies the transformation on one match.
    '''
    def __init__(self, LHS, RHS,sendAndApplyDeltaFunc):
        '''
            Applies the transformation on one match.
            @param LHS: The pre-condition pattern (LHS + NACs).
            @param RHS: The post-condition pattern (RHS).
        '''
        super(ARule, self).__init__()
        self.M = Matcher(condition=LHS, max=1)
        self.I = Iterator(max_iterations=1)
        self.W = Rewriter(condition=RHS,sendAndApplyDeltaFunc=sendAndApplyDeltaFunc)
    
    def packet_in(self, packet):
        self.exception = None
        self.is_success = False
        
        # Match
        packet = self.M.packet_in(packet)
        if not self.M.is_success:
            self.exception = self.M.exception
            return packet
        
        # Choose the only match
        packet = self.I.packet_in(packet)
        if not self.I.is_success:
            self.exception = self.I.exception
            return packet
        
        # Rewrite
        packet = self.W.packet_in(packet)
        if not self.W.is_success:
            self.exception = self.W.exception
            return packet
        
        # Output success packet
        self.is_success = True
        return packet


class ARule_r(ARule):
    '''
        Applies the transformation on one match.
    '''
    def __init__(self, LHS, RHS, external_matches_only=False, custom_resolution=lambda packet: False):
        '''
            Applies the transformation on one match.
            @param LHS: The pre-condition pattern (LHS + NACs).
            @param RHS: The post-condition pattern (RHS).
            @param external_matches_only: Resolve conflicts ignoring the matches found in this ARule.
            @param custom_resolution: Override the default resolution function.
        '''
        super(ARule_r, self).__init__(LHS, RHS)
        self.R = Resolver(external_matches_only=external_matches_only,
                          custom_resolution=custom_resolution)
    
    def packet_in(self, packet):
        packet = super(ARule_r, self).packet_in(packet)
        # is_success is True
        if self.exception is None:
            # Resolve any conflicts if necessary
            packet = self.R.packet_in(packet)
            if not self.R.is_success:
                self.exception = self.R.exception
                return packet
            # Output success packet
        else:
            self.is_success = False
        return packet
