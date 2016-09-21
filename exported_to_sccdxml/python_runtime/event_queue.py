from infinity import INFINITY

class EventQueue(object):
    class EventQueueEntry(object):        
        def __init__(self, event_list, time_offset) :
            self.event_list = event_list
            self.time_offset = time_offset
        
        def decreaseTime(self, offset) :
            self.time_offset -= offset;   
        
        def getEvents(self) :
            return self.event_list
        
        def getTime (self) :
            return self.time_offset

    def __init__(self):
        self.event_list = []

    def add(self, event_list, time_offset) :
        entry = EventQueue.EventQueueEntry(event_list, time_offset);
        #We maintain a sorted stable list
        insert_index = 0;
        index = len(self.event_list)-1
        while (index >= 0) :
            if (self.event_list[index].getTime() <= time_offset) :
                insert_index = index + 1;
                break;
            index -= 1
        self.event_list.insert(insert_index, entry)
    
    def decreaseTime(self, offset) :
        for event in self.event_list :
            event.decreaseTime(offset)
    
    def isEmpty(self) :
        return len(self.event_list) == 0
    
    def getEarliestTime(self) :
        """Returns the earliest time. INFINITY if no events are present."""
        if self.isEmpty() :
            return INFINITY
        else :
            return self.event_list[0].getTime()
    
    def popDueEvents(self) :
        result = []
        if (self.isEmpty() or self.event_list[0].getTime() > 0.0) :
            #There are no events, or the earliest event isn't due, so we can already return an emtpy result
            return result

        index = 0;
        while (index < len(self.event_list) and self.event_list[index].getTime() <= 0.0) :
            result.append(self.event_list[index].getEvents()) #Add all events that are due (offset less than 0) to the result
            index += 1
        self.event_list = self.event_list[len(result):]
        return result;
