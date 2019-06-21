/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

Collaboration = function(){
	//css/html based on http://net.tutsplus.com/tutorials/javascript-ajax/how-to-create-a-simple-web-based-chat-application/ 
	
	/**
	 * This enables the collaboration links so that they can be selected
	 */
	this.enableCollaborationLinks = function()
	{
		$('#a_screenshare').attr('href', 'mailto:?'+
			'subject='+encodeURIComponent('atompm screenshare invitation')+
			'&body='+encodeURIComponent('follow this link \n\t'+
					window.location.href+'?cswid='+__wid+'&host='+__user+											
					'\nto join '+__user+' in an atompm shared-screen session'));
		$('#a_screenshare').attr('class', 'enabled_link unselectable');

		$('#a_modelshare').attr('href', 'mailto:?'+
			'subject='+encodeURIComponent('atompm modelshare invitation')+
			'&body='+encodeURIComponent('follow this link \n\t'+
				window.location.href+'?cswid='+__wid+'&aswid='+__aswid+'&host='+__user+
				'\nto join '+__user+' in an atompm shared-model session'));
		$('#a_modelshare').attr('class', 'enabled_link unselectable');
	};
	
	/**
	 * Toggles the chat window between the opened and closed states
	 * 
	 * Credits to Maris Jukss
	 */
	this.toggleChat = function() {
		var name = $("#chatName");
		var chat = $("#chat");
		var text = $("#showChat");
		
		if(chat.css("display") == "block") {
	        chat.css("display", "none");
			text.html("Open Chat");
	  	}
		else {
			chat.css("display", "block");
			text.html("");
			name.html(window.localStorage.getItem('user'));
		}
	};
	
	/**
	 * Sends the entered text to the other user and then
	 * clears the chat window
	 */
	this.sendText = function(){
//		var text = document.getElementById("usermsg").value;
		var userMsg = $("#usermsg");
		var text = userMsg.val();
		
		if (text) {
			HttpUtils.httpReq(
					'POST',
					'plugins/chat/chat?wid='+__wid,
					'<b>'+window.localStorage.getItem('user')+'</b>: '+text,
					function(statusCode,resp)
					{
						//call back here
					});
			userMsg.val("");
		}
	};
	
	/**
	 * Updates the chat window
	 */
	this.updateChat = function( text, name ){
		var chatbox = $("#chatbox");
		var currentTime = new Date();
		var hours = currentTime.getHours();
		var minutes = currentTime.getMinutes();
		var oldH = chatbox.scrollHeight-20;
		
		if (minutes < 10)
			minutes = "0" + minutes;
		
		// Include the text in the chatbox
		chatbox.html( chatbox.html() + "<div class='msgln'>("+hours+":"+minutes+") "+text+"<br></div>" );
		
		// Get the new height
		var newH = chatbox.prop("scrollHeight") - 20;
		if (newH > oldH) {
			chatbox.attr("scrollTop", 100000 + "px");
		}
	};
	
	return this;
}();