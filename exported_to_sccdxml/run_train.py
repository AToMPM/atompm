from Tkinter import *
import random
import math

import train
from python_runtime.statecharts_core import Event
from python_runtime.tkinter_eventloop import *

width_railway = 20
marked = {}
kind_of_object = {}

class SimulationGUI(Tk):
    def __init__(self):
        def update_scale(value):
            if hasattr(self, "controller"):
                self.controller.addInput(Event("accel", "tkinter_input", [float(value)]))

        def press_continue():
            self.controller.addInput(Event("continue", "tkinter_input", []))

        def press_pause():
            self.controller.addInput(Event("pause", "tkinter_input", []))

        def press_open():
            self.controller.addInput(Event("open", "tkinter_input", []))

        def press_close():
            self.controller.addInput(Event("close", "tkinter_input", []))

        def press_awake():
            self.controller.addInput(Event("awake", "tkinter_input", []))

        Tk.__init__(self)
        self.travelled_x = 0.0
        self.travelled_x_int = 0
        self.next_light = 0.0
        self.frame = Frame(self)
        self.frame.focus_set()
        self.resizable(0, 0)
        self.canvas = Canvas(self.frame, height=150, width=1000, bg="white")
        self.img_train = PhotoImage(file="imgs/train.gif")
        self.img_red = PhotoImage(file="imgs/red.gif")
        self.img_yellow = PhotoImage(file="imgs/yellow.gif")
        self.img_green = PhotoImage(file="imgs/green.gif")
        self.img_station = PhotoImage(file="imgs/station.gif")
        self.img_railway = PhotoImage(file="imgs/rail.gif")

        self.label_error = Label(self.frame, text="")
        self.slider_acceleration = Scale(self.frame, command=update_scale, orient=HORIZONTAL, resolution=0.01, from_=-1, to=1)
        self.button_continue = Button(self.frame, text="continue", command=press_continue)
        self.button_pause = Button(self.frame, text="pause", command=press_pause)
        self.button_open = Button(self.frame, text="open", command=press_open)
        self.button_close = Button(self.frame, text="close", command=press_close)
        self.button_poll = Button(self.frame, text="poll", command=press_awake)

        self.label_speed = Label(self.frame, text="")
        self.label_doors = Label(self.frame, text="Doors are CLOSED")

        self.items = []
        self.rails = []
        x = 0
        while x <= 1000 + width_railway:
            self.rails.append(self.canvas.create_image(x, 80, image=self.img_railway, anchor=NW))
            x += width_railway

        self.item_train = self.canvas.create_image(0, 75, image=self.img_train, anchor=NW)
        self.label_speed.grid(row=0, column=0, columnspan=2)
        self.label_doors.grid(row=1, column=0, columnspan=2)
        self.canvas.grid(row=2, column=0, columnspan=2, sticky=W)
        self.label_error.grid(row=3, column=0, columnspan=2)
        self.slider_acceleration.grid(row=4, column=0, columnspan=2, sticky=W+E)
        self.button_continue.grid(row=5, column=0, sticky=W+E)
        self.button_pause.grid(row=5, column=1, sticky=W+E)
        self.button_open.grid(row=6, column=0, sticky=W+E)
        self.button_close.grid(row=6, column=1, sticky=W+E)
        self.button_poll.grid(row=7, column=0, columnspan=2, sticky=W+E)
        self.frame.grid()

        self.remainder = 0.0
        self.next_station = 1000
        self.counter = 0
        self.train = None
        self.light_change_events = []
        self.updateState()
        self.after(20, self.throwEvents)
        
    def openDoors(self):
        self.label_doors.config(text="Doors are OPEN")

    def closeDoors(self):
        self.label_doors.config(text="Doors are CLOSED")
    
    def trainIs(self, train):
        self.train = train
        
    def throwEvents(self):
        # Check if we passed anything
        if hasattr(self, "controller"):
            for item in self.items:
                coords = self.canvas.coords(item)
                if coords[0] < 30 and item not in marked:
                    # Passed light or entered station
                    t = kind_of_object[item]
                    if t == "STATION":
                        marked[item] = False
                        self.controller.addInput(Event("enter", "tkinter_input", []))
                    elif t == "RED":
                        marked[item] = True
                        self.controller.addInput(Event("red_light", "tkinter_input", []))
                    elif t == "YELLOW":
                        marked[item] = True
                        self.controller.addInput(Event("yellow_light", "tkinter_input", []))
                    elif t == "GREEN":
                        marked[item] = True
                        self.controller.addInput(Event("green_light", "tkinter_input", []))
                elif coords[0] < -170 and not marked[item]:
                    self.controller.addInput(Event("leave", "tkinter_input", []))
                    marked[item] = True
        self.after(20, self.throwEvents)
        
    def notify(self, msg, color):
        self.label_error.config(text=msg, bg=color)
        
    def updateState(self):
        def turn_green(item):
            kind_of_object[item] = "GREEN"
            self.canvas.itemconfigure(item, image=self.img_green)
            
        def turn_yellow(item):
            self.canvas.itemconfigure(item, image=self.img_yellow)
            kind_of_object[item] = "YELLOW"
            self.light_change_events.append((self.counter + random.random() * 500 + 300, item, turn_green))
        
        if self.train is not None:
            self.train.velocity += self.train.acceleration / 2
            self.label_speed.config(text="Speed: %.2f" % self.train.velocity)
            self.travelled_x += float(self.train.velocity) / 20
            delta_x = -int(self.travelled_x - self.travelled_x_int)
            self.travelled_x_int = int(self.travelled_x)
            # Move rails
            for item in self.rails:
                self.canvas.move(item, delta_x, 0)

            # Move items and remove if necessary
            for item in self.items:
                self.canvas.move(item, delta_x, 0)
                if self.canvas.coords(item) < -100:
                    self.canvas.delete(item)
                    self.items.remove(item)

            # Update rails
            while 1:
                coords = self.canvas.coords(self.rails[0])
                if coords[0] < -width_railway:
                    self.canvas.delete(self.rails[0])
                    self.rails.pop(0)
                    self.rails.append(self.canvas.create_image(self.canvas.coords(self.rails[-1])[0]+width_railway, 80, image=self.img_railway, anchor=NW))
                    self.canvas.tag_lower(self.rails[-1])
                else:
                    break

            # Add in an element only if there is space
            if self.next_station < self.travelled_x:
                # Generate a station
                self.items.append(self.canvas.create_image(1000, 120, image=self.img_station, anchor=NW))
                kind_of_object[self.items[-1]] = "STATION"
                self.next_station += random.random() * 3000 + 2000

            if self.next_light < self.travelled_x:
                self.next_light += 500
                self.items.append(self.canvas.create_image(1000, 40, image=self.img_red, anchor=NW))
                kind_of_object[self.items[-1]] = "RED"
                self.light_change_events.append((self.counter + random.random() * 500, self.items[-1], turn_yellow))

            self.counter += 1
            for light_change in self.light_change_events:
                if light_change[0] <= self.counter:
                    light_change[2](light_change[1])
                    self.light_change_events.remove(light_change)
            
root = SimulationGUI()
if __name__ == "__main__":
    random.seed(1)
    controller = train.Controller(root, TkEventLoop(root))
    root.controller = controller
    controller.start()
    try:
        root.mainloop()
    finally:
        controller.stop()
