/* a simple hello world plugin... it listens for "POST /hello" requests... requests are received by "csworker" and forwarded to "asworker"... both respond with their __worker\'s id and with a counter of the number of handled requests */
{
	'interfaces'	: [{'method':'POST', 'url=':'/pnml'}],


	


	'csworker'		: 
		function(resp,method,uri,reqData,wcontext)
		{
			//console.log('Inside PNML');
			var self		= this,
				 actions = [__wHttpReq('GET','/current.model?wid='+wcontext.__aswid)];
      //console.log(reqData);
			_do.chain(actions)(
					function(asdata)
					{
						var sn = asdata['sequence#'];
						if( self.__nextASWSequenceNumber - 1 > sn )
							self['PUT *.model'](resp,urin);
						else if( self.__nextASWSequenceNumber - 1 < sn )
							setTimeout(self['PUT *.model'], 200, resp, urin);
						else
						{
							if( (res = _mmmk.read())['$err'] )
								__postInternalErrorMsg(resp,res['$err']);
							else
							{
								var ts = Math.round((new Date()).getTime() / 1000);
								head = '<pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">';
								head +=  '<net id="'+ts+'" type="http://www.pnml.org/version-2009/grammar/ptnet">';
								head +='<page>\n';
								var cs = _utils.jsonp(res);
								var as = _utils.jsonp(asdata['data']);
								
								function addPlace(name,id,x,y,initial) {
									var file='<place id="'+id+'">\n';
									file+='<name>\n';
								    file +='<text>"'+name+'"</text>\n';
								    file +='<graphics><offset x="22" y="-10"/> </graphics>\n';
								    //graphics with offset later
								    file+='</name>\n';
    							    file+='<graphics><position x="'+x+'" y="'+y+'"/> </graphics>\n';
    							    if (initial) {
    							    	file+='<initialMarking>\n<text>'+initial+'</text>\n';
    							    	file+=' <graphics> <offset x="22" y="20"/></graphics> \n</initialMarking>\n';
    							    }
                                    file+='</place>\n';
                                    return file;
								}
								function addTrans(name,id,x,y) {
									var file='<transition id="'+id+'">\n <name> <text>'+name+'</text>\n';
									file+='<graphics>   <offset x="22" y="-14"/>  </graphics>\n';
                                   file+='</name>\n<graphics> <position x="'+x+'" y="'+y+'"/></graphics>\n</transition>\n';
                                   return file;
								}
								function addArc(from,to) {
									var file='<arc id="'+from+to+'" source="'+from+'" target="'+to+'">\n';
                                    file+='<inscription> <text>1</text> </inscription> </arc>\n';
                                    return file;
								}
								var mData = {
										'csm':_utils.jsonp(res),
										'asm':_utils.jsonp(asdata['data'])},
									 path  = reqData['fname']
									 dir	 = _path.dirname(path).replace(/"/g,'\\"'),
									 
									 writeActions = 
										[//_cp.exec('mkdir -p "'+dir+'"'),
									 	 function()
										 {
									 		var cs = mData['csm'];
											var as = mData['asm'];
											var tp = [];
											for (key in as.nodes) {
												var id = key;
											    var x=0;
											    var y=0;
											    var initial = 0;
											    var name = ''
											    var tokens =  0;
												if (as.nodes[key]['$type'].indexOf('Transition') != -1) {
													x = cs.nodes[key]['position']['value'][0];
													y = cs.nodes[key]['position']['value'][1];
													name = as.nodes[key]['name']['value'];
													head+=addTrans(name,id,x,y);
													tp.push(key);
													
												} else if (as.nodes[key]['$type'].indexOf('Place') != -1) {
													x = cs.nodes[key]['position']['value'][0];
													y = cs.nodes[key]['position']['value'][1];
													name = as.nodes[key]['name']['value'];
													tokens = as.nodes[key]['nbTokens']['value'];
													head+=addPlace(name,id,x,y,tokens);
													tp.push(key);
												}
												
											}
											var to = new Array();
											var from = new Array();
											for (key in as.edges) {
												//console.log(as.edges[key]['src']);
												if (tp.indexOf(as.edges[key]['src'] ) !=-1 ) {
													from[as.edges[key]['dest']]=as.edges[key]['src'];
												} else {
													to[as.edges[key]['src']] = as.edges[key]['dest'];
												}
											}
											for (key in from) {
												head += addArc(from[key],to[key]);
											}
											head+='  </page>\n </net>\n </pnml>';
											console.log(path+".pnml");
											_fs.open(path+".pnml",'w',function (err, fd) {
											console.log(fd);
										  _fs.write(fd,head);
										  _fs.close(fd);
											});
											 return true
										 }];
								_do.chain(writeActions)(
									function()
									{
										__postMessage(
											{'statusCode':204,
	  										 'respIndex':resp});
									},
									function(writeErr)	
									{
										__postInternalErrorMsg(resp,writeErr);
									}
								);
							}
						}
					},
					function(err) 	{__postInternalErrorMsg(resp,err);}
			);
		},


	'asworker'		: 
		function(resp,method,uri,reqData,wcontext)
		{
			this.localcontext.counter++;
			__postMessage(
					{'statusCode':200, 
					 'changelog':
					 	[{'op':'SYSOUT', 
						 'text':'Hello #'+this.localcontext.counter+' from asworker #'+__wid}],
					 'sequence#':__sequenceNumber(),
					 'respIndex':resp});
		}
}
