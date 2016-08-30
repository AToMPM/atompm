/*******************************************************************************
AToMPM - A Tool for Multi-Paradigm Modelling

Copyright (c) 2011 Raphael Mannadiar (raphael.mannadiar@mail.mcgill.ca)
Modified by Conner Hansen (chansen@crimson.ua.edu)

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

BehaviorManager = new function(){
	var activeBehaviourStatechart = undefined;
	
	/**
	 * Sends the current event to the currently active state chart, if 
	 * it exists
	 */
	this.handleUserEvent = function( name, event ){
		if( activeBehaviourStatechart == undefined ) {
			console.warn('There is no active behaviour statechart to process the event. ' +
					'If this event was triggered immediately after a page load, ' + 
					'then the statechart may just not be loaded yet.');
		} else {
			activeBehaviourStatechart.handleUserEvent(name,event);
		}
	};
	
	/**
	 * Returns whether or not there is a state chart currently loaded
	 */
	this.isStatechartLoaded = function() {
		return activeBehaviourStatechart != undefined;
	};
	
	/**
	 * Sets the currently active state chart
	 */
	this.setActiveBehaviourStatechart = function(sc, init){
		if( sc == __SC_DOCK )
			throw 'Dock behaviour is not [yet] described by a statechart';
		else if( sc == __SC_CANVAS )
			activeBehaviourStatechart = __canvasBehaviourStatechart;
		else if( sc == __SC_DIALOG )
			activeBehaviourStatechart = __dialogBehaviourStatechart;

		if( init )
			activeBehaviourStatechart.init();
	};
	
	return this;
}();