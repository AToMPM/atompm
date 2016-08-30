/*******************************************************************************
AToMPM - A Tool for Multi-Paradigm Modelling

Copyright (c) 2011 Raphael Mannadiar (raphael.mannadiar@mail.mcgill.ca)

This file is part of AToMPM.

AToMPM is free software: you can redistribute it and/or modify it under the
terms of the GNU Lesser General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later 
version.

AToMPM is distributed in the hope that it will be useful, but WITHOUT ANY 
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.  See the GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License along
with AToMPM.  If not, see <http://www.gnu.org/licenses/>.
*******************************************************************************/

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
				WindowManagement.closeDialog(event); // HUSEYIN-ENTER
				//WindowManagement.closeDialog();
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
					 name == __EVENT_KEYUP_ENTER || // HUSEYIN-ENTER
					 name == __EVENT_OKAYED_DIALOG )
					this.__T(this.__STATE_CLOSED,event);
		
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
}
