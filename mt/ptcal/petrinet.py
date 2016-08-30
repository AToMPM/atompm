#from numpy  import *
import igraph as ig
import datetime
#import pydot
from threading import *
from Queue import *
from barrier import *
from random import choice
from sets import *

class  PnModule(Thread):
  
  def __init__(self, pnet, que, bar, full=False):
    Thread.__init__(self)
    '''Our graph'''
    self.pngraph = pnet;
    P = self.pngraph.vs.select(type_eq = 'P')
    key = P[0]['name'][:1]
    self.key = key
    #index in matrix to graph id
    self.mx_to_gr_indexT = {}
    self.mx_to_gr_indexP = {}
    self.mx_to_gr_indexTn = {}
    self.mx_to_gr_indexPn = {}
    self.que = que
    self.barrier = bar
    self.TFtoRun = {}
    self.ssc = 0
    self.full = full
    self.result={}
    self.xxx = 0
    
  def repstr(self,string, length):
    return (string * length)[0:length]
    
  def printMatrix(self,M):
    lenr = len(M[0])
    lenc = len(M)
    first = True
    i = 0
    j = 0
    text = ''
    colwidth = []
    for x in range(lenr):
      text+=self.pngraph.vs[self.mx_to_gr_indexT[x]]['name']+' '
      colwidth.append(len(self.pngraph.vs[self.mx_to_gr_indexT[x]]['name'])+1)
    text+='\n'
    for row in M:
      for el in row:
        text += '%d'%el+self.repstr(' ', colwidth[j]-len(str(int(el))))
        j+=1
      text += self.pngraph.vs[self.mx_to_gr_indexP[i]]['name']
      text+='\n'
      j=0
      i+=1
    print text
      
  def summary(self):
    ig.summary(self.reachability)
  
  def getKey(self):
    return self.key  
    
  def next(self):
    self.ssc += 1
    return self.ssc
  
  def DminPlusMatrix(self):
    i = 0
    j = 0
    self.incidence  = zeros((self.numP,self.numT,))
    for p in self.P:
      self.mx_to_gr_indexP[i]=p.index
      self.mx_to_gr_indexPn[p['name']]=i
      self.M0[i]=p['nbTokens']
      totrans = self.pngraph.successors(p.index)
      fromtrans = self.pngraph.predecessors(p.index)
      toweight = 0
      fromweight = 0
      for t in self.T:
        if t.index in totrans:
          self.dminus[i][j] = 1
          toweight = int(self.pngraph.es[self.pngraph.get_eid(p.index,t.index)]['weight'])
          self.dminus[i][j] = toweight
        if t.index in fromtrans:
          self.dplus[i][j] = 1
          fromweight = int(self.pngraph.es[self.pngraph.get_eid(t.index,p.index)]['weight'])
          self.dplus[i][j] = fromweight
        #print t['name']
#        if t.index in totrans:
#          self.dminus[i][j] = 1
#        elif t.index in fromtrans:
#          self.dplus[i][j] = 1
#        else:
#          pass#row.append(0)
        self.mx_to_gr_indexTn[t['name']] = j
        self.mx_to_gr_indexT[j] = t.index
        j+=1
      i+=1
      j = 0
#    self.printMatrix(self.dminus)
#    self.printMatrix(self.incidence)
#    self.printMatrix(self.dplus)
  
  #get Strongly connected components, used in modular analysis
  def getSCC(self,M):
    vindex = statePresent(M)
    if not vindex == -1:
      return self.reachability.vs[vindex]['SCC']
    else: 
      return -1
    
  def getSCCvid(self,id):
    P = self.reachability.vs[int(id)]
    return self.reachability.vs[int(id)]['SCC']

  
  def statePresent(self, M):
    for v in self.reachability.vs:
      if all(v['M'] == M):
        return v.index
    return -1
  
  #get all enabled transitions for state exploration
  def enabledT(self,M):
    enabled=[]
    for j in range(self.numT):
      good = True 
      
      tcol = self.dminus[0:self.numP,j] #Ti column over P as rows
      for i in range(self.numP):
        if tcol[i] > 0:
          t = self.mx_to_gr_indexT[j]
          p = self.mx_to_gr_indexP[i]
          weight = int(self.pngraph.es[self.pngraph.get_eid(p,t)]['weight'])
          if not M[i] >= weight : 
            good = False
            break
      if good:
       # print 'Enabled trans %s'%self.pngraph.vs[self.mx_to_gr_indexT[j]]['name']
        enabled.append(j)
    return enabled
  
  #produce new marking
  def fire(self,j,M,fusion=False):
    if fusion:
      empty = []
      empty.append(j)
      return empty
    else: 
      i = 0
      marking = ''
      for value in M:
        marking+=' %s-%d'%(self.pngraph.vs[self.mx_to_gr_indexP[i]]['name'],value)
        i+=1
      #print 'Old marking %s'%marking
      ts = zeros(self.numT) #array of Ts to fire, fire one transition indexed by j
      ts[j] = 1
      Mnew = M + dot(self.incidence,ts)
      #print 'Fire %s'%self.pngraph.vs[self.mx_to_gr_indexT[j]]['name']
      marking = ''
      i=0
      for value in Mnew:
        marking+=' %s-%d'%(self.pngraph.vs[self.mx_to_gr_indexP[i]]['name'],value)
        i+=1
      #print 'New marking %s'%marking
      return Mnew
  
  #create reachability graph
  def reachabilityG(self):
    work=[]
    work.append(self.M0)
    self.reachability.add_vertices(1)
    self.reachability.vs[0]['M'] = self.M0
    while work:
      M = work.pop()
      #del(work[-1])
      fromID = self.statePresent(M)
      enabledTs = self.enabledT(M)
      for i in enabledTs:
        Mnew = self.fire(i,M)
        idFound = self.statePresent(Mnew)
        if idFound == -1:
          self.reachability.add_vertices(1)
          newID = self.reachability.vcount()-1
          self.reachability.vs[newID]['M'] = Mnew
          #print fromID
          self.reachability.add_edges([(fromID,newID)])
          self.reachability.es[self.reachability.get_eid(fromID, newID)]['T'] = self.pngraph.vs[self.mx_to_gr_indexT[i]]['name']
          work.append(Mnew)
        else:
          self.reachability.add_edges([(fromID,idFound)])
          self.reachability.es[self.reachability.get_eid(fromID, idFound)]['T'] = self.pngraph.vs[self.mx_to_gr_indexT[i]]['name']
    self.barrier.wait() #several modules can run in parallel (comes from modular analysis) wait for all to finish.
  
  #mark strong components of a graph
  def SC(self):
    if not 'SCC' in self.reachability.vs.attribute_names():
          self.reachability.vs[0]['SCC'] = self.next()
    
    components = self.reachability.clusters(mode=ig.STRONG)
    for i in range(len(components)):
      ssc = self.next()
      changed = False
      partial = False
      for s in components[i]:
        if self.reachability.vs[s]['SCC']>=0:
          pass
        else:
          self.reachability.vs[s]['SCC'] = ssc 
          changed = True
      if not changed:
        self.ssc -= 1
  
  #Transition fusion sets, modular analysys
  def addToEnabledTF(self,TF,M):
    if not TF in self.TFtoRun:
      self.TFtoRun[TF]=[]
    for m in self.TFtoRun[TF]:
      if all(m==M) :
        #print' duplicate'
        return 
  
    self.TFtoRun[TF].append(M)
   # vattr = ''
  #  j =0 
  #  for id in M:
    #  vattr += '%s-%s,'%(self.pngraph.vs[self.mx_to_gr_indexP[j]]['name'],int(id))
   #   j+=1
    #print 'adding %s to enabled Fusion transitions'%vattr
    
  #for modular analysis
  def explore(self,id):
    work = []
    work.append(id)
    while work:
      vid = work.pop()
      #print 'explore name %s'%self.reachability.vs[vid]['M'] 
      M = self.reachability.vs[vid]['M']
      enabledTs = self.enabledT(M)
      for i in enabledTs:
        if self.pngraph.vs[self.mx_to_gr_indexT[i]]['fusion'] == True: #new
          self.addToEnabledTF(self.pngraph.vs[self.mx_to_gr_indexT[i]]['name'],M) #new
          continue #noted the shared transition continue exploring.
      self.reachability.vs[vid]['visited'] = True
      succ = self.reachability.successors(vid)
      for i in succ:
        if not self.reachability.vs[i]['visited']:
          work.append(i)
    self.reset()

  def reset(self):
    for p in self.reachability.vs:
      p['visited']= False
      
  def reachabilityModular(self):
    work=[]
    sgwork=[]
    work.append(self.M0)
    self.reachability.add_vertices(1)
    self.reachability.vs[0]['M'] = self.M0
    xxx = 0;
    exp = False
    while self.run:
      while work:
        M = work.pop()
        fromID = self.statePresent(M)
        enabledTs = self.enabledT(M)
        from_M = []
        for i in enabledTs: 
          if self.pngraph.vs[self.mx_to_gr_indexT[i]]['fusion'] == True: #new
            self.addToEnabledTF(self.pngraph.vs[self.mx_to_gr_indexT[i]]['name'],M) #new
            continue #noted the shared transition continue exploring.
          else:
            Mnew = self.fire(i,M)
          idFound = self.statePresent(Mnew)
          if idFound == -1:
            self.reachability.add_vertices(1)
            newID = self.reachability.vcount()-1
            self.reachability.vs[newID]['M'] = Mnew
            #print 'add edge src %d-dest %d name %s'%(fromID,newID,self.pngraph.vs[self.mx_to_gr_indexT[i]]['name'])
            self.reachability.add_edges([(fromID,newID)])
            self.reachability.es[self.reachability.get_eid(fromID, newID)]['T'] = self.pngraph.vs[self.mx_to_gr_indexT[i]]['name']
            #if not self.pngraph.vs[self.mx_to_gr_indexT[i]]['fusion'] == True:
            work.append(Mnew)
            #if self.pngraph.vs[self.mx_to_gr_indexT[i]]['fusion'] == True:
            #self.reachability.es[self.reachability.get_eid(fromID, newID)]['fusion'] = True
          else:
            if exp:
              pass
              #BACKWARDS
              #self.explore(idFound)
            self.reachability.add_edges([(fromID,idFound)])
            self.reachability.es[self.reachability.get_eid(fromID, idFound)]['T'] = self.pngraph.vs[self.mx_to_gr_indexT[i]]['name']
            if self.pngraph.vs[self.mx_to_gr_indexT[i]]['fusion'] == True:
              self.reachability.es[self.reachability.get_eid(fromID, idFound)]['fusion'] = True
      self.barrier.wait()
      exp = False
      self.graph(xxx);
      xxx+=1;
      ts = self.que.get(block=True,timeout=None)
      self.result={}
      res = {}
      if '@exit' in ts:
        self.run = False
        break
      for t in ts:
        self.result[t]=[]
        j = self.mx_to_gr_indexTn[t]
       # Mse = self.reachability.es.select(T_eq=t)
        from_M = []
        to_M = []
        for M in self.TFtoRun[t]: #loop over synchtransition edges
          exp = True
          Mnew  = self.fire(j, M) #use marking at the source of the edge
          if self.statePresent(Mnew) == -1:
            self.reachability.add_vertices(1) #add this new marking
            newID = self.reachability.vcount()-1 # to the reachability
            self.reachability.vs[newID]['M'] = Mnew 
            work.append(Mnew)
          from_M.append(self.statePresent(M))
          to_M.append(self.statePresent(Mnew))
          
        self.result[t].append(from_M)
        self.result[t].append(to_M)
      for ftlists in self.result:
        for from_to in self.result[ftlists]:
          for i in range(len(from_to)):
            from_to[i] = '%s-%d'%(self.key,from_to[i])
            
            
      for t in ts:
        del self.TFtoRun[t] #remove processed maybe not yet?
  
  def rnode(self,id,state):
    vattr = ""
    j=0
    i = len(state)
    for value in state:
      vattr += '%s-%s'%(self.pngraph.vs[self.mx_to_gr_indexP[j]]['name'],int(value))
      if not i-1 == 0:
        vattr+=','
      i -=1
      j+=1
    return "<node id=\"%s\"><marking>%s"%(id,vattr)+"</marking></node>\n"
	
  #export reachability graph to xml
  def reachtoxml(self,fname='',key=''):
    header = "<rgraph>\n"
    end = "</rgraph>"
    for v in self.reachability.vs:
      header+=self.rnode(v.index,v['M'])
    
    for e in self.reachability.es:
      header+="<edge source=\"%s\" target=\"%s\"><transition>%s</transition></edge>\n"%(e.source,e.target,e['T'])
    dateTag = datetime.datetime.now().strftime("%Y-%b-%d_%H-%M-%S")
    f = open('%s.%s.reachability.xml'%(fname,key),'w')
    header+=end
    f.write(header)
    f.close()
	  
  def graph(self,key,fname='',id=None):
    vattr=''
    eattr = ''
    nodes = {}
    graph = pydot.Dot(self.key, graph_type='digraph')
    dateTag = datetime.datetime.now().strftime("%Y-%b-%d_%H-%M-%S")
    for v in self.reachability.vs:
      i = len(v['M'])
      leng = i
      j=0
      if 'SCC' in self.reachability.vs.attribute_names():
        vattr +='SCC-%s\n'%v['SCC']
      for value in v['M']:
        if leng == 1:
          vattr = 'fstate%d'%choice(range(100))
        else:
          if int(value) > 0:
            
            vattr += '%s-%s '%(self.pngraph.vs[self.mx_to_gr_indexP[j]]['name'],int(value))
          if not i-1 == 0:
            pass#vattr+=','
        i -=1
        j+=1
      #vattr+='\nid-%d'%v.index;
      #vattr +=')'
      nodes[v.index] = pydot.Node(vattr)
      graph.add_node(nodes[v.index])
      vattr = ''
    for e in self.reachability.es:
      graph.add_edge(pydot.Edge(nodes[e.source],nodes[e.target],label=e['T']))
    #graph.write_svg('graphs/STATE%s%d%s.svg'%(self.key,choice(range(100)),dateTag))
    if not fname:
      graph.write_svg('graphs/STATE%s%d%s.svg'%(self.key,choice(range(100)),dateTag))
    else:
      graph.write_svg('%s.%s.reachability.svg'%(fname,key))
  
  #the thread per module
  def run(self):
    self.reachability = ig.Graph(0,directed=True)
    TF = self.pngraph.vs.select(fusion_eq = True)
    self.TFS = []
    for tf in TF:
      self.TFS.append(tf['name'])
    self.P = self.pngraph.vs.select(type_eq = 'P')
    self.key = self.P[0]['name'][:1]
    self.T = self.pngraph.vs.select(type_eq = 'T')
    self.numP = len(self.P.indices)
    self.numT = len(self.T.indices)
    #Get places and transitions
    self.M0 = zeros(self.numP)
    self.dminus = zeros((self.numP,self.numT,))
    self.dplus = zeros((self.numP,self.numT,))
    self.DminPlusMatrix()
    self.incidence = self.dplus - self.dminus
    self.printMatrix(self.incidence)
    if self.full:
      self.reachabilityG()
    else:  
      self.reachabilityModular()
  
  def reachable(self, state):
    P = zeros(self.numP)
    for ps in state:
      for key,value in ps.items():
        index = self.mx_to_gr_indexPn[key]
        P[index] = value
    id = self.statePresent(P)
    if not id==-1:
      return True
    else:
      return False
  
  def reachableMod(self,state):
    P = zeros(self.numP)
    for ps in state:
      for key,value in ps.items():
        index = self.mx_to_gr_indexPn[key]
        P[index] = value
    id = self.statePresent(P)
    components = self.markAncestors(id)
    return Set(components)
    
  def markAncestors(self,id):
    work = []
    result = []
    work.append(id)
    while work:
      vid = work.pop()
      result.append(self.reachability.vs[vid]['SCC'])
      self.reachability.vs[vid]['visitedd'] = True
      ancestors = self.reachability.predecessors(vid)
      for i in ancestors:
        if not self.reachability.vs[i]['visitedd']:
          work.append(i)
    #self.reset()
    return result
      
    
  def getEnabledTFs(self):
    return self.TFtoRun.keys()


