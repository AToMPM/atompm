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

from ..tcore.composer import Composer
from ..tcore.matcher import Matcher
from ..tcore.iterator import Iterator


class Query(Composer):
    '''
        Finds a match for the LHS.
    '''
    def __init__(self, LHS):
        '''
            Finds a match for the LHS.
            @param LHS: The pre-condition pattern (LHS + NACs).
        '''
        super(Query, self).__init__()
        self.M = Matcher(condition=LHS, max=1)
        self.I = Iterator(max_iterations=1)
    
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
            # Clean the packet: required since there is no Rewriter in a Query
            if  len(packet.match_sets[self.I.condition].matches) == 0:
                del packet.match_sets[self.I.condition]
            self.exception = self.I.exception
            return packet
        # Output success packet
        self.is_success = True
        return packet
    
class CQuery2(Composer):
    '''
        Finds a match for the LHS.
    '''
    def __init__(self, LHS, innerQuery):
        '''
            Finds a match for the LHS.
            @param LHS: The pre-condition pattern (LHS + NACs).
        '''
        super(CQuery2, self).__init__()
        self.M = Matcher(condition=LHS)
        self.I = Iterator()
        self.innerQuery=innerQuery
    
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
            
            packet = self.innerQuery.packet_in(packet)
            if self.innerQuery.is_success:
                if self.innerQuery.exception:
                    self.exception = self.innerQuery.exception
                    return packet
            
                # Choose another match
                packet = self.I.next_in(packet)
                # No more iterations are left
                if not self.I.is_success:
                    if self.I.exception:
                        self.exception = self.I.exception
                    else:
                        # Output success packet
                        self.is_success = False
                    return packet
            else:
                self.is_success=True
                return packet
            
class CQuery3(Composer):
    '''
        Finds a match for the LHS.
    '''
    def __init__(self, LHS, innerQuery, secondInnerQuery):
        '''
            Finds a match for the LHS.
            @param LHS: The pre-condition pattern (LHS + NACs).
        '''
        super(CQuery3, self).__init__()
        self.M = Matcher(condition=LHS)
        self.I = Iterator()
        self.innerQuery=innerQuery
        self.secondInnerQuery=secondInnerQuery
    
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
            
            packet = self.innerQuery.packet_in(packet)
            if self.innerQuery.is_success:
                if self.innerQuery.exception:
                    self.exception = self.innerQuery.exception
                    return packet
            
                # Choose another match
                packet = self.I.next_in(packet)
                # No more iterations are left
                if not self.I.is_success:
                    if self.I.exception:
                        self.exception = self.I.exception
                    else:
                        self.is_success = False
                    return packet
            else:
                
                packet = self.secondInnerQuery.packet_in(packet)
                if self.secondInnerQuery.is_success:
                    if self.secondInnerQuery.exception:
                        self.exception = self.secondInnerQuery.exception
                        return packet
                    packet = self.I.next_in(packet)
                    if not self.I.is_success:
                        if self.I.exception:
                            self.exception = self.I.exception
                        else:
                            self.is_success = False
                        return packet
                else:
                    self.is_success=True
                    return packet
