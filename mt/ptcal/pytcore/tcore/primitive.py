'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

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