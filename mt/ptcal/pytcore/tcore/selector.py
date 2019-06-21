'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

from ..util.seeded_random import Random
from .control_primitive import ControlPrimitive
from .messages import Cancel, TransformationException, NIL_PACKET


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
