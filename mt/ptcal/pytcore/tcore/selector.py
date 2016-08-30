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
from control_primitive import ControlPrimitive
from messages import Cancel, TransformationException, NIL_PACKET


class Selector(ControlPrimitive):
    '''
        Selects a packet randomly.
    '''
    def __init__(self):
        '''
            Selects a packet randomly.
        '''
        super(Selector, self).__init__()
        self.exclusions = []
    
    def success_in(self, packet):
        '''
            Receives a successful packet
        '''
        self.exception = None
        self.is_success = False
        self.success.append(packet)
    
    def fail_in(self, packet):
        '''
            Receives a failed packet
        '''
        self.exception = None
        self.is_success = False
        self.fail.append(packet)
    
    def reset(self):
        super(Selector, self).reset()
        self.exclusions = []
    
    def select(self):
        '''
            Selects a packet randomly from the success list.
            If the success list is empty, then from the fail list.
        '''
        self.exception = None
        self.is_success = False
        if len(self.success) > 0:
            self.is_success = True
            packet = Random.choice(self.success)
            self.exclusions.append(packet.current)
            return packet
        elif len(self.fail) > 0:
            self.is_success = False
            return Random.choice(self.fail)
        else:
            self.is_success = False
            #TODO: This should be a TransformationLanguageSpecificException
            self.exception = TransformationException('No packet was received')
            self.exception.packet = NIL_PACKET
            return NIL_PACKET
    
    def cancel(self):
        '''
            Produces a cancel event and resets its state
        '''
        c = Cancel()
        c.exclusions = self.exclusions
        self.reset()
        return c
