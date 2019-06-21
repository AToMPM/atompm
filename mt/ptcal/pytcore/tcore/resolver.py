'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

from .rule_primitive import RulePrimitive
from .messages import TransformationException


class Resolver(RulePrimitive):
    '''
        Detects & resolves any conflict between matches and rewritings.
    '''
    def __init__(self, external_matches_only=False, custom_resolution=lambda packet: False):
        '''
            Detects & resolves any conflict between matches.
            @param external_matches_only: Whether to only check for matches outside the current scope of the resolver.
                                    By default, this is False.
            @param custom_resolution: Function that defines how to resolve any conflict
                                    By default, this returns False.
        '''
        super(Resolver, self).__init__()
        self.external_matches_only = external_matches_only
        self.custom_resolution = custom_resolution

    def packet_in(self, packet):
        '''
            Attempts to merge the packets into a single one, only if all threads had succeeded.
        '''
        self.exception = None
        self.is_success = False
        for cond in packet.match_sets:
            # Ignore the current match set when checking for conflicts with external matches only
            if self.external_matches_only and cond == packet.current:
                continue
            for match in packet.match_sets[cond].matches:
                if match.is_dirty(packet):
                    # First try the custom resolution function
                    if not self._custom_resolution(packet, match):
                        # Then try the default resolution function
                        if not self._default_resolution(packet, match):
                            self.is_success = False
                            # TODO: This should be an InconsistentUseException
                            self.exception = TransformationException()
                            self.exception.packet = packet
                            self.exception.transformation_unit = self
                            return packet
        # No conflicts are to be reported
        self.is_success = True
        return packet

    def _custom_resolution(self, packet, match):
        '''
            Applies the user-defined resolution function
        '''
        return self.custom_resolution(packet)

    def _default_resolution(self, packet, match):
        '''
            Attempts to resolve conservatively any conflicts
        '''
        return False