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

__specialTypes = {
	'$ATTRIBUTE':'map<[name,type,default],[string,string,string]>',

	'$CARDINALITY':'map<[dir,type,min,max],[string,string,string,string]>',

	'$EVENT':'ENUM(pre-connect,pre-create,pre-disconnect,pre-delete,pre-edit,post-connect,post-create,post-disconnect,post-delete,post-edit)',

	'$EVENT_HANDLER':'map<[name,event,code],[string,$EVENT,code]>',
	
	'$ARG':'map<[name,type],[string,string]>',
	
	'$METHOD':'map<[name,args,returntype,body],[string,list<$ARG>,string,code]>'
}
