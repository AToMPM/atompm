'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

from ..util.seeded_random import Random
from .control_primitive import ControlPrimitive
from .messages import TransformationException, NIL_PACKET


class Synchronizer(ControlPrimitive):
    '''
        Synchonizes all threads of execution by merging the packets.
    '''
    def __init__(self, threads=2, custom_merge=lambda packets: None):
        '''
            Synchonizes all threads of execution by merging the packets.
            @param threads: Specifies how many threads will be synchronized.
                            By default, this is 2.
            @param custom_merge: Function that defines how to merge the success packets.
                                By default, this returns None.
        '''
        super(Synchronizer, self)

        assert(threads >= 2)
        self.threads = threads
        self.custom_merge = custom_merge

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

    def _custom_merge(self):
        '''
            Applies the user-defined merge function
        '''
        return self.custom_merge(self.success)

    def _default_merge(self):
        '''
            Attempts to merge the packets conservatively
        '''
        return None

    def merge(self):
        '''
            Attempts to merge the packets into a single one, only if all threads had succeeded.
        '''
        self.exception = None
        self.is_success = False

        def failure():
            self.is_success = False
            self.exception = TransformationException()
            self.exception.packet = NIL_PACKET
            return NIL_PACKET

        if len(self.success) == self.threads:
            packet = self._custom_merge()
            if packet is not None:
                self.is_success = True
                self.reset()
                return packet
            else:
                packet = self._default_merge()
                if packet is not None:
                    self.is_success = True
                    self.reset()
                    return packet
                else:
                    return failure()
        elif len(self.success) + len(self.fail) == self.threads:
            self.is_success = False
            return Random.choice(self.fail)
        else:
            return failure()
            
                
