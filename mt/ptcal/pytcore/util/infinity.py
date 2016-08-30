# -*- coding: Latin-1 -*-
## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ##
## ##
# infinity.py   
#                     --------------------------------
#                            Copyright (c) 2005
#                          Jean-Sébastien  BOLDUC
#                             Hans  Vangheluwe
#                       McGill University (Montréal)
#                     --------------------------------
#
#  - Singleton class "Inf" and unique instance "INFINITY" --- 
#    stands for infinity (to use in time advance function)
#    
## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ##
## ##

##  INFINITY OBJECT --- ADDED 04/04/2005
##  more comparison operators -- HV 12/11/2006
##
##  mul and rmul added -- Eugene 14/11/2006
## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ##
## ##

class Infty(object):
    """Singleton class: the single instance "INFINITY" stands for infinity."""
    __instantiated = False
    def __init__(self):
        if self.__instantiated:
            raise NotImplementedError, "singleton class already instantiated"
        self.__instantiatiated = True

    def __deepcopy__(self, memo):
        return self

    def __add__(self, other):
        """ INFINITY + x = INFINITY """
        return self

    def __sub__(self, other):
        """ INFINITY - x = INFINITY (if x != INF), or NaN (if x == INFINITY) """
        if other == self:
            raise ValueError, "INFINITY - INFINITY gives NaN (not defined)"
        return self

    def __mul__(self, other):
        """ INFINITY * x = INFINITY """
        return self

    def __radd__(self, other):
        """ x + INFINITY = INFINITY """
        return self

    def __rsub__(self, other):
        """ x - INFINITY = -INFINITY (if x != INFINITY), or NaN (if x == INFINITY) """
        if other == self:
            raise ValueError, "INFINITY - INFINITY gives NaN (not defined)"
        raise ValueError, "x - INFINITY gives MINUS_INFINITY (not defined)"

    def __rmul__(self, other):
        """ x * INFINITY = INFINITY """
        return self

    def __abs__(self):
        """ abs(INFINITY) = INFINITY -- absolute value """
        return self

#    def __cmp__(self, other):
#        if other is self:
#            return 0
#        else:
#            return 1

    def __eq__(self, other):
        if other is self:
            return True
        else:
            return False

    def __ne__(self, other):
        if other is self:
            return False
        else:
            return True 

    def __lt__(self, other):
        return False

    def __le__(self, other):
        if other is self:
            return True
        else:
            return False

    def __gt__(self, other):
        if other is self:
            return False
        else:
            return True 

    def __ge__(self, other):
        return True

    def __str__(self):
        return "+INFINITY"

# Instantiate singleton:    
INFINITY = Infty()

