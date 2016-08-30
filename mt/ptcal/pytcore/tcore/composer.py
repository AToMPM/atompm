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

from composite_primitive import CompositePrimitive


class Composer(CompositePrimitive):
    '''
        Encapsulates T-Core primitives.
        Both packet_in & next_in methods must be overridden to provide meaningful behaviour. 
    '''
    def __init__(self):
        '''
            Encapsulates T-Core primitives.
            Both packet_in & next_in methods must be overridden to provide meaningful behaviour. 
        '''
        super(Composer, self).__init__()
    
    def packet_in(self, packet):
        return packet
    
    def next_in(self, packet):
        return packet
