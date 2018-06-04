/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

__dialogBehaviourStatechart = {
	'__STATE_OPEN'	 : 0,
	'__STATE_CLOSED': 1,
	'__currentState': undefined,

	'__entryActions':{
		0:
			function(event)	
			{
				WindowManagement.showDialog();
			},
		1:
			function(event)	
			{
				WindowManagement.closeDialog(event);
			}
        },

	'__exitActions':{},
	
	/* transition to specified  state */
	'__T' : 
		function(s,event)
		{
			if( this.__currentState in this.__exitActions )
				this.__exitActions[this.__currentState](event);
		
			this.__currentState = s;
		
			if( s in this.__entryActions )
				this.__entryActions[s](event);
		},

	/* initialise the statechart */
	'init':
		function()
		{
			this.__currentState = this.__STATE_CLOSED;
		},

	/* handle an event... only discarded events are allowed to propagate to parent
	  	HTML element
			name: 	internal name of the event
			event:	the javascript event */
	'handleUserEvent':
		function(name,event)
		{
			if( this.__currentState == this.__STATE_OPEN )
			{
				if( name == __EVENT_KEYUP_ESC ||
					 name == __EVENT_CANCELED_DIALOG ||
					 name == __EVENT_KEYUP_ENTER ||
					 name == __EVENT_OKAYED_DIALOG )
                    // let's not look at this ever again
                    if (__dialog_stack.length == 1)
                        this.__T(this.__STATE_CLOSED,event);
                    else
                        WindowManagement.closeDialog();
                    
				else if( name == __EVENT_SHOW_DIALOG )
					this.__T(this.__STATE_OPEN,event);
		
				else
					return;
		
				if( event && event.stopPropagation )
				{
					event.stopPropagation();
					event.preventDefault();
				}
			}

			
			else if( this.__currentState == this.__STATE_CLOSED )
			{
				if( name == __EVENT_SHOW_DIALOG )
					this.__T(this.__STATE_OPEN,event);
		
				else
					return;
		
				if( event && event.stopPropagation )
				{
					event.stopPropagation();
					event.preventDefault();
				}
			}
		}	
};
