import abc
import re
from accurate_time import time
import threading
import traceback
import math
from nextafter import nextafter
from infinity import INFINITY
from event_queue import EventQueue
from Queue import Queue, Empty

class RuntimeException(Exception):
	def __init__(self, message):
		self.message = message
	def __str__(self):
		return repr(self.message)

class AssociationException(RuntimeException):
	pass

class AssociationReferenceException(RuntimeException):
	pass

class ParameterException(RuntimeException):
	pass

class InputException(RuntimeException):
	pass

class Association(object):
	#wrapper object for one association relation
	def __init__(self, to_class, min_card, max_card):
		self.to_class = to_class
		self.min_card = min_card
		self.max_card = max_card
		self.instances = {}  # maps index (as string) to instance
		self.instances_to_ids = {}
		self.size = 0
		self.next_id = 0
		

	def allowedToAdd(self):
		return self.max_card == -1 or self.size < self.max_card
		
	def allowedToRemove(self):
		return self.min_card == -1 or self.size > self.min_card
		
	def addInstance(self, instance):
		if self.allowedToAdd() :
			new_id = self.next_id
			self.next_id += 1
			self.instances[new_id] = instance
			self.instances_to_ids[instance] = new_id
			self.size += 1
			return new_id
		else :
			raise AssociationException("Not allowed to add the instance to the association.")
		
	def removeInstance(self, instance):
		if self.allowedToRemove() :
			del self.instances[self.instances_to_ids[instance]]
			del self.instances_to_ids[instance]
			self.size -= 1
		else :
			raise AssociationException("Not allowed to remove the instance from the association.")
		
	def getInstance(self, index):
		try :
			return self.instances[index]
		except IndexError :
			raise AssociationException("Invalid index for fetching instance(s) from association.")

"""class InstanceWrapper(object):
	#wrapper object for an instance and its relevant information needed in the object manager
	def __init__(self, instance, associations):
		self.instance = instance
		self.associations = {}
		for association in associations :
			self.associations[association.getName()] = association  
		
	def getAssociation(self, name):
		try :
			return self.associations[name]
		except KeyError :
			raise AssociationReferenceException("Unknown association %s." % name)
	
	def getInstance(self):
		return self.instance"""

class ObjectManagerBase(object):
	__metaclass__  = abc.ABCMeta
	
	def __init__(self, controller):
		self.controller = controller
		self.events = EventQueue()
		self.instances = [] #a dictionary that maps RuntimeClassBase to InstanceWrapper
		
	def addEvent(self, event, time_offset = 0.0):
		self.events.add(event, time_offset)
		
	# Broadcast an event to all instances
	def broadcast(self, new_event):
		for i in self.instances:
			i.addEvent(new_event)
		
	def getWaitTime(self):  
		#first get waiting time of the object manager's events
		smallest_time = self.events.getEarliestTime()
		#check all the instances
		for instance in self.instances:
			smallest_time = min(smallest_time, instance.getEarliestEventTime())
		return smallest_time
	
	def stepAll(self, delta):
		self.step(delta)
		for i in self.instances:
			i.step(delta)

	def step(self, delta):
		self.events.decreaseTime(delta)
		for event in self.events.popDueEvents() :
			self.handleEvent(event)
			   
	def start(self):
		for i in self.instances:
			i.start()		   
			   
	def handleEvent(self, e):   
		if e.getName() == "narrow_cast" :
			self.handleNarrowCastEvent(e.getParameters())
			
		elif e.getName() == "broad_cast" :
			self.handleBroadCastEvent(e.getParameters())
			
		elif e.getName() == "create_instance" :
			self.handleCreateEvent(e.getParameters())
			
		elif e.getName() == "associate_instance" :
			self.handleAssociateEvent(e.getParameters())
			
		elif e.getName() == "start_instance" :
			self.handleStartInstanceEvent(e.getParameters())
			
		elif e.getName() == "delete_instance" :
			self.handleDeleteInstanceEvent(e.getParameters())
			
	def processAssociationReference(self, input_string):
		if len(input_string) == 0 :
			raise AssociationReferenceException("Empty association reference.")
		regex_pattern = re.compile("^([a-zA-Z_]\w*)(?:\[(\d+)\])?$")
		path_string =  input_string.split("/")
		result = []
		for piece in path_string :
			match = regex_pattern.match(piece)
			if match :
				name = match.group(1)
				index = match.group(2)
				if index is None :
					index = -1
				result.append((name,int(index)))
			else :
				raise AssociationReferenceException("Invalid entry in association reference. Input string: " + input_string)
		return result
	
	def handleStartInstanceEvent(self, parameters):
		if len(parameters) != 2 :
			raise ParameterException ("The start instance event needs 2 parameters.")  
		else :
			source = parameters[0]
			traversal_list = self.processAssociationReference(parameters[1])
			for i in self.getInstances(source, traversal_list) :
				i["instance"].start()
			source.addEvent(Event("instance_started", parameters = [parameters[1]]))
		
	def handleBroadCastEvent(self, parameters):
		if len(parameters) != 1 :
			raise ParameterException ("The broadcast event needs 1 parameter.")
		self.broadcast(parameters[0])

	def handleCreateEvent(self, parameters):
		if len(parameters) < 2 :
			raise ParameterException ("The create event needs at least 2 parameters.")

		source = parameters[0]
		association_name = parameters[1]
		
		association = source.associations[association_name]
		#association = self.instances_map[source].getAssociation(association_name)
		if association.allowedToAdd() :
			''' allow subclasses to be instantiated '''
			class_name = association.to_class if len(parameters) == 2 else parameters[2]
			new_instance = self.createInstance(class_name, parameters[3:])
			if not new_instance:
				raise ParameterException("Creating instance: no such class: " + class_name)
			#index = association.addInstance(new_instance)
			try:
				index = association.addInstance(new_instance)
			except AssociationException as exception:
				raise RuntimeException("Error adding instance to association '" + association_name + "': " + str(exception))
			p = new_instance.associations.get("parent")
			if p:
				p.addInstance(source)
			source.addEvent(Event("instance_created", None, [association_name+"["+str(index)+"]"]))
		else :
			source.addEvent(Event("instance_creation_error", None, [association_name]))

	def handleDeleteInstanceEvent(self, parameters):
		if len(parameters) < 2 :
			raise ParameterException ("The delete event needs at least 2 parameters.")
		else :
			source = parameters[0]
			association_name = parameters[1]
			traversal_list = self.processAssociationReference(association_name)
			instances = self.getInstances(source, traversal_list)
			#association = self.instances_map[source].getAssociation(traversal_list[0][0])
			association = source.associations[traversal_list[0][0]]
			for i in instances:
				try:
					association.removeInstance(i["instance"])
				except AssociationException as exception:
					raise RuntimeException("Error removing instance from association '" + association_name + "': " + str(exception))
				i["instance"].stop()
				#if hasattr(i.instance, 'user_defined_destructor'):
				i["instance"].user_defined_destructor()
			source.addEvent(Event("instance_deleted", parameters = [parameters[1]]))
				
	def handleAssociateEvent(self, parameters):
		if len(parameters) != 3 :
			raise ParameterException ("The associate_instance event needs 3 parameters.")
		else :
			source = parameters[0]
			to_copy_list = self.getInstances(source,self.processAssociationReference(parameters[1]))
			if len(to_copy_list) != 1 :
				raise AssociationReferenceException ("Invalid source association reference.")
			wrapped_to_copy_instance = to_copy_list[0]["instance"]
			dest_list = self.processAssociationReference(parameters[2])
			if len(dest_list) == 0 :
				raise AssociationReferenceException ("Invalid destination association reference.")
			last = dest_list.pop()
			if last[1] != -1 :
				raise AssociationReferenceException ("Last association name in association reference should not be accompanied by an index.")
				
			for i in self.getInstances(source, dest_list) :
				i["instance"].associations[last[0]].addInstance(wrapped_to_copy_instance)
		
	def handleNarrowCastEvent(self, parameters):
		if len(parameters) != 3 :
			raise ParameterException ("The associate_instance event needs 3 parameters.")
		source = parameters[0]
		traversal_list = self.processAssociationReference(parameters[1])
		cast_event = parameters[2]
		for i in self.getInstances(source, traversal_list) :
			i["instance"].addEvent(cast_event)
		
	def getInstances(self, source, traversal_list):
		currents = [{
			"instance" : source,
			"ref" : None,
			"assoc_name" : None,
			"assoc_index" : None
		}]
		#currents = [source]
		for (name, index) in traversal_list :
			nexts = []
			for current in currents :
				association = current["instance"].associations[name]
				if (index >= 0 ) :
					nexts.append({
						"instance" : association.instances[index],
						"ref" : current["instance"],
						"assoc_name" : name,
						"assoc_index" : index
					})
				elif (index == -1) :
					for i in association.instances:
						nexts.append({
							"instance" : association.instances[i],
							"ref" : current["instance"],
							"assoc_name" : name,
							"assoc_index" : index
						})
					#nexts.extend( association.instances.values() )
				else :
					raise AssociationReferenceException("Incorrect index in association reference.")
			currents = nexts
		return currents
			
	@abc.abstractmethod
	def instantiate(self, class_name, construct_params):
		pass
		
	def createInstance(self, to_class, construct_params = []):
		instance = self.instantiate(to_class, construct_params)
		self.instances.append(instance)
		return instance
	
class Event(object):
	def __init__(self, event_name, port = "", parameters = []):
		self.name = event_name
		self.parameters = parameters
		self.port = port

	def getName(self):
		return self.name

	def getPort(self):
		return self.port

	def getParameters(self):
		return self.parameters
	
	def __repr__(self):
		representation = "(event name : " + str(self.name) + "; port : " + str(self.port)
		if self.parameters :
			representation += "; parameters : " + str(self.parameters)
		representation += ")"
		return representation
	
class OutputListener(object):
	def __init__(self, port_names):
		self.port_names = port_names
		self.queue = Queue()

	def add(self, event):
		if len(self.port_names) == 0 or event.getPort() in self.port_names :
			self.queue.put_nowait(event)
			
	""" Tries for timeout seconds to fetch an event, returns None if failed.
		0 as timeout means no waiting (blocking), returns None if queue is empty.
		-1 as timeout means blocking until an event can be fetched. """
	def fetch(self, timeout = 0):
		if timeout < 0:
			timeout = INFINITY
		while timeout >= 0:
			try:
				# wait in chunks of 100ms because we
				# can't receive (keyboard)interrupts while waiting
				return self.queue.get(True, 0.1 if timeout > 0.1 else timeout)
			except Empty:
				timeout -= 0.1
		return None

class InputPortEntry(object):
	def __init__(self, virtual_name, instance):
		self.virtual_name = virtual_name
		self.instance = instance
		
class ControllerBase(object):

	def __init__(self, object_manager):
		self.object_manager = object_manager

		self.private_port_counter = 0

		# Keep track of input ports
		self.input_ports = {}
		self.input_queue = EventQueue()

		# Keep track of output ports
		self.output_ports = []
		self.output_listeners = []

		# Let statechart run one last time before stopping
		self.done = False
			
	def addInputPort(self, virtual_name, instance = None):
		if instance == None :
			port_name = virtual_name
		else:
			port_name = "private_" + str(self.private_port_counter) + "_" + virtual_name
			self.private_port_counter += 1
		self.input_ports[port_name] = InputPortEntry(virtual_name, instance)
		return port_name
		
	def addOutputPort(self, port_name):
		self.output_ports.append(port_name)

	def broadcast(self, new_event):
		self.object_manager.broadcast(new_event)
		
	def start(self):
		self.object_manager.start()
	
	def stop(self):
		pass

	def addInput(self, input_event_list, time_offset = 0.0):
		if not isinstance(input_event_list, list):
			input_event_list = [input_event_list]

		for e in input_event_list:
			if e.getName() == ""  :
				raise InputException("Input event can't have an empty name.")
		
			if e.getPort() not in self.input_ports :
				raise InputException("Input port mismatch, no such port: " + e.getPort() + ".")		

		self.input_queue.add(input_event_list, time_offset)

	def getWaitTime(self):
		return min(self.object_manager.getWaitTime(), self.input_queue.getEarliestTime())

	def handleInput(self, delta):
		self.input_queue.decreaseTime(delta)
		for events in self.input_queue.popDueEvents():
			for e in events:
				input_port = self.input_ports[e.getPort()]
				e.port = input_port.virtual_name
				target_instance = input_port.instance
				if target_instance == None:
					self.broadcast(e)
				else:
					target_instance.addEvent(e)

	def outputEvent(self, event):
		for listener in self.output_listeners :
			listener.add(event)

	def addOutputListener(self, ports):
		listener = OutputListener(ports)
		self.output_listeners.append(listener)
		return listener

	def addMyOwnOutputListener(self, listener):
		self.output_listeners.append(listener)

	# deprecated, to add multiple events, use addInput instead
	def addEventList(self, event_list):
		for (event, time_offset) in event_list :
			self.addInput(event, time_offset)
			
	def getObjectManager(self):
		return self.object_manager
		
class GameLoopControllerBase(ControllerBase):
	def __init__(self, object_manager):
		ControllerBase.__init__(self, object_manager)
		
	def update(self, delta):
		self.handleInput(delta)
		self.object_manager.stepAll(delta)

class EventLoop:
	# parameters:
	#  schedule - a callback scheduling another callback in the event loop
	#      this callback should take 2 parameters: (callback, timeout) and return an ID
	#  clear - a callback that clears a scheduled callback
	#      this callback should take an ID that was returned by 'schedule'
	def __init__(self, schedule, clear):
		self.schedule_callback = schedule
		self.clear_callback = clear
		self.scheduled_id = None
		self.last_time = None
		self.next_wakeup = None
		self.last_print = 0.0

	def getScheduledTimeout(self):
		if self.last_time and self.next_wakeup:
			return self.next_wakeup - self.last_time
		else:
			return INFINITY

	# schedule relative to last_time
	#
	# argument 'wait_time' is the amount of virtual (simulated) time to wait
	#
	# NOTE: if the next wakeup (in simulated time) is in the past, the timeout is '0',
	# but because scheduling '0' timeouts hurts performance, we don't schedule anything
	# and return False instead
	def schedule(self, f, wait_time):
		if self.scheduled_id:
			# if the following error occurs, it is probably due to a flaw in the logic of EventLoopControllerBase
			raise RuntimeException("EventLoop class intended to maintain at most 1 scheduled callback.")

		if wait_time == INFINITY:
			self.last_time = None
			self.next_wakeup = None
			is_scheduled = True
		else:
			now = time()
			if not self.last_time:
				self.last_time = now
			self.next_wakeup = self.last_time + wait_time
			# self.last_time is a very large value, and wait_time can be very small, so 
			if self.next_wakeup - self.last_time < wait_time:
				# due to floating point imprecision, it is possible for a nonzero wait-time to advance simulated time not enough to pop the next event, potentially even causing the model to hang, so we always take the ceil of the exact result of the addition self.last_time + wait_time.
				self.next_wakeup = nextafter(self.next_wakeup, INFINITY)
			remaining = max(self.next_wakeup - now, 0.0)
			is_scheduled, self.scheduled_id = self.schedule_callback(f, remaining)
		return is_scheduled

	def clear(self):
		if self.scheduled_id:
			self.clear_callback(self.scheduled_id)
			self.scheduled_id = None

	def nextDelta(self):
		now = time()
		if self.next_wakeup:
			simulated_now = self.next_wakeup
		else:
			simulated_now = now
		if now - self.last_print > 1.0:
			behind_schedule = now - simulated_now
			if behind_schedule > 0.1:
				print "Warning: running %.f ms behind schedule" % (behind_schedule*1000.0)
				self.last_print = now
		if self.last_time:
			delta = simulated_now - self.last_time
		else:
			delta = 0.0
		self.last_time = simulated_now
		self.next_wakeup = None
		return delta

	# returns elapsed time since delta
	def elapsed(self):
		if self.last_time:
			return time() - self.last_time
		else:
			return 0.0

class EventLoopControllerBase(ControllerBase):
	def __init__(self, object_manager, event_loop, finished_callback = None):
		ControllerBase.__init__(self, object_manager)
		self.event_loop = event_loop
		self.finished_callback = finished_callback

	def addInput(self, input_event, time_offset = 0.0):
		elapsed = self.event_loop.elapsed()
		controller_timeout = time_offset + elapsed
		ControllerBase.addInput(self, input_event, controller_timeout)
		if controller_timeout < self.event_loop.getScheduledTimeout():
			# added event's timeout is sooner than existing timeout -> re-schedule
			self.event_loop.clear()
			if not self.event_loop.schedule(self.run, controller_timeout):
				self.run()

	def start(self):
		ControllerBase.start(self)
		self.run()

	def stop(self):
		self.event_loop.clear()
		ControllerBase.stop(self)

	def run(self):
		while True:
			# clear existing timeout
			self.event_loop.clear()
			# calculate last time since simulation
			delta = self.event_loop.nextDelta()
			# simulate
			self.handleInput(delta)
			self.object_manager.stepAll(delta)
			# schedule next timeout
			wait_time = self.getWaitTime()
			scheduled = self.event_loop.schedule(self.run, wait_time)
			if wait_time == INFINITY:
				if self.finished_callback:
					self.finished_callback()
			if scheduled:
				break
		
class ThreadsControllerBase(ControllerBase):
	def __init__(self, object_manager, keep_running):
		ControllerBase.__init__(self, object_manager)
		self.keep_running = keep_running
		self.input_condition = threading.Condition()
		self.stop_thread = False
		self.thread = threading.Thread(target=self.run)
		
	def handleInput(self, delta):
		self.input_condition.acquire()
		ControllerBase.handleInput(self, delta)
		self.input_condition.release()
		
	def start(self):
		self.thread.start()
		
	def stop(self):
		self.input_condition.acquire()
		self.stop_thread = True
		self.input_condition.notifyAll()
		self.input_condition.release()

	def getWaitTime(self):
		"""Compute time untill earliest next event"""
		self.input_condition.acquire()
		wait_time = ControllerBase.getWaitTime(self)
		self.input_condition.release()

		if wait_time == INFINITY :
			if self.done :
				self.done = False
			else :
				self.done = True
				return 0.0
		return wait_time

	def handleWaiting(self):
		self.input_condition.acquire()
		wait_time = self.getWaitTime()
		if(wait_time <= 0.0):
			return
		
		if wait_time == INFINITY :
			if self.keep_running :
				self.input_condition.wait() #Wait for a signals
			else :
				self.stop_thread = True
		
		elif wait_time != 0.0 :
			reduced_wait_time = wait_time - (time() - self.last_recorded_time)
			if reduced_wait_time > 0.0 :
				self.input_condition.wait(reduced_wait_time)	
		self.input_condition.release()

	def run(self):
		self.last_recorded_time  = time()
		super(ThreadsControllerBase, self).start()
		last_iteration_time = 0.0
		
		while True:
			self.input_condition.acquire()
			self.handleInput(last_iteration_time)
			self.input_condition.release()
			#Compute the new state based on internal events
			self.object_manager.stepAll(last_iteration_time)
			
			self.handleWaiting()
			
			self.input_condition.acquire()
			if self.stop_thread : 
				break
			self.input_condition.release()
			
			previous_recorded_time = self.last_recorded_time
			self.last_recorded_time = time()
			last_iteration_time = self.last_recorded_time - previous_recorded_time
		
	def join(self):
		self.thread.join()

	def addInput(self, input_event, time_offset = 0.0):
		self.input_condition.acquire()
		super(ThreadsControllerBase, self).addInput(input_event, time_offset)
		self.input_condition.notifyAll()
		self.input_condition.release()

	def addEventList(self, event_list):
		self.input_condition.acquire()
		super(ThreadsControllerBase, self).addEventList(event_list)
		self.input_condition.release()

class StatechartSemantics:
	# Big Step Maximality
	TakeOne = 0
	TakeMany = 1
	# Concurrency - not implemented yet
	Single = 0
	Many = 1
	# Preemption - not implemented yet
	NonPreemptive = 0
	Preemptive = 1
	# Internal Event Lifeline
	Queue = 0
	NextSmallStep = 1
	NextComboStep = 2
	# Input Event Lifeline
	Whole = 0
	FirstSmallStep = 1
	FirstComboStep = 2
	# Priority
	SourceParent = 0
	SourceChild = 1
	# TODO: add Memory Protocol options
	
	def __init__(self):
		# default semantics:
		self.big_step_maximality = self.TakeMany
		self.concurrency = self.Single
		self.internal_event_lifeline = self.Queue
		self.input_event_lifeline = self.FirstComboStep
		self.priority = self.SourceParent

class RuntimeClassBase(object):
	__metaclass__  = abc.ABCMeta
	
	def __init__(self, controller):
		self.active = False
		self.is_stable = True
		self.events = EventQueue()

		self.controller = controller

		self.timers = None
		self.inports = {}

		self.semantics = StatechartSemantics()

	def start(self):
		self.current_state = {}
		self.history_state = {}
		self.timers = {}

		self.big_step = BigStepState()
		self.combo_step = ComboStepState()
		self.small_step = SmallStepState()

		self.active = True
		self.is_stable = False

		self.initializeStatechart()
		self.processBigStepOutput()
	
	def stop(self):
		self.active = False
		
	def addEvent(self, event_list, time_offset = 0.0):
		if not isinstance(event_list, list):
			event_list = [event_list]
		self.events.add(event_list, time_offset)
		
	def getEarliestEventTime(self) :
		if not self.active:
			return INFINITY
		if not self.is_stable:
			return 0.0
		if self.timers:
			return min(self.events.getEarliestTime(), min(self.timers.itervalues()))
		return self.events.getEarliestTime()

	def processBigStepOutput(self):
		for e in self.big_step.getOutputEvents():
			self.controller.outputEvent(e)
		for e in self.big_step.getOutputEventsOM():
			self.controller.object_manager.addEvent(e)

	def step(self, delta):
		if not self.active :
			return
		
		# decrease event queue time
		self.events.decreaseTime(delta)

		# decrease timers time
		next_timers = {}
		for (key,value) in self.timers.iteritems() :
			time = value - delta
			if time <= 0.0 :
				self.addEvent( Event("_" + str(key) + "after"), time)
			else :
				next_timers[key] = time
		self.timers = next_timers

		# execute big step(s)
		due = self.events.popDueEvents()
		if not due and not self.is_stable:
			due = [[]]
		for input_events in due:
			# perform 1 big step per slot in 'due'
			self.is_stable = not self.bigStep(input_events)
			self.processBigStepOutput()

	def inState(self, nodes):
		for c in self.current_state.itervalues():
			new_nodes = []
			for n in nodes:
				if not (n in c):
					new_nodes.append(n)
			nodes = new_nodes
			if len(nodes) == 0:
				return True
		return False

	def bigStep(self, input_events):
		#print "new big step"
		self.big_step.next(input_events)
		self.small_step.reset()
		self.combo_step.reset()
		while self.comboStep():
			self.big_step.setStepped()
			if self.semantics.big_step_maximality == StatechartSemantics.TakeOne:
				break # Take One -> only one combo step allowed
		return self.big_step.hasStepped()

	def comboStep(self):
		#print "new combo step"
		self.combo_step.next()
		while self.smallStep():
			self.combo_step.setStepped()
		return self.combo_step.hasStepped()

	def smallStep(self):
		if self.small_step.hasStepped():
			self.small_step.next()
		self.generateCandidates()
		if self.small_step.hasCandidates():
			#print "new small step, have " + str(len(self.small_step.getCandidates())) + " candidates"
			if self.semantics.concurrency == StatechartSemantics.Single:
				transition, parameters = self.small_step.getCandidates()[0] # execute first of candidates
				transition(parameters)
			elif self.semantics.concurrency == StatechartSemantics.Many:
				pass # TODO: implement
			self.small_step.setStepped()
		return self.small_step.hasStepped()

	def getEnabledEvents(self):
		result = self.small_step.getCurrentEvents() + self.combo_step.getCurrentEvents()
		if self.semantics.input_event_lifeline == StatechartSemantics.Whole or (
			not self.big_step.hasStepped() and
				(self.semantics.input_event_lifeline == StatechartSemantics.FirstComboStep or (
				not self.combo_step.hasStepped() and
					self.semantics.input_event_lifeline == StatechartSemantics.FirstSmallStep))):
			result += self.big_step.getInputEvents()
		return result

	def raiseInternalEvent(self, event):
		if self.semantics.internal_event_lifeline == StatechartSemantics.NextSmallStep:
			self.small_step.addNextEvent(event)
		elif self.semantics.internal_event_lifeline == StatechartSemantics.NextComboStep:
			self.combo_step.addNextEvent(event)
		elif self.semantics.internal_event_lifeline == StatechartSemantics.Queue:
			self.events.add([event], 0.0)

	@abc.abstractmethod
	def initializeStatechart(self):
		pass

	@abc.abstractmethod
	def generateCandidates(self):
		pass


class BigStepState(object):
	def __init__(self):
		self.input_events = [] # input events received from environment before beginning of big step (e.g. from object manager, from input port)
		self.output_events_port = [] # output events to be sent to output port after big step ends.
		self.output_events_om = [] # output events to be sent to object manager after big step ends.
		self.has_stepped = True

	def next(self, input_events):
		self.input_events = input_events
		self.output_events_port = []
		self.output_events_om = []
		self.has_stepped = False

	def getInputEvents(self):
		return self.input_events

	def getOutputEvents(self):
		return self.output_events_port

	def getOutputEventsOM(self):
		return self.output_events_om

	def outputEvent(self, event):
		self.output_events_port.append(event)

	def outputEventOM(self, event):
		self.output_events_om.append(event)

	def setStepped(self):
		self.has_stepped = True

	def hasStepped(self):
		return self.has_stepped


class ComboStepState(object):
	def __init__(self):
		self.current_events = [] # set of enabled events during combo step
		self.next_events = [] # internal events that were raised during combo step
		self.changed = [] # set of all or-states that were the arena of a triggered transition during big step.
		self.has_stepped = True

	def reset(self):
		self.current_events = []
		self.next_events = []

	def next(self):
		self.current_events = self.next_events
		self.next_events = []
		self.changed = []
		self.has_stepped = False

	def addNextEvent(self, event):
		self.next_events.append(event)

	def getCurrentEvents(self):
		return self.current_events

	def setArenaChanged(self, arena):
		self.changed.append(arena)

	def isArenaChanged(self, arena):
		return (arena in self.changed)

	def isStable(self):
		return (len(self.changed) == 0)

	def setStepped(self):
		self.has_stepped = True

	def hasStepped(self):
		return self.has_stepped


class SmallStepState(object):
	def __init__(self):
		self.current_events = [] # set of enabled events during small step
		self.next_events = [] # events to become 'current' in the next small step
		self.candidates = [] # document-ordered(!) list of transitions that can potentially be executed concurrently, or preempt each other, depending on concurrency semantics. If no concurrency is used and there are multiple candidates, the first one is chosen. Source states of candidates are *always* orthogonal to each other.
		self.has_stepped = True

	def reset(self):
		self.current_events = []
		self.next_events = []

	def next(self):
		self.current_events = self.next_events # raised events from previous small step
		self.next_events = []
		self.candidates = []
		self.has_stepped = False

	def addNextEvent(self, event):
		self.next_events.append(event)

	def getCurrentEvents(self):
		return self.current_events

	def addCandidate(self, t, p):
		self.candidates.append((t, p))

	def getCandidates(self):
		return self.candidates

	def hasCandidates(self):
		return len(self.candidates) > 0

	def setStepped(self):
		self.has_stepped = True

	def hasStepped(self):
		return self.has_stepped

