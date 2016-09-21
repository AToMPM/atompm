"""
 *REALLY* Small framework for creating/manipulating/deleting Tkinter Canvas elements.
 
 NOTE: keep this synced with svg.js
 
 Author: Raphael Mannadiar
 Date: 2014/08/21
"""

from utils import utils


class drawing:
    class canvas_wrapper:
        def __init__(self, element):
            self.element = element
            self.width = int(element.cget("width"))
            self.height = int(element.cget("height"))

        def add_circle(self, x, y, r, style):
            new_element_id = self.element.create_oval(x-r, y-r, x+r, y+r, **style)
            return drawing.ui_element_wrapper(self, new_element_id, x, y)

        def add_rectangle(self, x, y, w, h, style):
            new_element_id = self.element.create_rectangle(x-w/2.0, y-h/2.0, x+w/2.0, y+h/2.0, **style)
            return drawing.ui_element_wrapper(self, new_element_id, x, y)

        def remove_element(self, element):
            self.element.delete(element.element_id)


    class ui_element_wrapper:
        def __init__(self, canvas_wrapper, element_id, x, y):
            self.canvas_wrapper = canvas_wrapper
            self.element_id = element_id
            self.a = 0
            self.x = x
            self.y = y

        def set_position(self, x, y):
            self.move(x-self.x, y-self.y)

        def get_position(self):
            return utils._bunch(x=self.x, y=self.y)

        def move(self, dx, dy):
            self.x += dx
            self.y += dy
            self.canvas_wrapper.element.move(self.element_id, dx, dy)

        def set_rotation(self, a):
            raise Exception("Not implemented yet")

        def rotate(self, a):
            raise Exception("Not implemented yet")

        def set_color(self, color):
            self.canvas_wrapper.element.itemconfig(self.element_id, fill=color)

