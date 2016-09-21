#
# DigitalWatchGUI.py
#
# class DigitalWatchGUI provides a simple Tkinter GUI for a Digital Watch
# to add: battery dies ... DONE OCT 2008 by Reehan Shaikh reehan.shaikh@cs.mcgill.ca

# Updated for the SCCDXML compiler and AToMPM formalism by Yentl Van Tendeloo

from Tkinter import *
import tkFont
from time import *
from Tkinter import PhotoImage
import python_runtime.statecharts_core as statecharts_core

CANVAS_W = 222
CANVAS_H = 236

OVAL_X0=2
OVAL_Y0=1
OVAL_X1=CANVAS_W-OVAL_X0 
OVAL_Y1=CANVAS_H-OVAL_Y0 

RECT_X0=51
RECT_Y0=95
RECT_X1=CANVAS_W-RECT_X0+1
RECT_Y1=CANVAS_H-RECT_Y0+10 

FONT_TIME=("terminal", 14)
FONT_DATE=("terminal", 8)
FONT_NOTE=("symbol", 10)

class DigitalWatchGUI:
  
  def __init__(self, parent):
    self.controller = DigitalWatchGUI_Controller()
    self.staticGUI  = DigitalWatchGUI_Static(parent, self.controller)
    self.dynamicGUI = DigitalWatchGUI_Dynamic(self.controller)
           
class DigitalWatchGUI_Controller:

  def __init__(self):
    self.statechart = None
    self.GUI  = None
    self.battery = True
        
  def bindDynamic(self, statechart):
    self.statechart = statechart
  
  def bindStatic(self, GUI):
    self.GUI = GUI
              
  #Interface for the GUI                                 
  def window_close(self):
    import sys
    sys.exit(0)
    self.statechart.event('GUI Quit')

  def topRightPressed(self):
    self.statechart.event('topRightPressed')

  def topRightReleased(self):
    self.statechart.event('topRightReleased')
  
  def topLeftPressed(self):
    self.statechart.event('topLeftPressed')
  
  def topLeftReleased(self):
    self.statechart.event('topLeftReleased')
    
  def bottomRightPressed(self):
    self.statechart.event('bottomRightPressed')

  def bottomRightReleased(self):
    self.statechart.event('bottomRightReleased')
  
  def bottomLeftPressed(self):
    self.statechart.event('bottomLeftPressed')
  
  def bottomLeftReleased(self):
    self.statechart.event('bottomLeftReleased')

  def alarm(self):
    self.statechart.event('alarmStart')
    
  #Interface for the statechart
   
  #synchronize the state with the display:

  def batteryHalf(self):
    self.battery = False
    self.GUI.battery = False
    self.refreshDateDisplay()
 
  def batteryFull(self):
    self.battery = True
    self.GUI.battery = True
    self.refreshDateDisplay()
 
  def refreshTimeDisplay(self):
    self.GUI.drawTime()
            
  def refreshChronoDisplay(self):
    self.GUI.drawChrono()
  
  def refreshDateDisplay(self):    
    self.GUI.drawDate()
    
  def refreshAlarmDisplay(self):
    self.GUI.drawAlarm()    

   
  #Modify the state:
  
  def increaseTimeByOne(self):
    self.GUI.increaseTimeByOne()    
   
  def resetChrono(self):
    self.GUI.resetChrono()
    
  def increaseChronoByOne(self):
    self.GUI.increaseChronoByOne()
    
  #Select current display:
  def startSelection(self):
    self.GUI.startSelection()
    
  def selectNext(self):
    self.GUI.selectNext()    
       
  #Modify the state corresponing to the selection  
  def increaseSelection(self):
    self.GUI.increaseSelection()
        
  def stopSelection(self):
    self.GUI.stopSelection()
                    
         
  #Light / Alarm:
  
  def setIndiglo(self):
    self.GUI.setIndiglo()
    
  def unsetIndiglo(self):
    self.GUI.unsetIndiglo()
    
  def setAlarm(self):
    self.GUI.setAlarm()

  # Query 
  def getTime(self):
    return self.GUI.getTime()

  def getAlarm(self):
    return self.GUI.getAlarm()
     
  #Check if time = alarm set time
  def checkTime(self):
    if self.GUI.getTime()[0] == self.GUI.getAlarm()[0] and self.GUI.getTime()[1] == self.GUI.getAlarm()[1] and self.GUI.getTime()[2] == self.GUI.getAlarm()[2]:
      self.alarm()
      return True
    else:
      return False
    
class DigitalWatchGUI_Dynamic:
  
  def __init__(self, controller):
    self.controller = controller
    self.controller.bindDynamic(self)

  def setStatechart(self, controller):
    print("STATECHART set")
    self.controller_SCCD = controller
    
  def event(self, evt, param=[]):
    self.controller_SCCD.addInput(statecharts_core.Event(evt, "tkinter_input", param), 0.0)

#======================================================================#
# GUI Static class

class DigitalWatchGUI_Static(Frame):

  def __init__(self, parent, controller):
    Frame.__init__(self, parent)

    self.parent = parent
    self.controller = controller
    self.controller.bindStatic(self)
    self.battery = True
    
    tmpDate = list(localtime()[0:3]) 
    self.curDate=[tmpDate[1],tmpDate[2],int(str(tmpDate[0])[3:]) ] 
    self.dateTag=None
    
    self.curTime=list(localtime()[3:6])
    self.timeTag=None
    
    self.curAlarm=[12,0,0]
    self.alarmTag=None
    
    self.curChrono=[0,0,0]
    self.chronoTag=None
    
    self.noteImage=PhotoImage(file="./noteSmall.gif")    
    self.watchImage=PhotoImage(file="./watch.gif")
    
    self.alarmNoteTag = None
    
    self.curSelectionInfo = None
    self.curSelection     = ["hours", "minutes", "seconds",
                             "months", "days", "years"]
    self.curSelectionIndex = 0 
    
    self.lastPressed = ""
        
    self.createWidgets()
    
    #self.b_playpause.focus_force()
    parent.protocol("WM_DELETE_WINDOW", self.controller.window_close)
    
    self.drawTime()
    self.drawDate()
          
  def getTime(self):
    return self.curTime

  def getAlarm(self):
    return self.curAlarm 
    
  def createWidgets(self):

    self.pack()
    self.displayCanvas = Canvas(master=self,
                           takefocus=1,
                           width=CANVAS_W, height=CANVAS_H,
                           background="black")
  
    self.displayCanvas.pack(fill=BOTH, expand=1)
    self.displayCanvas.focus_set()
    
    self.watch = self.displayCanvas.create_image(0,0,image=self.watchImage,anchor="nw")
    
        
    self.display = self.displayCanvas.create_rectangle(RECT_X0,
                                                       RECT_Y0,
                                                       RECT_X1,
                                                       RECT_Y1,
                                                       fill="#DCDCDC")
                                                       
    self.topRightButton = self.displayCanvas.create_rectangle(CANVAS_W-13,
                                                              60,
                                                              CANVAS_W-3,
                                                              70,
                                                              fill='')

    self.topLeftButton = self.displayCanvas.create_rectangle(3,
                                                             62,
                                                             13,
                                                             72,
                                                             fill='')
                                                              
    self.bottomRightButton = self.displayCanvas.create_rectangle(CANVAS_W-10,
                                                           162,
                                                           CANVAS_W,
                                                           172,
                                                           fill='')
                                                           
    self.bottomLeftButton = self.displayCanvas.create_rectangle(3,
                                                                161,
                                                                13,
                                                                171,
                                                                fill='')
                                                                                                                                  
    self.displayCanvas.bind("<ButtonPress-1>", self.mouse1Click)
    self.displayCanvas.bind("<ButtonRelease-1>", self.mouse1Release)                                                              
                                                                                               
  def mouse1Click(self, event):
    X = self.displayCanvas.canvasx(event.x)
    Y = self.displayCanvas.canvasy(event.y)
    
    objTag = self.displayCanvas.find_closest(X,Y,halo=5)
        
    if self.topRightButton in objTag:
      self.controller.topRightPressed()
      self.lastPressed = "topRight"
    elif self.topLeftButton in objTag:
      self.controller.topLeftPressed()
      self.lastPressed = "topLeft"
    elif self.bottomLeftButton in objTag:
      self.controller.bottomLeftPressed()
      self.lastPressed = "bottomLeft"
    elif self.bottomRightButton in objTag:
      self.controller.bottomRightPressed()
      self.lastPressed = "bottomRight"
    else:
      self.lastPressed = ""
  
  def mouse1Release(self, event):
    if self.lastPressed == "topRight":
      self.controller.topRightReleased()
    elif self.lastPressed == "topLeft":
      self.controller.topLeftReleased()
    elif self.lastPressed == "bottomLeft":
      self.controller.bottomLeftReleased()
    elif self.lastPressed == "bottomRight":
      self.controller.bottomRightReleased()
    self.lastPressed=""
        
  def __intToString(self, i):
    if i<10:
      return "0"+str(i)
    else:
      return str(i)
      
  def __getTimeAsString(self):
    hours   = self.__intToString(self.curTime[0])
    minutes = self.__intToString(self.curTime[1])
    seconds = self.__intToString(self.curTime[2])        
                  
    return hours+":"+minutes+":"+seconds
    
  def __getAlarmAsString(self):  
    hours   = self.__intToString(self.curAlarm[0])
    minutes = self.__intToString(self.curAlarm[1])
    seconds = self.__intToString(self.curAlarm[2])        
                  
    return hours+":"+minutes+":"+seconds  
  
    
  def __getChronoAsString(self):
    minutes   = self.__intToString(self.curChrono[0])
    seconds   = self.__intToString(self.curChrono[1])
    centisecs = self.__intToString(self.curChrono[2])

    return minutes+":"+seconds+":"+centisecs 
    
  def __getDateAsString(self):   
    month = self.__intToString(self.curDate[0])
    day   = self.__intToString(self.curDate[1])
    year  = self.__intToString(self.curDate[2])
    
    return month+"/"+day+"/"+year
    
  def increaseHoursByOne(self):
    if self.timeTag != None:
      self.curTime[0]=(self.curTime[0]+1)%24
    else:
      self.curAlarm[0]=(self.curAlarm[0]+1)%24
    
  def increaseMinutesByOne(self):
    if self.timeTag != None:
      self.curTime[1]=(self.curTime[1]+1)%60
    else:
      self.curAlarm[1]=(self.curAlarm[1]+1)%60
  
  def increaseSecondsByOne(self):
    if self.timeTag != None:
      self.curTime[2]=(self.curTime[2]+1)%60
    else:
      self.curAlarm[2]=(self.curAlarm[2]+1)%60
    
  def increaseMonthsByOne(self):
    self.curDate[0]=(self.curDate[0]+1)%13
    if self.curDate[0]==0:
      self.curDate[0]=1
    
  def increaseDaysByOne(self):
    numDays = self.getNumDays()
    self.curDate[1]=(self.curDate[1]+1)%(numDays+1)
    if self.curDate[1]==0:
      self.curDate[1]=1
    
  def increaseYearsByOne(self):
    self.curDate[2]=(self.curDate[2]+1)%100
    if self.curDate[2]==0:
      self.curDate[2]=1
    
  def getNumDays(self):
    month = self.curDate[0]
    year  = self.curDate[2]
    numDays=0
    if month==2: #february
      if year%4==0: #leap year
        numDays=29
      else:
        numDays=28
    else:
      if (month%2==1 and month<=7) or (month%2==0 and month>=8):
        numDays=31
      else:
        numDays=30
    return numDays
    
  def stopSelection(self):
    if self.curSelectionInfo != None:
      self.parent.after_cancel(self.curSelectionInfo[0])
      self.parent.after_cancel(self.curSelectionInfo[1])
      self.parent.after_cancel(self.curSelectionInfo[2])      
      self.curSelectionInfo=None 
      
    if self.timeTag != None:
      self.drawTime()
      self.drawDate()
    else:
      self.drawAlarm()
  
  
  def increaseSelection(self):
  
    self.stopSelection()
    selection = self.curSelection[self.curSelectionIndex]

    if selection == "hours":
      self.increaseHoursByOne()     
    elif selection == "minutes":
      self.increaseMinutesByOne()
    elif selection == "seconds":
      self.increaseSecondsByOne()
    elif selection == "months":
      self.increaseMonthsByOne()
    elif selection == "days":
      self.increaseDaysByOne()
    elif selection == "years":
      self.increaseYearsByOne()
      
    if self.timeTag != None:
      self.drawTime()
      self.drawDate()      
    else:
      self.drawAlarm()
      
    self.animateSelection()
  
  def selectNext(self):
    self.stopSelection()
    if self.timeTag != None:
      numDigits=len(self.curSelection)
      self.drawTime()
      self.drawDate()
    else:
      numDigits=3
      self.drawAlarm()
    self.curSelectionIndex=(self.curSelectionIndex+1)%numDigits
    self.animateSelection()
    
  def startSelection(self):
    self.curSelectionIndex=0
    self.animateSelection()
          
  def animateSelection(self):
 
    timeFunc=None
    if self.timeTag != None:
      timeFunc=self.drawTime
    else:
      timeFunc=self.drawAlarm
 
    curSelection  = self.curSelection[self.curSelectionIndex]
    deleteEvent   = None
    creationEvent = None

    if curSelection in ["hours", "minutes", "seconds"]:
      toDrawTime    = ["hours", "minutes", "seconds"]
      toDrawTime.remove(curSelection)  
      deleteEvent   = self.parent.after(500, timeFunc, toDrawTime)      
      creationEvent = self.parent.after(1000, timeFunc)
    else:
      toDrawDate    = ["years", "months", "days"]
      toDrawDate.remove(curSelection)
      deleteEvent   = self.parent.after(500, self.drawDate, toDrawDate)      
      creationEvent = self.parent.after(1000, self.drawDate)

    animationEvent  = self.parent.after(1000,self.animateSelection)

    self.curSelectionInfo = [deleteEvent,
                             creationEvent,
                             animationEvent]    
    
    
        
  def increaseTimeByOne(self):
    self.curTime[2]=self.curTime[2]+1
    self.curTime[1]=(self.curTime[1]+self.curTime[2]/60)
    self.curTime[0]=(self.curTime[0]+self.curTime[1]/60)
    
    self.curTime[2]=self.curTime[2]%60
    self.curTime[1]=self.curTime[1]%60
    self.curTime[0]=self.curTime[0]%24
    
    if self.curTime[0]==0 and\
       self.curTime[1]==0 and\
       self.curTime[2]==0:
      self.increaseDateByOne()
                            
  def increaseDateByOne(self):  
    month = self.curDate[0]
    day   = self.curDate[1]
    year  = self.curDate[2]
    
    numMonths = 12
    numDays   = self.getNumDays()
                   
    self.curDate[1]=self.curDate[1]+1
    self.curDate[0]=(self.curDate[0]+self.curDate[1]/(numDays+1))
    self.curDate[2]=(self.curDate[2]+self.curDate[0]/(numMonths+1))
    
    self.curDate[1]=self.curDate[1]%(numDays+1)
    self.curDate[0]=self.curDate[0]%(numMonths+1)
    
  def increaseChronoByOne(self):
    self.curChrono[2]=self.curChrono[2]+1
    self.curChrono[1]=(self.curChrono[1]+self.curChrono[2]/100)
    self.curChrono[0]=(self.curChrono[0]+self.curChrono[1]/100)
    
    self.curChrono[2]=self.curChrono[2]%100
    self.curChrono[1]=self.curChrono[1]%100
    self.curChrono[0]=self.curChrono[0]%100 
    
    
  def clearDisplay(self):
    if self.alarmTag != None:
      self.displayCanvas.delete(self.alarmTag)
      self.alarmTag = None
    if self.timeTag != None:
      self.displayCanvas.delete(self.timeTag)
      self.timeTag = None
    if self.chronoTag != None:
      self.displayCanvas.delete(self.chronoTag)
      self.chronoTag = None 
      
  def clearDate(self):
    if self.dateTag != None:
      self.displayCanvas.delete(self.dateTag)
      self.dateTag = None
 
  def drawTime(self, toDraw=["hours","minutes","seconds"]): 
    timeToDraw = self.__getTimeAsString()

    if "hours" not in toDraw:
      timeToDraw="  "+timeToDraw[2:]
    if "minutes" not in toDraw:
      timeToDraw=timeToDraw[0:3]+"  "+timeToDraw[5:]
    if "seconds" not in toDraw:
      timeToDraw=timeToDraw[0:6]+"  "
      
    if not self.battery:
      timeToDraw = "88:88:88"

    self.clearDisplay()     
      
    self.timeTag =self.displayCanvas.create_text((RECT_X0+RECT_X1)/2,
                                                 (RECT_Y0+RECT_Y1)/2+5,
                                                  font = FONT_TIME,
                                                  justify = "center",
                                                  text    = timeToDraw)
                                                  
  def hideTime(self):
    if self.timeTag != None:
      self.displayCanvas.delete(self.timeTag)
      self.timeTag=None
                                                                 
  def drawChrono(self):
    chronoToDraw  = self.__getChronoAsString()

    self.clearDisplay()
      
    if not self.battery:
      chronoToDraw = "88:88:88"
      
    self.chronoTag =self.displayCanvas.create_text((RECT_X0+RECT_X1)/2,
                                                   (RECT_Y0+RECT_Y1)/2+5,
                                                  font = FONT_TIME,
                                                  justify = "center",
                                                  text    = chronoToDraw)                                                  
                                                                                                                  
  def hideChrono(self):
    if self.chronoTag != None:
      self.displayCanvas.delete(self.chronoTag)
      self.chronoTag=None
      
  def resetChrono(self):
    self.curChrono=[0,0,0]
                                           
  def drawDate(self, toDraw=["years","months","days"]):
    dateToDraw = self.__getDateAsString()
    
    if "months" not in toDraw:
      dateToDraw="  "+dateToDraw[2:]      
    if "days" not in toDraw:
      dateToDraw=dateToDraw[0:3]+"  "+dateToDraw[5:]           
    if "years" not in toDraw:
      dateToDraw=dateToDraw[0:6]+"  "

    if not self.battery:
      dateToDraw = "88/88/88"

    self.clearDate()
 
    self.dateTag=self.displayCanvas.create_text(RECT_X1-33,
                                                RECT_Y0+7,
                                                font = FONT_DATE,
                                                justify = "center",
                                                text    = dateToDraw)
                                   
  def drawAlarm(self, toDraw=["hours","minutes","seconds"]):    
    alarmToDraw = self.__getAlarmAsString()
        
    if "hours" not in toDraw:
      alarmToDraw="  "+alarmToDraw[2:]
    if "minutes" not in toDraw:
      alarmToDraw=alarmToDraw[0:3]+"  "+alarmToDraw[5:]
    if "seconds" not in toDraw:
      alarmToDraw=alarmToDraw[0:6]+"  "

    if not self.battery:
      alarmToDraw = "88:88:88"

    self.clearDisplay()
    
    self.alarmTag =self.displayCanvas.create_text((RECT_X0+RECT_X1)/2,
                                                  (RECT_Y0+RECT_Y1)/2+5,
                                                   font = FONT_TIME,
                                                   justify = "center",
                                                   text    = alarmToDraw)
                                                  
  def hideAlarm(self):
    if self.alarmTag != None:
      self.displayCanvas.delete(self.alarmTag)
      self.alarmTag=None                                   

  def setAlarm(self):
    if self.alarmNoteTag != None:
      self.displayCanvas.delete(self.alarmNoteTag)
      self.alarmNoteTag=None
    else:
      self.alarmNoteTag = self.displayCanvas.create_image(RECT_X0+5,RECT_Y0+3,image=self.noteImage,anchor="nw")     
                                           
  def setIndiglo(self):
    self.displayCanvas.itemconfigure(self.display, fill='#96DCFA')

  def unsetIndiglo(self):
    self.displayCanvas.itemconfigure(self.display, fill="#DCDCDC")      