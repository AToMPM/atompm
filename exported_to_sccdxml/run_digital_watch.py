from Tkinter import *
from DigitalWatchGUI import DigitalWatchGUI
import digitalwatch
from python_runtime.tkinter_eventloop import *

def update(fixed_update_time, controller):
	controller.update(fixed_update_time / 1000.0)
	root.after(fixed_update_time, update, fixed_update_time, controller)

root = Tk()
root.withdraw()
topLevel = Toplevel(root)
topLevel.resizable(width=NO, height=NO)
topLevel.title("DWatch")
gui = DigitalWatchGUI(topLevel)

try:
	controller = digitalwatch.Controller(gui.controller, TkEventLoop(root))
	controller.start()
	gui.dynamicGUI.setStatechart(controller)
	root.mainloop()
finally:
	controller.stop()