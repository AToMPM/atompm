
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
            raise NotImplementedError, "singleton class already instantiated"
        
        SeededRandom.__instantiatiated = True
        random.Random.__init__(self)
        self.seed(seed)


Random = SeededRandom()