#  This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
#  Copyright 2011 by the AToMPM team and licensed under the LGPL
#  See COPYING.lesser and README.md in the root of this project for full details
import time
import uuid

from lowkey.lww.LWWVertex import LWWVertex
from lowkey.collabtypes.Clock import Clock

__author__ = "Istvan David"
__copyright__ = "Copyright 2022, GEODES"
__credits__ = "Eugene Syriani"
__license__ = "GPL-3.0"

class Node(LWWVertex):
    def __init__(self):
        super().__init__()
        self.__id = uuid.uuid1()
        self._clock = Clock.setUp()
    
    def currentTime(self):
        return self._clock.currentTime()
    
    def setName(self, name):
        if self.lookup('name'):
            self.update('name', name, self.currentTime())
        else:
            self.add('name', name, self.currentTime())

    """
        "name": {"type": "string", "value": "Class_"},
        "attributes": {"type": "list<$ATTRIBUTE>", "value": []},
        "constraints": {"type": "list<$EVENT_HANDLER>", "value": []},
        "actions": {"type": "list<$EVENT_HANDLER>", "value": []},
        "cardinalities": {"type": "list<$CARDINALITY>", "value": []},
        "abstract": {"type": "boolean", "value": false},
        "$type": "/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram/Class"
    """