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

from ..util.seeded_random import Random
from ..util.infinity import INFINITY
from rule_primitive import RulePrimitive
#from messages import TransformationException


class Iterator(RulePrimitive):
    '''
        Chooses randomly one match from the packet.
    '''
    def __init__(self, condition=None, max_iterations=INFINITY, rng=None):
        '''
            Selects one match from the packet.
            @param condition: The pre-condition pattern.
            @param max_iterations: The maximum number of times to select.
                                    By default, this is +INFINITY.
        '''
        super(Iterator, self).__init__()
        self.max_iterations = max_iterations
        self.iterations = 0
        self.rng = rng
        if condition:
            self.condition = condition.get_id()
    
    def cancelIn(self, cancel):
        if self.condition not in cancel.exclusions:
            super(Iterator, self).cancelIn(cancel)
            self.iterations = 0
    
    def packet_in(self, packet):
        self.exception = None
        self.is_success = False
        if packet.current in packet.match_sets:
            self.condition = packet.current
            # Promote the selected match to be the match to rewrite
            packet.match_sets[packet.current].match2rewrite = self._choose(packet)
            self._globalize_pivots(packet)
            self.iterations = 1
            self.is_success = True
        return packet
    
    def next_in(self, packet):
        self.exception = None
        self.is_success = False
        packet.current = self.condition
        if self.iterations < self.max_iterations and packet.current in packet.match_sets:
            if  len(packet.match_sets[self.condition].matches) == 0:
                del packet.match_sets[self.condition]
                return packet
            # Promote the selected match to be the match to rewrite
            packet.match_sets[packet.current].match2rewrite = self._choose(packet)
            self._globalize_pivots(packet)
            self.iterations += 1
            self.is_success = True
        return packet
    
    def _choose(self, packet):
        # Choose a match form the current match set and remove it from the list of matches
        return packet.match_sets[packet.current].matches.pop((self.rng if self.rng != None else Random).randint(0, len(packet.match_sets[packet.current].matches) - 1))
    
    def _globalize_pivots(self, packet):
        """
            Puts all local pivots of the current match in the global pivots of the packet.
            Of course, local pivots have priority over global pivots.
        """
        local_pivots = packet.match_sets[packet.current].match2rewrite.local_pivots
        for p in local_pivots:
            packet.global_pivots[p] = local_pivots[p]
