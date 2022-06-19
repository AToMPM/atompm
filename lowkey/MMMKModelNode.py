#  This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
#  Copyright 2011 by the AToMPM team and licensed under the LGPL
#  See COPYING.lesser and README.md in the root of this project for full details

from lowkey.lww.LWWVertex import LWWVertex

__author__ = "Istvan David, Bentley James Oakes"
__copyright__ = "Copyright 2022, GEODES"
__credits__ = "Eugene Syriani"
__license__ = "GPL-3.0"

class Node(LWWVertex):
    def __init__(self):
        super().__init__()