#!/usr/bin/env python
import unittest

from MMMKModel import Model
from MMMKModelNode import Node
from MMMKModelEdge import Edge

__author__ = "Istvan David"
__copyright__ = "Copyright 2022, GEODES"
__credits__ = "Eugene Syriani"
__license__ = "GPL-3.0"


class MMMKModelTests(unittest.TestCase):
    
    model = None
    
    def setUp(self):
        self.model = Model()
        
    def tearDown(self):
        self.model = None

    def testAddVertices(self):
        model = Model()
        
        v1Name = "A"
        v2Name = "B"
        
        v1 = Node()
        v1.add("name", v1Name, 5)
        v2 = Node()
        v2.add("name", v2Name, 6)
        
        model.addVertex(v1, 10)
        self.assertTrue(model.vertexExists(v1))
        self.assertEqual(model.numberOfVertices(), 1)
        v1AdjacencySet = model.getAdjacencyListForVertex(v1)
        self.assertEqual(len(v1AdjacencySet), 0)
        
        model.addVertex(v1, 20)
        self.assertTrue(model.vertexExists(v1))
        self.assertEqual(model.numberOfVertices(), 1)
        v1AdjacencySet = model.getAdjacencyListForVertex(v1)
        self.assertEqual(len(v1AdjacencySet), 0)
        
        model.addVertex(v2, 30)
        self.assertTrue(model.vertexExists(v1))
        self.assertTrue(model.vertexExists(v2))
        self.assertEqual(model.numberOfVertices(), 2)
        v1AdjacencySet = model.getAdjacencyListForVertex(v1)
        v2AdjacencySet = model.getAdjacencyListForVertex(v2)
        self.assertEqual(len(v1AdjacencySet), 0)
        self.assertEqual(len(v2AdjacencySet), 0)
    
    def testAddEdgesToExistingVertices(self):
        model = Model()
        
        v1Name = "A"
        v2Name = "B"
        e1Name = "edgeAtoB"
        e2Name = "edgeAtoB_2"
        
        v1 = Node()
        v1.add("name", v1Name, 1)
        v2 = Node()
        v2.add("name", v2Name, 2)
        
        e1 = Edge()
        e1.add("name", e1Name, 3)
        e1.add("from", v1, 3)
        e1.add("to", v2, 3)
        
        e2 = Edge()
        e2.add("name", e2Name, 4)
        e2.add("from", v1, 4)
        e2.add("to", v2, 4)
        
        model.addVertex(v1, 10)
        model.addVertex(v2, 20)
        self.assertTrue(model.vertexExists(v1))
        self.assertTrue(model.vertexExists(v2))
        
        model.addEdge(e1, 30)
        self.assertEqual(model.numberOfVertices(), 2)
        self.assertTrue(model.edgeExists(e1))
        v1AdjacencySet = model.getAdjacencyListForVertex(v1)
        v2AdjacencySet = model.getAdjacencyListForVertex(v2)
        self.assertEqual(len(v1AdjacencySet), 1)
        self.assertEqual(len(v2AdjacencySet), 0)
        
        model.addEdge(e2, 30)
        self.assertEqual(model.numberOfVertices(), 2)
        self.assertTrue(model.edgeExists(e1))
        self.assertTrue(model.edgeExists(e2))
        v1AdjacencySet = model.getAdjacencyListForVertex(v1)
        v2AdjacencySet = model.getAdjacencyListForVertex(v2)
        self.assertEqual(len(v1AdjacencySet), 2)
        self.assertEqual(len(v2AdjacencySet), 0)
        
    def testDirectedEdgeHandling(self):
        model = Model()
        
        v1Name = "A"
        v2Name = "B"
        e1Name = "edgeAtoB"
        e2Name = "edgeBtoA"
        
        v1 = Node()
        v1.add("name", v1Name, 1)
        v2 = Node()
        v2.add("name", v2Name, 2)
        
        e1 = Edge()
        e1.add("name", e1Name, 3)
        e1.add("from", v1, 3)
        e1.add("to", v2, 3)
        
        e2 = Edge()
        e2.add("name", e2Name, 4)
        e2.add("from", v2, 4)
        e2.add("to", v1, 4)
        
        model.addVertex(v1, 10)
        model.addVertex(v2, 20)
        self.assertTrue(model.vertexExists(v1))
        self.assertTrue(model.vertexExists(v2))
        
        model.addEdge(e1, 30)
        self.assertEqual(model.numberOfVertices(), 2)
        self.assertTrue(model.edgeExists(e1))
        v1AdjacencySet = model.getAdjacencyListForVertex(v1)
        v2AdjacencySet = model.getAdjacencyListForVertex(v2)
        self.assertEqual(len(v1AdjacencySet), 1)
        self.assertEqual(len(v2AdjacencySet), 0)
        
        model.addEdge(e2, 30)
        self.assertEqual(model.numberOfVertices(), 2)
        self.assertTrue(model.edgeExists(e1))
        self.assertTrue(model.edgeExists(e2))
        v1AdjacencySet = model.getAdjacencyListForVertex(v1)
        v2AdjacencySet = model.getAdjacencyListForVertex(v2)
        self.assertEqual(len(v1AdjacencySet), 1)
        self.assertEqual(len(v2AdjacencySet), 1)
    
    def testAddEdgeToNonExistingSource(self):
        model = Model()
        
        v1Name = "A"
        v2Name = "B"
        e1Name = "edgeAtoB"
        
        v1 = Node()
        v1.add("name", v1Name, 1)
        v2 = Node()
        v2.add("name", v2Name, 2)
        
        e1 = Edge()
        e1.add("name", e1Name, 3)
        e1.add("from", v1, 3)
        e1.add("to", v2, 3)
        
        model.addVertex(v2, 10)
        self.assertFalse(model.vertexExists(v1))
        self.assertTrue(model.vertexExists(v2))
        
        self.assertRaises(KeyError, model.addEdge, e1, 30)
        
    def testAddEdgeToNonExistingDestination(self):
        model = Model()
        
        v1Name = "A"
        v2Name = "B"
        e1Name = "edgeAtoB"
        
        v1 = Node()
        v1.add("name", v1Name, 1)
        v2 = Node()
        v2.add("name", v2Name, 2)
        
        e1 = Edge()
        e1.add("name", e1Name, 3)
        e1.add("from", v1, 3)
        e1.add("to", v2, 3)
        
        model.addVertex(v1, 10)
        self.assertTrue(model.vertexExists(v1))
        self.assertFalse(model.vertexExists(v2))
        
        self.assertRaises(KeyError, model.addEdge, e1, 30)
    
    def testRemoveExistingEdge(self):
        model = Model()
        
        v1Name = "A"
        v2Name = "B"
        e1Name = "edgeAtoB"
        
        v1 = Node()
        v1.add("name", v1Name, 1)
        v2 = Node()
        v2.add("name", v2Name, 2)
        
        e1 = Edge()
        e1.add("name", e1Name, 3)
        e1.add("from", v1, 3)
        e1.add("to", v2, 3)
        
        model.addVertex(v1, 10)
        model.addVertex(v2, 20)
        model.addEdge(e1, 30)
        
        self.assertTrue(model.vertexExists(v1))
        self.assertTrue(model.vertexExists(v2))
        self.assertTrue(model.edgeExists(e1))
        
        model.removeEdge(e1, 40)
        self.assertTrue(model.vertexExists(v1))
        self.assertTrue(model.vertexExists(v2))
        self.assertFalse(model.edgeExists(e1))
    
    def testRemoveNonExistingEdge(self):
        model = Model()
        
        v1Name = "A"
        v2Name = "B"
        e1Name = "edgeAtoB"
        
        v1 = Node()
        v1.add("name", v1Name, 1)
        v2 = Node()
        v2.add("name", v2Name, 2)
        
        e1 = Edge()
        e1.add("name", e1Name, 3)
        e1.add("from", v1, 3)
        e1.add("to", v2, 3)
        
        model.addVertex(v1, 10)
        model.addVertex(v2, 20)
        
        self.assertTrue(model.vertexExists(v1))
        self.assertTrue(model.vertexExists(v2))
        self.assertFalse(model.edgeExists(e1))
        
        self.assertRaises(Exception, model.removeEdge, e1, 40)
        
    def testRemoveVertexWithoutEdges(self):
        model = Model()
        
        v1Name = "A"
        v2Name = "B"
        
        v1 = Node()
        v1.add("name", v1Name, 1)
        v2 = Node()
        v2.add("name", v2Name, 2)
        
        model.addVertex(v1, 10)
        model.addVertex(v2, 20)
        
        self.assertTrue(model.vertexExists(v1))
        self.assertTrue(model.vertexExists(v2))
        
        model.removeVertex(v1, 30)
        self.assertFalse(model.vertexExists(v1))
        self.assertTrue(model.vertexExists(v2))
        
        model.removeVertex(v2, 40)
        self.assertFalse(model.vertexExists(v1))
        self.assertFalse(model.vertexExists(v2))
        
    def testRemoveVertexWithOutgoingEdge(self):
        model = Model()
        
        v1Name = "A"
        v2Name = "B"
        e1Name = "edgeAtoB"
        
        v1 = Node()
        v1.add("name", v1Name, 1)
        v2 = Node()
        v2.add("name", v2Name, 2)
        
        e1 = Edge()
        e1.add("name", e1Name, 3)
        e1.add("from", v1, 3)
        e1.add("to", v2, 3)
        
        model.addVertex(v1, 10)
        model.addVertex(v2, 20)
        model.addEdge(e1, 30)
        
        self.assertTrue(model.vertexExists(v1))
        self.assertTrue(model.vertexExists(v2))
        self.assertTrue(model.edgeExists(e1))
        
        self.assertRaises(Exception, model.removeVertex, v1, 30)
        self.assertTrue(model.vertexExists(v1))
        self.assertTrue(model.vertexExists(v2))
        
    def testRemoveVertexWithIncomingEdge(self):
        model = Model()
        
        v1Name = "A"
        v2Name = "B"
        e1Name = "edgeAtoB"
        
        v1 = Node()
        v1.add("name", v1Name, 1)
        v2 = Node()
        v2.add("name", v2Name, 2)
        
        e1 = Edge()
        e1.add("name", e1Name, 3)
        e1.add("from", v1, 3)
        e1.add("to", v2, 3)
        
        model.addVertex(v1, 10)
        model.addVertex(v2, 20)
        model.addEdge(e1, 30)
        
        self.assertTrue(model.vertexExists(v1))
        self.assertTrue(model.vertexExists(v2))
        self.assertTrue(model.edgeExists(e1))
        
        self.assertRaises(Exception, model.removeVertex, v2, 40)
        self.assertTrue(model.vertexExists(v1))
        self.assertTrue(model.vertexExists(v2))
        
    def testGraphAsEdgeEndpoint(self):
        model = Model()
        model.add("name", "root", 1)
        
        v1Name = "A"
        e1Name = "edgeRootToA"
        
        v1 = Node()
        v1.add("name", v1Name, 2)
        
        e1 = Edge()
        e1.add("name", e1Name, 3)
        e1.add("from", model, 3)
        e1.add("to", v1, 3)
        
        model.addVertex(v1, 10)
        self.assertTrue(model.vertexExists(v1))
        
        model.addEdge(e1, 30)
        self.assertEqual(model.numberOfVertices(), 1)
        self.assertTrue(model.edgeExists(e1))
        v1AdjacencySet = model.getAdjacencyListForVertex(v1)
        self.assertEqual(len(v1AdjacencySet), 0)
        graphVirtualAdjacencySet = model.getAdjacencyListForVertex(model)
        self.assertEqual(len(graphVirtualAdjacencySet), 1)    
        
if __name__ == "__main__":
    unittest.main()
