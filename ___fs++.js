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


/* this file contains platform-oblivious wrappers for various windows and unix 
	commands... it's purpose is to hide ugly platform-specific details and to 
  	provide higher-level functions that those provided by nodejs' fs module */

var _cp = require('child_process'),
	 _os = require('os');


/* NOTE:: because microsoft has apparently diversified into hiring comedians,
			 robocopy can succeed with non-0 exit codes */
exports.cp =
	function(src,dest,callback)
	{
		switch(_os.type())
		{
			case 'Windows_NT' :
				_cp.exec('robocopy "'+src+'" "'+dest+'" /e',
					function(err,stdout,stderr)
					{
						if( err && err.code == 1 )
							callback(undefined,stdout,stderr);
						else
							callback(err,stdout,stderr);
					});
				break;
				
			case 'Linux'  :
			case 'Darwin' :
				_cp.exec('cp -R "'+src+'" "'+dest+'"',callback);
				break;

			default:
				throw 'unsupported OS :: '+_os.type();
		}
	};



/* NOTE :: in MS-DOS dir, results are absolute windows paths... these must be 
			  converted to unix paths and relativized to the atompm root 
 
 	NOTE :: in both cases, the return value's last entry is '\n'... we slice it
			  off to avoid dumb problems when later on when splitting on '\n' */
exports.findfiles =
	function(dir,callback)
	{
		switch(_os.type())
		{
			case 'Windows_NT' :
				_cp.exec('dir /s /b /a:-d "'+dir+'"',
					function(err, stdout, stderr)
					{
						if( err )
							callback(err,stdout,stderr);
						else
						{
							var windir = (dir.charAt(0)=='.' ? dir.substring(1) : dir).
												replace(/\//g,'\\'),
								 paths  = stdout.split('\r\n').map(
									function(path)
									{
										return dir+path.substring(
														path.indexOf(windir)+windir.length).
													  replace(/\\/g,'/');
									});
							paths.pop();
							callback(err,paths.join('\n'),stderr);
						}
					});
				break;
				
			case 'Linux'  :
			case 'Darwin' :
				_cp.exec('find "'+dir+'" -type f',
					function(err, stdout, stderr)
					{
						if( err )
							callback(err,stdout,stderr);
						else
							callback(err,stdout.slice(0,-1),stderr);
					});
				break;

			default:
				throw 'unsupported OS :: '+_os.type();
		}
	};



/* NOTE :: in MS-DOS mkdir, trying to make an already existing directory 
			  triggers an error which we ignore */
exports.mkdirs =
	function(dir,callback)
	{
		switch(_os.type())
		{
			case 'Windows_NT' :
				_cp.exec('mkdir "'+dir.replace(/\//g,'\\')+'"',
					function(err,stdout,stderr)
					{
                        /* 	TODO :: This is language specific. If a user is using a version of Windows which is in another language, the save will fail.
							This function should only be executed if the folder does not exist. */
						if( String(err).match(
			/Error: Command failed: A subdirectory or file .* already exists./) )
							callback(undefined,stdout,stderr);
						else
							callback(err,stdout,stderr);
					});
				break;
				
			case 'Linux'  :
			case 'Darwin' :
				_cp.exec('mkdir -p "'+dir+'"',callback);
				break;

			default:
				throw 'unsupported OS :: '+_os.type();
		}
	};



exports.mv =
	function(src,dest,callback)
	{
		switch(_os.type())
		{
			case 'Windows_NT' :
				_cp.exec('move /y "'+src+'" "'+dest+'"',callback);
				break;
				
			case 'Linux'  :
			case 'Darwin' :
				_cp.exec('mv "'+src+'" "'+dest+'"',callback);
				break;

			default:
				throw 'unsupported OS :: '+_os.type();
		}
	};



exports.rmdirs =
	function(dir,callback)
	{
		switch(_os.type())
		{
			case 'Windows_NT' :
				_cp.exec('rmdir /s "'+dir+'"',callback);
				break;
				
			case 'Linux'  :
			case 'Darwin' :
				_cp.exec('rm -rf "'+dir+'"',callback);
				break;

			default:
				throw 'unsupported OS :: '+_os.type();
		}
	};




	
	

