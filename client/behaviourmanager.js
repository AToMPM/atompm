/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

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