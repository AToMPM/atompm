'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

from ..util.infinity import INFINITY
from lrule import LRule
from ..tcore.rewriter import Rewriter
from ..tcore.resolver import Resolver

class LFRule(LRule):
    '''
        Applies an inner rule for each application of the outer rule.
    '''
    def __init__(self, LHS, RHS, inner_rule, outer_first, sendAndApplyDeltaFunc, max_iterations=INFINITY, external_matches_only=False, custom_resolution=lambda packet: False):
        '''
            Applies an inner rule for each application of the outer rule.
            @param LHS: The pre-condition pattern (LHS + NACs).
            @param RHS: The post-condition pattern (RHS).
            @param inner_rule: The rule to apply in the loop.
            @param outer_first: Whether the outer rule should be applied before the inner rule. 
            @param max_iterations: The maximum number of matches of the LHS.
            @param external_matches_only: Resolve conflicts ignoring the matches found in this FRule.
            @param custom_resolution: Override the default resolution function.
        '''
        super(LFRule, self).__init__(LHS, inner_rule, max_iterations)
        self.W = Rewriter(condition=RHS,sendAndApplyDeltaFunc=sendAndApplyDeltaFunc)
        self.outer_first = outer_first
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
            if self.outer_first:
                # Rewrite
                packet = self.W.packet_in(packet)
                if not self.W.is_success:
                    self.exception = self.W.exception
                    return packet

                
                # Resolve any conflicts if necessary
                ''' hergin :: motif-integration commented '''
                #packet = self.R.packet_in(packet)
                #if not self.R.is_success:
                #    self.exception = self.R.exception
                #    return packet
            # Apply the inner rule
            packet = self.inner_rule.packet_in(packet)
            if not self.inner_rule.is_success:
                self.exception = self.inner_rule.exception
                return packet
            
            if not self.outer_first:
                # Rewrite
                packet = self.W.packet_in(packet)
                if not self.W.is_success:
                    self.exception = self.W.exception
                    return packet

                
                # Resolve any conflicts if necessary
                ''' hergin :: motif-integration commented '''
                #packet = self.R.packet_in(packet)
                #if not self.R.is_success:
                #    self.exception = self.R.exception
                #    return packet
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
