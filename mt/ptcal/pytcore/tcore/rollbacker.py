'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

#import pickle, os
from ..util.infinity import INFINITY
from .iterator import Iterator
from ..tcore.messages import TransformationException


class Rollbacker(Iterator):
    '''
        Provides back-tracking capacity.
    '''
    def __init__(self, condition, max_iterations=INFINITY):
        '''
            Selects one match from the packet.
            @param condition: The pre-condition pattern.
            @param max_iterations: The maximum number of times to select.
                                    By default, this is +INFINITY.
        '''
        super(Rollbacker, self).__init__(condition, max_iterations)
        self.checkpoints = []   # Stack of file names

    def packet_in(self, packet):
        self.exception = None
        self.is_success = False
        try:
            self.establish(packet)
            self.is_success = True
        except Exception as e:
            self.is_success = False
            self.exception = TransformationException(e)
            self.exception.packet = packet
            self.exception.transformation_unit = self
        finally:
            self.iterations = 1
            return packet

    def next_in(self, packet):
        self.exception = None
        self.is_success = False
        if self.iterations < self.max_iterations:
            # If came from the same scope as the rollbacker, then just pass it over
            if packet.current in packet.match_sets:
                self.iterations += 1
                self.is_success = True
                return packet
            else:
                try:
                    packet.set_state(self.restore())
                    self.is_success = True
                except Exception as e:
                    self.is_success = False
                    self.excepion = TransformationException(e)
                    self.exception.packet = packet
                    self.exception.transformation_unit = self
                finally:
                    return packet
        else:   # self.iterations == self.max_iterations
            try:
                packet = self.restore()
                self.is_success = True
            except:
                self.is_success = False
            finally:
                return packet

    def establish(self, packet):
        #        fileName = '%d.tc_state.%d' % (self._id, len(self.checkpoints))
        #        with open(fileName, 'w') as storage:
        #            pickle.dump(packet, storage)
        #        self.checkpoints.append(fileName)
        self.checkpoints.append(packet.copy_state(self.condition))


    def restore(self):
        #        with open(self.checkpoints[-1], 'r') as storage:
        #            packet = pickle.load(storage)
        #            return packet
        #        os.remove(self.checkpoints[-1])
        if len(self.checkpoints) > 0:
            return self.checkpoints.pop()
        raise Exception('There are no checkpoints to restore')

    def discard(self):
        #        os.remove(self.checkpoints[-1])
        if len(self.checkpoints) > 0:
            del self.checkpoints[-1]
        raise Exception('There are no checkpoints to discard')

    def discard_all(self):
        #        for fn in self.checkpoints:
        #            os.remove(fn)
        self.checkpoints = []
