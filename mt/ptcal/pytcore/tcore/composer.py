'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

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
