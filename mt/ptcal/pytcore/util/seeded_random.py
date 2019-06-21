'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import random

class SeededRandom(random.Random):
    '''
        Random class wrapper, provided a seeded random number generator
    '''
    __instantiated = False
    def __init__(self, seed=0):
        '''
            Singleton class: the single instance "INFINITY" stands for infinity.
        '''
        if SeededRandom.__instantiated:
            raise NotImplementedError("singleton class already instantiated")

        SeededRandom.__instantiatiated = True
        random.Random.__init__(self)
        self.seed(seed)


Random = SeededRandom()