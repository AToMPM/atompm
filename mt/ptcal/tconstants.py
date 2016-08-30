'''*****************************************************************************
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
*****************************************************************************'''

class TConstants :
	#possible completion statuses
	NOT_APPLICABLE = 'NotApplicable'
	SUCCEEDED 		= 'Success'
	FAILED			= 'Failure'
	
	''' hergin :: motif-integration :: start '''
	EXCEPTION			= 'Exception'
	RULE_EXCEPTION_MSG				= 'EXCEPTION :: rule exception on '
	
	MODE_DEBUG = 'debug'
	MODE_RELEASE = 'release'
	
	''' hergin :: motif-integration :: end '''

	#inter-rule delay in PLAY mode
	INTER_RULE_DELAY 		= 0.1
	
	#the delay between verifications that all changelogs pertaining to the last executed rule have been handled
	WAIT_ON_CHLOG_DELAY	= 0.02
	
	#console output for various rule/transformation completion cases
	RULE_SUCCESS_MSG				= 'rule succeeded'
	''' hergin :: motif-integration :: modify fail message '''
	RULE_FAILURE_MSG				= 'rule failed'
	RULE_NOT_APPLICABLE_MSG		= 'WARNING :: rule was not applicable'
	TRANSFORMATION_DONE			= 'transformation(s) terminated with status :: '
	TRANSFORMATION_STOPPED 		= 'transformation stopped'
	REMOTE_APPLICATION_FAILURE = 'ERROR :: rule effects could not be applied :: '
	NO_NEXT_RULE					= 'ERROR :: failed to choose next rule :: '

	#console output for various debugging messages
	DEBUGGING_ON		= 'transformation debugging has been enabled'
	DEBUGGING_OFF		= 'transformation debugging has been disabled'
	DEBUGGING_HALT		= 'WARNING :: popping up transformation debugging window,'+\
							  ' resume transformation with "play" or "step" buttons'+\
							  ' from current window'

	#supported designer code languages
	JAVASCRIPT	= 'JAVASCRIPT'
	PYTHON		= 'PYTHON'

	#metamodel paths
	RULEMM	= '/Formalisms/__Transformations__/TransformationRule/'+\
					  'TransformationRule'
	TRANSFMM	= '/Formalisms/__Transformations__/Transformation/Transformation'
	
	''' hergin :: motif-integration '''
	MOTIFMM	= '/Formalisms/__Transformations__/Transformation/MoTif'
	TCOREMM = '/Formalisms/__Transformations__/Transformation/T-Core'


