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

from primitive import Primitive

# Abstract class
class ControlPrimitive(Primitive):
    def __init__(self):
        super(ControlPrimitive, self).__init__()
        self.success = []   # [Packet]
        self.fail = []      # [Packet]
    
    def success_in(self, packet):
        raise AttributeError('Method not implemented')
    
    def fail_in(self, packet):
        raise AttributeError('Method not implemented')
    
    def reset(self):
        self.success = []
        self.fail = []