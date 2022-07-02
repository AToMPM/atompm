#!/usr/bin/env python
import unittest

from MMMKModel import Model
from MMMKModelNode import Node
from MMMKModelEdge import Edge

__author__ = "Istvan David"
__copyright__ = "Copyright 2022, GEODES"
__credits__ = "Eugene Syriani"
__license__ = "GPL-3.0"


class MMMKModelLWWTests(unittest.TestCase):
    
    model = None
    
    def setUp(self):
        self.model = Model()
        
    def tearDown(self):
        self.model = None

    def testAddVertices(self):
        v1Name = "A"
        v2Name = "B"
        
        v1 = Node()
        v1.setName(v1Name)
        v2 = Node()
        v2.setName(v2Name)
        
        self.model.addVertex(v1, 10)
        self.assertTrue(self.model.vertexExists(v1))
        self.assertEqual(self.model.numberOfVertices(), 1)
        v1AdjacencySet = self.model.getAdjacencyListForVertex(v1)
        self.assertEqual(len(v1AdjacencySet), 0)
        
        self.model.addVertex(v2, 30)
        self.assertTrue(self.model.vertexExists(v1))
        self.assertTrue(self.model.vertexExists(v2))
        self.assertEqual(self.model.numberOfVertices(), 2)
        v1AdjacencySet = self.model.getAdjacencyListForVertex(v1)
        v2AdjacencySet = self.model.getAdjacencyListForVertex(v2)
        self.assertEqual(len(v1AdjacencySet), 0)
        self.assertEqual(len(v2AdjacencySet), 0)
        
if __name__ == "__main__":
    unittest.main()
