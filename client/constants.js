/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

/****************************** GLOBAL CONSTANTS ******************************/
var __WEBPAGE__ = 'https://atompm.github.io/',
	__RELEASE_LOC__ = "https://api.github.com/repos/AToMPM/atompm/releases/latest",
	__DOC_WEBPAGE__ = "https://atompm.readthedocs.io/en/latest/",
    __VERSION__ = '0.10.0',
    __DEFAULT_SAVEAS		 	= '.autosave.model',
	 __TITLE						= 'AToMPM',
	 __EXITWARNING				= 'There are unsaved changes. Proceeding will cause'+
	 								  ' them to be permanently lost.',
	 __MAINMENU_PATH			= '/Toolbars/MainMenu/MainMenu.buttons.model',
	 __DEFAULT_IMG_DATAURI	= 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAES0lEQVRoQ+2YV04jQRCGtwgi5yAyNlFkmxPgG+yeYPENlhMsnAD2BPgGsCeAG+AHcrLJiCySyOxfI7DscRXY2IwZaVviBU93f191dU/1kNvtnklLS3N9s2F7enryU39//7MN2UPI5HK57C3Q19dnb4He3l57C/T09NhboLu7WxSYnZ2lr7S5NU7q6uoSBebm5r6UgMZJnZ2dosD8/PyXEtA4qaOjQxRYWFiIEnA4HMVZWVmDSK2fePk5Hh4ePCsrK34rUk3jpPb2dlFgaWkpQqC1tdUF6AnAOhiYiDyLi4vTVsDzHBontbW1iQLLy8shAY58ZmZmANDFPNjz8/M0Iu+xCp7n0TgJkRUFABgSaGlpGQX8r1dg1CA/1tbWJq0U0DgJcKLA6upqSKC5ufn0Nfov0B78bln68JwaJwFOFECEwwUinnl8fPQEg0FLBTROampqEgXW19cNAeS/A5s3EJ4uSKEhCIxZmUIaJzmdTlEgEAiEVsD8DASCGxsbTisFNE5qbGwUBQAYEsAzfHx+DwfGSTSyubk5bJWExkkNDQ2iAOBCArW1ta709PQZMywkxra2toaskNA4qb6+XhQAWMSLDBKD2AvjAmwQ/5uEzN/t7e1P29gaJ9XV1YkCgIkqJfDsAEB/40gdMKXTNP438pkCGichsqLAzs6OWsxVVVU5+IB6kQju7+/zKsTUeCXx4Cj++K0+dnV1NXKG9l5njZNqampEgd3d3aRXoxAfQBpOmWD919fXnvckNE6qrq4WBfb29pIqUIyGSjYAAaOeCm/8eeT29vZNCY2TEBVRAGmRVIHKyspxwHP6iI0l7u7uVAmNkzCwKHBwcJA0gfLycil1okRwQPgODw+9kqHGSRUVFaIABkqmwJT55NJWAhJDR0dHUWWKxkmIjiiAQZIiwNEHrHnjvnno4KbnxqaOuOlpnFRWViYKHB8fJ0WgtLR0BtGP69srVsF/cnLiDrfUOAkTiAIYIGEBHDwx5b6yHCNgGH79TeOkkpISUeD09DRCoLCwcBT1kHErM74KE/3BMvveyoWioqIpnDycQnE3zHGGOTiVgtxZ4yRESRRAx5AA4IcB8ttMwXdjnN/em5sbY5Lwlp+fP5CRkRFX7pvHgITv/PzcOJU0TgKcKICOhkBeXp5YiYZNdgYR78XFRcQduaCgYAIRjCjB414GdMC7wckB0jgJE4kCADIEEMmYjkC+H1xeXho5m52d7eCvGB8BFvr4wOLVOAmAogBg+DfO35jTgF9EKM68WLWIrxiJiuBYdSIdxYAQJhMFAMK/MTxLxNxY4iV1omqemAcxPch3cOxBrmCjGuXm5ooC9/f3bqRB1C3soxCJ9OPDQnuTU05OjijwEsnBRCa2oi9hw4kCfA5Lpa8VUPHMQajRRYF4Bknls4Q8t7cAjid7C6C+sbcANqq9BbAB467XU7lpw+fme0PCNX+qZf4LpHoF/gFk19ZFXDgSYQAAAABJRU5ErkJggg==',

	 _FILE_BROWSER 		 	= 0,
	 _LOADED_TOOLBARS		 	= 1,
	 _LEGAL_CONNECTIONS	 	= 2,
	 _ENTITY_EDITOR		 	= 3,
	 _ERROR					 	= 4,
	 __FATAL_ERROR			 	= 5,
	 __SVG_TEXT_EDITOR	 	= 6,
	 _CUSTOM						= 7,
	 _DICTIONARY_EDITOR 		= 8,
	 _CLOUD_DATA_MANAGER		= 9,

	 __TWO_BUTTONS			 	= 0,
	 __ONE_BUTTON			 	= 1,
	 __NO_BUTTONS			 	= 2,

	 __NO_WID				 	= 1,
	 __FORCE_GET			 	= 2,
	 __NO_USERNAME			 	= 4,

	 __BUTTON_TOOLBAR		 	= 0,
	 __METAMODEL_TOOLBAR	 	= 1,

	 __CANVAS_SIZE				= 10000,
	 __ICON_SIZE			 	= 48.0,
	 __GRID_CELL_SIZE			= 25,
	 __GEOM_CTRLS_WIDTH	 	= 128,
	 __TAB_WIDTH				= 4,
	 __MAX_TEXTAREA_LINES	= 10,
	 __MAX_SELECT_OPTIONS	= 6,
	 __ATTR_MAP				 	= {'textContent':'text',
		 							 	'cornerRadius':'r',
									 	'segments':'path'},

	 __NO_CONFLICT			 	= 0,
	 __EDIT_CONFLICT		 	= 1,

	 __EDGETYPE				 	= 0,
	 __NODETYPE				 	= 1,

	 __VISUAL_LINK			 	= 'visual',
	 __CONTAINMENT_LINK	 	= 'containment',

	 __EVENT_RIGHT_RELEASE_CANVAS			= 0,
 	 __EVENT_RIGHT_RELEASE_ICON			= 1,
 	 __EVENT_RIGHT_PRESS_ICON				= 2,
 	 __EVENT_LEFT_RELEASE_CANVAS			= 3,
	 __EVENT_LEFT_RELEASE_ICON				= 4,
 	 __EVENT_LEFT_RELEASE_SELECTION		= 5,
	 __EVENT_LEFT_PRESS_CANVAS				= 6,
	 __EVENT_LEFT_PRESS_ICON				= 7,
 	 __EVENT_LEFT_PRESS_SELECTION			= 8,
	 __EVENT_LEFT_DBLCLICK_ICON			= 9,
 	 __EVENT_MIDDLE_RELEASE_CANVAS		= 10,
 	 __EVENT_MIDDLE_RELEASE_ICON			= 11,
 	 __EVENT_MOUSE_MOVE						= 12,
	 __EVENT_MOUSE_OVER_ICON				= 13,
 	 __EVENT_MOUSE_OUT_ICON					= 14,
 	 __EVENT_KEYUP_ALT						= 15,
 	 __EVENT_KEYUP_CTRL						= 16,
 	 __EVENT_KEYUP_DEL						= 17,
 	 __EVENT_KEYUP_ESC						= 18,
	 __EVENT_KEYUP_SHIFT						= 19,
	 __EVENT_KEYUP_COMMAND					= 20,
	 __EVENT_KEYUP_TAB						= 21,
	 __EVENT_LEFT_PRESS_CTRL_POINT		= 22,
	 __EVENT_LEFT_RELEASE_CTRL_POINT		= 23,
	 __EVENT_MIDDLE_RELEASE_CTRL_POINT 	= 24,
	 __EVENT_RIGHT_RELEASE_CTRL_POINT	= 25,
	 __EVENT_SHIFT_MIDDLE_RELEASE_ICON	= 26,
	 __EVENT_CANCELED_DIALOG				= 27,
	 __EVENT_OKAYED_DIALOG					= 28,
	 __EVENT_CODED_CANVAS_EDIT				= 29,
 	 __EVENT_KEYUP_INS						= 30,
 	 __EVENT_SHIFT_WHEEL_ICON				= 31,
	 __EVENT_CODED_SELECTION				= 32,
	 __EVENT_SHOW_DIALOG						= 33,
	 __EVENT_SHIFT_LEFT_RELEASE_ICON		= 34,
	  __EVENT_KEYUP_ENTER = 35, // HUSEYIN-ENTER
	 
	 __SC_CANVAS	= 0,
	 __SC_DOCK		= 1,
	 __SC_DIALOG	= 2,
	 
	 __GEOM_TRANSF		= 0,
	 __SELECTION_DRAG	= 1;

