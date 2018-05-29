/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/


/**
 * The purpose of this file is to insert the needed global variables
 * into the namespace. This allows for functions that require access
 * to the global objects that would otherwise be defined after that
 * objects creation to still be accessible
 */
var WindowManagement; /* The Window Management object. This handles management of the display, such as the popup dialogs. Could be merged with GUIUtils */
var WindowEventHelper; /* The Window Event Helper object. This processes window events. */
var HttpUtils; /* The HTTP Utilities object. This handles communication with the server. */
var UserManagement; /* User Management object. This handles user operations, such as log in, log out, and registration. */
var AtomPMClient; /* The AToMPM client object. This handles many core operations of the client. */
var InputBarStateChart; /* The Input Bar state chart object. To be removed */
var InputBarUtils; /* The Input Bar Utilities object. To be removed. */
var GUIUtils; /* The GUI Utilities object. This handles GUI manipulation and display. Could be merged with WindowManagement. */
var Collaboration; /* The Collaboration object. This handles the chat windows */
var BehaviorManager; /* The Behavior Manager object. This drives the original state charts */
var CompileUtils; /* The Compile Utilities object. This handles the compilation of the model into a metamodel */
var ConnectionUtils; /* The Connection Utilities object. This handles edges, connections, control points, etc. */
var DataUtils; /* The Data Utilities object. Handles the loaded objects, edges, toolbars, etc */
var EditUtils; /* Handles the Copy, Paste, Undo, and Redo options. Consider merging this with GUIUtils */
var GeometryUtils; /* Handles transformations and translations. */
var MMMUtils;

var currentKeys = [];

// Command Keys
var KEY_TAB = 9,
	KEY_ENTER = 13,
	KEY_SHIFT = 16,
	KEY_CTRL = 17,
	KEY_ALT = 18,
	KEY_ESC = 27,
	KEY_INS = 45,
	KEY_DEL = 46,
	KEY_CMD1 = 91, 
	KEY_CMD2 = 92, 
	KEY_CMD3 = 224;

// Arrow Keys
var KEY_RIGHT_ARROW = 39, 
	KEY_LEFT_ARROW = 37, 
	KEY_UP_ARROW = 38, 
	KEY_DOWN_ARROW = 40;

// Mouse Buttons
var MOUSE_RIGHT = 2,
	MOUSE_LEFT = 0,
	MOUSE_MIDDLE = 1;