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

import uuid


# Abstract class
class Primitive(object):
    def __init__(self):
        self.is_success = False      # flags weather the primitive's action resulted in a success or not
        self.exception = None       # holds the exception object if one was raised
        self._id = uuid.uuid4() 
    
    def cancelIn(self, cancel):
        self.is_success = False
        self.exception = None
    
    def __str__(self):
        return '%s %s' % (str(self.__class__.__name__), self._id) 