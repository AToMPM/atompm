/*******************************************************************************
AToMPM - A Tool for Multi-Paradigm Modelling

Copyright (c) 2012 Conner Hansen (chansen@crimson.ua.edu)

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

/**
 * This object defines my DummyStateChart formalism. It has
 * State and Transition methods.
 */
var DummyStateChart = function(){
	var states = new Array();
	var transitions = new Array();
	var currentState = null;
	
	this.State = function(name){
		var out = new Array();
		
		this.addTransition = function( transition ){
			out.push( transition );
		};
		
		this.fire = function( trigger ){
			for(var i=0; i<out.length; i++){
				if( out[i].isTrigger( trigger ) ){
					return out[i];
				}
			}
			
			return false;
		};
		
		this.onEntry = function(){
			//console.debug("OnEntry: " + name);
		};
		
		this.onExit = function(){
			//console.debug("OnExit: " + name);
		};
		
		return this;
	};
	
	this.Transition = function(trigger, from, to){
		this.fire = function(){
			return to;
		};
		
		this.getTrigger = function(){
			return trigger;
		};
		
		this.isTrigger = function( input ){
			return input == trigger;
		};
		
		from.addTransition( this );
		
		return this;
	};
	
	this.addState = function( state ){
		states.push( state );
	};
	
	this.addTransition = function( transition ){
		transitions.push( transition );
	};
	
	this.fireEvent = function( event ){
		var transition = currentState.fire( event );
		
		if( transition ){
			// Fire the on exit event
			currentState.onExit();
			
			// Move to the new state and
			// fire the entry event
			currentState = transition.fire( event );
			currentState.onEntry();
		}
	};
	
	this.getCurrentState = function(){
		return currentState;
	};
	
	this.setInitialState = function( index ){
		currentState = states[index];
		currentState.onEntry();
	};
	
	return this;
};

var DummyBNF = function(){
	
};

InputBarStateChart = function(){
	var sc = new DummyStateChart();
	var storage = null;
	var triggers = new Array(
			"inputEntered",
			"validInput",
			"invalidInput",
			"errorDisplayed",
			"noCommandFound",
			"commandFound",
			"executedCommand");
	////////////////////////////////////////
	// STATES
	////////////////////////////////////////
	var STATE_WAIT = new sc.State( "Wait" );
	var STATE_PROCESS_INPUT = new sc.State( "ProcessInput" );
	var STATE_SHOW_ERROR = new sc.State( "ShowError" );
	var STATE_MATCH_COMMAND = new sc.State( "MatchCommand" );
	var STATE_EXECUTE_COMMAND = new sc.State( "ExecuteCommand" );
	
	STATE_PROCESS_INPUT.onEntry = function(){
		// split on any amount of whitespace
		storage = $('#mainInput').value.split(/[ ]+/);
		$('#mainInput').className.replace("error", "");
		
		// always return valid, since we don't yet have
		// a BNF to define what is good/bad input
		return sc.fireEvent( triggers[1] );
	};
	
	STATE_SHOW_ERROR.onEntry = function(){
		$('#mainInput').className += " error";
		
		return sc.fireEvent( triggers[3] );
	};
	
	STATE_MATCH_COMMAND.onEntry = function(){
		// No BNF, no command matching
		return sc.fireEvent( triggers[5] );
	};
	
	STATE_EXECUTE_COMMAND.onEntry = function(){
		// Stop gap measure until the BNF is implemented
		eval( $('#mainInput').value );
		$('#mainInput').value = "";
		return sc.fireEvent( triggers[6] );
	};
	
	////////////////////////////////////////
	// TRANSITIONS
	////////////////////////////////////////	
	var TRANS_INPUT_ENTERED = new sc.Transition( triggers[0], STATE_WAIT, STATE_PROCESS_INPUT);
	var TRANS_VALID_INPUT = new sc.Transition( triggers[1], STATE_PROCESS_INPUT, STATE_MATCH_COMMAND);
	var TRANS_INVALID_INPUT = new sc.Transition( triggers[2], STATE_PROCESS_INPUT, STATE_SHOW_ERROR);
	var TRANS_ERROR_DISPLAYED = new sc.Transition( triggers[3], STATE_SHOW_ERROR, STATE_WAIT);
	var TRANS_NO_COMMAND_FOUND = new sc.Transition( triggers[4], STATE_PROCESS_INPUT, STATE_SHOW_ERROR);
	var TRANS_COMMAND_FOUND = new sc.Transition( triggers[5], STATE_MATCH_COMMAND, STATE_EXECUTE_COMMAND);
	var TRANS_EXECUTE_COMMAND = new sc.Transition( triggers[6], STATE_EXECUTE_COMMAND, STATE_WAIT);

	////////////////////////////////////////
	// ADD ELEMENTS
	////////////////////////////////////////
	sc.addState(STATE_WAIT);
	sc.addState(STATE_PROCESS_INPUT);
	sc.addState(STATE_SHOW_ERROR);
	sc.addState(STATE_MATCH_COMMAND);
	sc.addState(STATE_EXECUTE_COMMAND);
	
	sc.addTransition(TRANS_INPUT_ENTERED);
	sc.addTransition(TRANS_VALID_INPUT);
	sc.addTransition(TRANS_INVALID_INPUT);
	sc.addTransition(TRANS_ERROR_DISPLAYED);
	sc.addTransition(TRANS_NO_COMMAND_FOUND);
	sc.addTransition(TRANS_COMMAND_FOUND);
	sc.addTransition(TRANS_EXECUTE_COMMAND);
	
	sc.setInitialState(0);
	
	this.fireEvent = function( trigger ){
		sc.fireEvent( trigger );
	};
	
	return this;
}();

