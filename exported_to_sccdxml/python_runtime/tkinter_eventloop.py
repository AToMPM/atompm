from statecharts_core import EventLoop
import math

class TkEventLoop(EventLoop):
	def __init__(self, tk):
	
		tk.sccd_force_update = False

		# bind scheduler callback
		def schedule(callback, timeout):
			if timeout == 0:
			# tk considers updating the window an 'idle' task, only to be done if no events are scheduled for a while. But this has the downside of the interface becoming completely unresponsive while the model is performing steps with no gaps in between. Thus we insert an 'update_idletasks()' to obtain "javascript event loop"-like behavior.
				if tk.sccd_force_update:
					tk.update_idletasks()
					tk.sccd_force_update = False
				else:
					return (False, None) # don't schedule 0-timeout, it's more performant to just keep running
			return (True, tk.after(int(math.ceil(timeout*1000.0)), callback))

		EventLoop.__init__(self, schedule, tk.after_cancel)

