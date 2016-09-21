from Tkinter import *  

class TrafficLightGUI(Frame):

  def __init__(self, behaviour, master=None, title="TrafficLight"):

    self.behaviour=behaviour

    # Initialize superclass
    Frame.__init__(self, master)

    # parent frame, destruction protocol
    self.root=master
    self.root.protocol("WM_DELETE_WINDOW", self.wmQuit)

    # Initialize packer
    self.pack(fill=BOTH, expand=1)

    # Create all widgets in the Frame
    self.__createWidgets()


  def __createWidgets(self):

    self.root.configure(bg="black")
#   self.root.pack(side=LEFT, fill=BOTH, expand=1)

    Label(self.root, text="", bg="black", 
          height=2, width=10).pack(side=TOP, padx = 2, pady=2)

    self.redLight=Label(self.root, text="", bg="red",
                        relief=GROOVE, height=5, width=10)
    self.redLight.pack(side=TOP, padx = 2, pady=4)

    self.yellowLight=Label(self.root, text="", bg="black",
                           relief=GROOVE, height=5, width=10)
    self.yellowLight.pack(side=TOP, padx = 2, pady=4)

    self.greenLight=Label(self.root, text="", bg="black",
                          relief=GROOVE, height=5, width=10)
    self.greenLight.pack(side=TOP, padx = 2, pady=4)

    Label(self.root, text="",bg="black",
          height=5, width=10).pack(side=TOP,padx=2,pady=2)

# Begin generated code

    Button(self.root, text="PoliceInterrupt",
          command=self.PoliceInterruptPressed, width=10, wraplength=70).pack(side=TOP, fill=Y, padx=5, pady=2)

    Button(self.root, text="Quit",
          command=self.QuitPressed, width=10, wraplength=70).pack(side=TOP, fill=Y, padx = 5, pady = 2)
# End generated code

  # binding with behaviour

# Begin generated code
  def PoliceInterruptPressed(self):
    self.behaviour.event("PoliceInterrupt")

  def QuitPressed(self):
    self.behaviour.event("Quit")
# End generated code
  
  def wmQuit(self):
    self.root.destroy()

  # the behaviour can call these methods to change the GUI

  def setGreenOn(self):
      self.greenLight["bg"] = "green"

  def setGreenOff(self):
      self.greenLight["bg"] = "black"

  def setRedOn(self):
      self.redLight["bg"] = "red"

  def setRedOff(self):
      self.redLight["bg"] = "black"

  def setYellowOn(self):
      self.yellowLight["bg"] = "yellow"

  def setYellowOff(self):
      self.yellowLight["bg"] = "black"

import sys

class TrafficLightBehaviour:

  def __init__(self, scale=1):

    self.scale = scale
    self.currentState = None 

    self.scheduledTIMEOUT = None

  def initModel(self, gui):

    self.gui = gui

    # Begin generated code
    self.initState = "red"
    self.gui.setYellowOff()   
    self.gui.setGreenOff()   
    self.gui.setRedOn()   
    # If the target state has an outgoing timed transition,
    # upon entering that target state, a timeout needs to be scheduled.
    # Keep track of scheduledTIMEOUT to be able to cancel it later if interrupted 
    # before the timeout expires
    self.scheduledTIMEOUT =  self.gui.after(self.scale*3000, self.eventTIMEOUT) 
    # End generated code

    self.currentState = self.initState

  def eventTIMEOUT(self):
    self.event("TIMEOUT")

  def event(self, eventName):
    # Note that below, setting coloured lights can be optimized by checking source
    # and target light settings and only updating those lights that changed.
    # In the following, the more naieve approach of re-setting all lights is taken.

    # Remove a scheduled timeout, if any,
    # to ensure that if we interrupted a transition scheduled in the future
    # that scheduled transition is removed
    if self.scheduledTIMEOUT is not None:
      self.gui.after_cancel(self.scheduledTIMEOUT)
      self.scheduledTIMEOUT = None
    # Switch based on all states
    if False:
      pass
    # for all states in the automaton 
    # Begin generated code
    elif self.currentState == "blinkYellow":
      if False:      
        pass
      # For all transitions from this state
      elif eventName == "Quit":
        self.currentState = "quit" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOff()   
        self.gui.setGreenOff()   
        self.gui.setRedOff()   
      elif eventName == "PoliceInterrupt":
        self.currentState = "red" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOff()   
        self.gui.setGreenOff()   
        self.gui.setRedOn()   
        # If the target state has an outgoing timed transition,
        # upon entering that target state, a timeout needs to be scheduled.
        # Keep track of scheduledTIMEOUT to be able to cancel it later if interrupted 
        # before the timeout expires
        self.scheduledTIMEOUT =  self.gui.after(self.scale*3000, self.eventTIMEOUT) 
      elif eventName == "TIMEOUT": 
        self.currentState = "blinkBlack" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOff()   
        self.gui.setGreenOff()   
        self.gui.setRedOff()   
        # If the target state has an outgoing timed transition,
        # upon entering that target state, a timeout needs to be scheduled.
        # Keep track of scheduledTIMEOUT to be able to cancel it later if interrupted 
        # before the timeout expires
        self.scheduledTIMEOUT =  self.gui.after(self.scale*500, self.eventTIMEOUT) 
      else:
        print("ERROR: unexpected event %s received\n" % eventName) 
        sys.exit(1)
    elif self.currentState == "blinkBlack":
      if False:      
        pass
      # For all transitions from this state
      elif eventName == "Quit":
        self.currentState = "quit" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOff()   
        self.gui.setGreenOff()   
        self.gui.setRedOff()   
      elif eventName == "PoliceInterrupt":
        self.currentState = "red" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOff()   
        self.gui.setGreenOff()   
        self.gui.setRedOn()   
        # If the target state has an outgoing timed transition,
        # upon entering that target state, a timeout needs to be scheduled.
        # Keep track of scheduledTIMEOUT to be able to cancel it later if interrupted 
        # before the timeout expires
        self.scheduledTIMEOUT =  self.gui.after(self.scale*3000, self.eventTIMEOUT) 
      elif eventName == "TIMEOUT": 
        self.currentState = "blinkYellow" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOn()   
        self.gui.setGreenOff()   
        self.gui.setRedOff()   
        # If the target state has an outgoing timed transition,
        # upon entering that target state, a timeout needs to be scheduled.
        # Keep track of scheduledTIMEOUT to be able to cancel it later if interrupted 
        # before the timeout expires
        self.scheduledTIMEOUT =  self.gui.after(self.scale*500, self.eventTIMEOUT) 
      else:
        print("ERROR: unexpected event %s received\n" % eventName) 
        sys.exit(1)
    elif self.currentState == "red":
      if False:      
        pass
      # For all transitions from this state
      elif eventName == "Quit":
        self.currentState = "quit" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOff()   
        self.gui.setGreenOff()   
        self.gui.setRedOff()   
      elif eventName == "PoliceInterrupt":
        self.currentState = "blinkYellow" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOn()   
        self.gui.setGreenOff()   
        self.gui.setRedOff()   
        # If the target state has an outgoing timed transition,
        # upon entering that target state, a timeout needs to be scheduled.
        # Keep track of scheduledTIMEOUT to be able to cancel it later if interrupted 
        # before the timeout expires
        self.scheduledTIMEOUT =  self.gui.after(self.scale*500, self.eventTIMEOUT) 
      elif eventName == "TIMEOUT": 
        self.currentState = "green" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOff()   
        self.gui.setGreenOn()   
        self.gui.setRedOff()   
        # If the target state has an outgoing timed transition,
        # upon entering that target state, a timeout needs to be scheduled.
        # Keep track of scheduledTIMEOUT to be able to cancel it later if interrupted 
        # before the timeout expires
        self.scheduledTIMEOUT =  self.gui.after(self.scale*2000, self.eventTIMEOUT) 
      else:
        print("ERROR: unexpected event %s received\n" % eventName) 
        sys.exit(1)
    elif self.currentState == "green":
      if False:      
        pass
      # For all transitions from this state
      elif eventName == "Quit":
        self.currentState = "quit" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOff()   
        self.gui.setGreenOff()   
        self.gui.setRedOff()   
      elif eventName == "PoliceInterrupt":
        self.currentState = "blinkYellow" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOn()   
        self.gui.setGreenOff()   
        self.gui.setRedOff()   
        # If the target state has an outgoing timed transition,
        # upon entering that target state, a timeout needs to be scheduled.
        # Keep track of scheduledTIMEOUT to be able to cancel it later if interrupted 
        # before the timeout expires
        self.scheduledTIMEOUT =  self.gui.after(self.scale*500, self.eventTIMEOUT) 
      elif eventName == "TIMEOUT": 
        self.currentState = "yellow" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOn()   
        self.gui.setGreenOff()   
        self.gui.setRedOff()   
        # If the target state has an outgoing timed transition,
        # upon entering that target state, a timeout needs to be scheduled.
        # Keep track of scheduledTIMEOUT to be able to cancel it later if interrupted 
        # before the timeout expires
        self.scheduledTIMEOUT =  self.gui.after(self.scale*1000, self.eventTIMEOUT) 
      else:
        print("ERROR: unexpected event %s received\n" % eventName) 
        sys.exit(1)
    elif self.currentState == "yellow":
      if False:      
        pass
      # For all transitions from this state
      elif eventName == "Quit":
        self.currentState = "quit" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOff()   
        self.gui.setGreenOff()   
        self.gui.setRedOff()   
      elif eventName == "PoliceInterrupt":
        self.currentState = "blinkYellow" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOn()   
        self.gui.setGreenOff()   
        self.gui.setRedOff()   
        # If the target state has an outgoing timed transition,
        # upon entering that target state, a timeout needs to be scheduled.
        # Keep track of scheduledTIMEOUT to be able to cancel it later if interrupted 
        # before the timeout expires
        self.scheduledTIMEOUT =  self.gui.after(self.scale*500, self.eventTIMEOUT) 
      elif eventName == "TIMEOUT": 
        self.currentState = "red" # target of the transition 
        # The visual representation associated with the target state
        self.gui.setYellowOff()   
        self.gui.setGreenOff()   
        self.gui.setRedOn()   
        # If the target state has an outgoing timed transition,
        # upon entering that target state, a timeout needs to be scheduled.
        # Keep track of scheduledTIMEOUT to be able to cancel it later if interrupted 
        # before the timeout expires
        self.scheduledTIMEOUT =  self.gui.after(self.scale*3000, self.eventTIMEOUT) 
      else:
        print("ERROR: unexpected event %s received\n" % eventName) 
        sys.exit(1)
    elif self.currentState == "quit":
      # if no outgoing transitions: no code generated
      pass
    # End generated code
    else:
      print("ERROR: unexpected currentState %s\n" % self.currentState) 
      sys.exit(1)

if __name__=="__main__":
  behaviour=TrafficLightBehaviour()

  root=Tk()
  # Initialize the GUI with the behaviour model as a parameter 
  gui=TrafficLightGUI(behaviour, root)

  # Be sure to initialize the behaviour model after the GUI is created
  behaviour.initModel(gui)

  # The Tkinter main event loop
  root.mainloop()
