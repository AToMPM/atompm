'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

from .primitive import Primitive

# Abstract class
class RulePrimitive(Primitive):
    def __init__(self):
        super(RulePrimitive, self).__init__()

    def packet_in(self, packet):
        raise AttributeError('Method not implemented')