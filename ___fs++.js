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
	 _os = require('os'),
     _fs = require('fs');


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
				_cp.exec('dir /s /b "'+dir+'"',
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
										var newpath = dir+path.substring(
														path.indexOf(windir)+windir.length).
													  replace(/\\/g,'/');
                                        try {
                                            if (_fs.lstatSync(path).isDirectory()) {
                                                newpath = newpath + '/';
                                            }
                                        } catch (e) {}                                        
                                        return newpath;
									});
							paths.pop();
							callback(err,paths.join('\n'),stderr);
						}
					});
				break;
				
			case 'Linux'  :
			case 'Darwin' :
				_cp.exec('find "'+dir+'"',
					function(err, stdout, stderr)
					{
						if( err )
							callback(err,stdout,stderr);
						else {
                            var paths = stdout.slice(0,-1),
                                newpaths = paths.split('\n').map(function(path) {
                                    if (_fs.lstatSync(path).isDirectory()) {
                                        return path + "/";
                                    } else return path;
                                })
							callback(err,newpaths.join('\n'),stderr);
                        }
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
        var split_dir = dir.split('/'),
            curr_dir = '';
        for (var i in split_dir) {
            curr_dir += split_dir[i] + '/';
            if (!_fs.existsSync(curr_dir)) {
                _fs.mkdir(curr_dir, 484, function(err) {if (err) {if (err.code != 'EEXIST') callback(err);}});
            }
        }
        callback();
	};



exports.mv =
	function(src,dest,callback)
	{
        var split_string = src.split('/');
        _fs.rename(src, dest + split_string[split_string.length-1],callback);
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



// http://stackoverflow.com/questions/18052762/remove-directory-which-is-not-empty
exports.deleteFolderRecursive = function(path) {
   if( _fs.existsSync(path) ) {
       _fs.readdirSync(path).forEach(function(file,index){
           var curPath = path + "/" + file;
           if(_fs.lstatSync(curPath).isDirectory()) { // recurse
               deleteFolderRecursive(curPath);
           } else { // delete file
               _fs.unlinkSync(curPath);
           }
       });
       _fs.rmdirSync(path);
   }
};
	
	

