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

/**
 * The WindowEventHelper function is a helper function that holds all of 
 * the helpers methods for the window_event javascript file. 
 * 
 * @returns the WindowEventHelper object
 */
WindowEventHelper = function(){
	/**
	 * Allows for the user to tab through input elements when the
	 * div_dialog popup is currently displayed
	 */
	this.tabThroughPopupInputs = function() {
			// Get the currently focused element
			var activeElement = document.activeElement;
			
			// Only move forward if this isn't null
			if( activeElement != null) {
				// We're in a table, so we need to get the td, then the tr, then the table
				var table = activeElement.parentNode.parentNode.parentNode;
				
				// Are we actually in the table?
				if( table != null && table.rows != undefined){
					for(var i=0, row; row = table.rows[i]; i++){
						
						// Is the current row the parent row of the active element?
						if( row == activeElement.parentNode.parentNode ){
							if( currentKeys[ KEY_SHIFT ] == 1){
								if( i == 0 ){
									table.rows[ table.rows.length - 1 ].cells[1].firstChild.focus();
								} else {
									table.rows[i - 1].cells[1].firstChild.focus();
								}
							} else {
								if( table.rows[i + 1] == null ){
									table.rows[0].cells[1].firstChild.focus();
								} else {
									table.rows[i + 1].cells[1].firstChild.focus();
								}
							}
							
							// No reason to keep looping, so stop the process
							break;
						}
					}
				}
			}
	};
	
	/**
	 * A generic method to process events
	 */
	this.processEvent = function(index, value, eventType, event) {
		if( index != null )
			currentKeys[ index ] = value;
		
		if( eventType != null )
			BehaviorManager.handleUserEvent( eventType, event );
	};
	
	/**
	 * The default onLoadFunction function. This sets up the initial
	 * behavior of the canvas
	 * When the page is loaded, either present the login screen
	 * or initiate the client
	 */
	this.onLoad = function(){
		console.debug = function(){};	//comment to enable debugging messages

		if( ! UserManagement.isUserLoggedIn() )
			WindowManagement.showLoginScreen();
		else{
			__user = window.localStorage.getItem('user');
			__initClient();
		}
		
		$('#mainInput').focus();
	};
	
	/**
	 * The default oncontextmenu function.
	 * Disables the right click context menu
	 */
	this.onContextMenu = function() {
		return false;
	};
	
	/**
	 * Process the mouse down event
	 * Ignore the right click by default
	 */
	this.onMouseDown = function(){
		if (event.which == MOUSE_RIGHT) {
			return false;
		}
		
		// block clicks on the background when the dialog is displayed
		if( $(event.target).attr("id") == 'div_dim_bg' ) 
			;
		else if( $(event.target).parent().attr("id") == 'div_canvas' )
			if( event.button == MOUSE_LEFT)
				processEvent( null, null, __EVENT_LEFT_PRESS_CANVAS, event);
	};
	
	/**
	 * Process the mouse up event
	 */
	this.onMouseUp = function(){
		// block clicks on the background when the dialog is displayed
		if( $(event.target).attr("id") == 'div_dim_bg') 
			;
		else if( $(event.target).parent().attr("id") == 'div_canvas' )
		{
			if( event.button == MOUSE_LEFT )
				processEvent( null, null, __EVENT_LEFT_RELEASE_CANVAS, event);
			else if( event.button == MOUSE_RIGHT )
				processEvent( null, null, __EVENT_RIGHT_RELEASE_CANVAS, event);
			else if( event.button == MOUSE_MIDDLE )
				processEvent( null, null, __EVENT_MIDDLE_RELEASE_CANVAS, event);
		}
	};
	
	/**
	 * Process the mouse move event. Only process the event
	 * if the canvas is the target of the movement
	 */
	this.onMouseMove = function(){
		if( BehaviorManager.isStatechartLoaded() ){
			if( __isCanvasElement( $(event.target)) )
				processEvent( null, null, __EVENT_MOUSE_MOVE, event);
		} else {
			console.warn( "Cannot process the event until the state chart has been loaded.");
		}
	};
	
	/**
	 * Process the key down event
	 */
	this.onKeyDown = function(event){
		if( event.keyCode == KEY_SHIFT ){
			processEvent( KEY_SHIFT, 1, null, event);
		} else if( event.keyCode == KEY_CTRL ){
			processEvent( KEY_CTRL, 1, null, event);
		} else if( event.keyCode == KEY_ALT ){
			processEvent( KEY_ALT, 1, null, event);
		} else if( event.keyCode == KEY_DEL ){
			processEvent( KEY_DEL, 1, null, event);
		} else if( event.keyCode == KEY_INS ){
			processEvent( KEY_INS, 1, null, event);
		} else if( event.keyCode == KEY_ESC ){
			processEvent( KEY_ESC, 1, null, event);
		} else if( event.keyCode == KEY_TAB ){
			processEvent( KEY_TAB, 1, null, event);
			// Only process the tab event here if the popup dialog is displayed
			if( $('#div_dialog').css("display") == "block" ){
				tabThroughPopupInputs();
			}
			
			if( $('#div_login').css("display") == "block" ) {  // HUSEYIN-LOGIN
				return true;
			}
			
			// This default behavior is to stop the tab here, in order
			// to keep other DOM elements from being selected
			event.stopPropagation();
			event.preventDefault();
			return false;
		} else if( event.keyCode == KEY_ENTER ){
			processEvent( KEY_ENTER, 1, null, event);
			if( $('#div_login').css("display") == "block" ) { // HUSEYIN-LOGIN
				UserManagement.validateCredentials($('#input_username').val(), $('#input_password').val()); 
			}
		}
	};
	
	/**
	 * Process the key up event
	 */
	this.onKeyUp = function(event){
		if( event.keyCode == KEY_SHIFT ){
			processEvent( KEY_SHIFT, 0, __EVENT_KEYUP_SHIFT, event);
		} else if( event.keyCode == KEY_CTRL ){
			processEvent( KEY_CTRL, 0, __EVENT_KEYUP_CTRL, event);
		} else if( event.keyCode == KEY_ALT ){
			processEvent( KEY_ALT, 0, __EVENT_KEYUP_ALT, event);
		} else if( event.keyCode == KEY_TAB ){
			processEvent( KEY_TAB, 0, __EVENT_KEYUP_TAB, event);
		} else if( event.keyCode == KEY_DEL ){
			processEvent( KEY_DEL, 0, __EVENT_KEYUP_DEL, event);
		} else if( event.keyCode == KEY_INS ){
			processEvent( KEY_INS, 0, __EVENT_KEYUP_INS, event);
		} else if( event.keyCode == KEY_CMD1 ||  event.keyCode == KEY_CMD2 || event.keyCode == KEY_CMD3 ){
			processEvent( event.keyCode, 0, __EVENT_KEYUP_DEL, event);
		} else if( event.keyCode == KEY_ESC ){
			processEvent( KEY_ESC, 0, __EVENT_KEYUP_ESC, event);
		} else if( event.keyCode == KEY_ENTER ) {
			if (currentKeys[KEY_SHIFT]==undefined || currentKeys[KEY_SHIFT]==0)
				processEvent( KEY_ENTER, 0, __EVENT_KEYUP_ENTER, event);
		}
	};
	
	/**
	 * Determines whether the current key is pressed or not
	 */
	this.isKeyPressed = function( keyCode ){
		return currentKeys[ keyCode ] == 1;
	};
	
	/**
	 * Initializes the default window behavior
	 */
	this.initDefault = function(){
		window.onload = this.onLoad;
		window.oncontextmenu = this.onContextMenu;
		window.onmousedown = this.onMouseDown;
		window.onmouseup = this.onMouseUp;
		window.onmousemove = this.onMouseMove;
		window.onkeydown = this.onKeyDown;
		window.onkeyup = this.onKeyUp;
	};
	
	return this;
}();

/**
 * Initiate the default Window Event actions
 */
WindowEventHelper.initDefault();