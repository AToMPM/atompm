from threading import *

#Barrier implementation from here
#From http://greenteapress.com/semaphores/index.html
class barrier:
   def __init__(self, n):
     self.n = n
     self.count = 0
     self.mutex = Semaphore(1)
     self.turnstile = Semaphore(0)
     self.turnstile2 = Semaphore(0)
  
   def phase1(self):
     self.mutex.acquire()
     self.count += 1
     if self.count == self.n:
       for i in range(self.n):
         self.turnstile.release()
     self.mutex.release()
     self.turnstile.acquire()
  
   def phase2(self):
     self.mutex.acquire()
     self.count -= 1
     if self.count == 0:
       for i in range(self.n):
         self.turnstile2.release()
     self.mutex.release()
     self.turnstile2.acquire()
  
   def wait(self):
     self.phase1()
     self.phase2()
