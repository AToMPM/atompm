/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

__specialTypes = {
	'$ATTRIBUTE':'map<[name,type,default],[string,string,string]>',

	'$CARDINALITY':'map<[dir,type,min,max],[string,string,string,string]>',

	'$EVENT':'ENUM(pre-connect,pre-create,pre-disconnect,pre-delete,pre-edit,post-connect,post-create,post-disconnect,post-delete,post-edit,validate)',

	'$EVENT_HANDLER':'map<[name,event,code],[string,$EVENT,code]>',
	
	'$ARG':'map<[name,type],[string,string]>',
	
	'$METHOD':'map<[name,args,returntype,body],[string,list<$ARG>,string,code]>'
};
