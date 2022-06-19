#  This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
#  Copyright 2011 by the AToMPM team and licensed under the LGPL
#  See COPYING.lesser and README.md in the root of this project for full details

__author__ = "Bentley James Oakes, Istvan David"
__copyright__ = "Copyright 2022, GEODES"
__credits__ = "Eugene Syriani"
__license__ = "GPL-3.0"

class Model():
    def __init__(self, from_dict : dict = None):
        super().__init__()
        
        self.nodes = {}
        self.edges = []
        self.metamodels = []

        if from_dict:
            self.nodes = from_dict["nodes"]
            self.edges = from_dict["edges"]
            self.metamodels = from_dict["metamodels"]

    def to_dict(self) -> dict:
        return {
            "nodes": self.nodes,
            "edges": self.edges,
            "metamodels": self.metamodels,
        }