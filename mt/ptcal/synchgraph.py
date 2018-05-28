'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

from petrinet import *
from threading import *
import igraph as ig
import Queue as q
from random import choice


class synchgraph:
  id  = 0
  def __init__(self,modnum,M0):
    self.modnum = modnum
    self.sg = ig.Graph(0,directed=True)
    self.M0 = M0
    self.sg.add_vertices(1)
    self.sg.vs[0]['M'] = M0
    self.last = M0
  
  def summary(self):
    ig.summary(self.sg)
  
  def statePresent(self, M):
    for v in self.sg.vs:
      #for key,value in v['M']:
      if all(v['M'] == M):
        #print 'marking present in synchgraph'
        return v.index
    return -1
  
  def statePresentReach(self, M):
    for v in self.sg.vs:
      #for key,value in v['M']:
      if all(v['SM'] == M):
        #print 'marking present in synchgraph'
        return v.index
    return -1
  
  def addMarkingBatch(self,T,from_prod,to_prod):
    new = None
    for i in range(len(from_prod[0])):
       new = self.addMarking(from_prod[0][i],to_prod[0][i],T,self.last)
    self.last = new
    #self.graph(synchgraph.id);
    #synchgraph.id+=1
  
  def addMarking(self,Ms,Mnew,Arc,last):
    fr = self.statePresent(last)
    to = self.statePresent(Mnew)
    
    #self.last = Mnew
    if not to == -1:
      self.sg.add_edges([(fr,to)])
      self.sg.es[self.sg.get_eid(fr, to)]['T'] = '%s,%s'%(Ms,Arc)
    else:
      self.sg.add_vertices(1)
      to = self.sg.vcount()-1
      self.sg.vs[to]['M'] = Mnew
      self.sg.add_edges([(fr,to)])
      self.sg.es[self.sg.get_eid(fr, to)]['T'] = '%s,%s'%(Ms,Arc)
    return Mnew
  
  def markSCC(self, modules):
    for v in self.sg.vs:
      newval = []
      for value in v['M']:
        ls = value.split('-')
        new = '%s-%d'%(ls[0],modules[ls[0]].getSCCvid(ls[1]))
        newval.append(new)
      v['SM'] = newval
      
  
  def graph(self,id=None):
    key = choice(range(20))
    vattr=''
    eattr = ''
    nodes = {}
    graph = pydot.Dot(key, graph_type='digraph')
    dateTag = datetime.datetime.now().strftime("%Y-%b-%d_%H-%M-%S")
    for v in self.sg.vs:
      #sort(v['M'])
     # vattr +='('
#      i = len(v['M'])
#      leng = i
#      j=0
      if 'SM' in self.sg.vs.attribute_names():
        vattr+='ssc\n';
        for value in v['SM']:
  #        if leng == 1:
  #         if 'SCC' in self.sg.vs.attribute_names():
  #            vattr +='SCC-%s\n'%v['SCC']
  #         vattr = 'fstate%d'%choice(range(100))
  #        else:
            #if int(value) > 0:
  #          if 'SCC' in self.sg.vs.attribute_names():
  #            vattr +='SCC-%s\n'%v['SCC']
            vattr += '%s'%(value.capitalize())
      else: 
        for value in v['M']:
  #        if leng == 1:
  #         if 'SCC' in self.sg.vs.attribute_names():
  #            vattr +='SCC-%s\n'%v['SCC']
  #         vattr = 'fstate%d'%choice(range(100))
  #        else:
            #if int(value) > 0:
  #          if 'SCC' in self.sg.vs.attribute_names():
  #            vattr +='SCC-%s\n'%v['SCC']
            vattr += '%s'%(value.capitalize())
#        if not i-1 == 0:
#          pass#vattr+=','
       # i -=1
        #j+=1
      #vattr +=')'
      nodes[v.index] = pydot.Node(vattr)
      graph.add_node(nodes[v.index])
      vattr = ''
    for e in self.sg.es:
      #pass
      #need to have later
      graph.add_edge(pydot.Edge(nodes[e.source],nodes[e.target],label=e['T']))
    #graph.write_svg('graphs/STATE%s%d%s.svg'%(self.key,choice(range(100)),dateTag))
    if id == None:
      graph.write_svg('../graphs/SYNCH%s%d%s.svg'%(key,choice(range(100)),dateTag))
    else:
      graph.write_svg('../graphs/SYNCH%d.svg'%(id))
  
#  def process(self,packet):
#    if packet.ismarking():
#      self.marking[packet.key()] = packet.payload() 
#    else:
#      
#    if len(self.marking) == self.modnum and not self.wait:
#      self.createNode()
#  
#  def run(self):
#    #get initial states from the queue
#    while not self.done:
#      packet = self.queue.get(block=True, timeout=None)
#      self.process(packet)