class FileBrowser{

    static buildFileBrowser(extensions, manualInput, title, startDir, callback) {
        HttpUtils.httpReq(
            'GET',
            HttpUtils.url('/filelist', __NO_WID),
            undefined,
            function (statusCode, resp) {
                extensions.push('/');
                var fnames = __localizeFilenames(
                    __filterFilenamesByExtension(
                        resp.split('\n'),
                        extensions || ['.*'])
                    ).sort(),
                    folder_buttons = $('<div>'),
                    new_folder_b = $('<button>'),
                    rename_folder_b = $('<button>'),
                    delete_folder_b = $('<button>'),
                    move_folder_b = $('<button>'),
                    file_buttons = $('<div>'),
                    rename_file_b = $('<button>'),
                    delete_file_b = $('<button>'),
                    move_file_b = $('<button>'),
                    feedbackarea = $('<div>'),
                    feedback = GUIUtils.getTextSpan('', "feedback"),
                    fileb =
                        FileBrowser.getFileBrowser(fnames, false, manualInput, __getRecentDir(startDir));

                new_folder_b.attr('id', 'new_folder')
                    .html('new folder')
                    .click(function (ev) {
                        var folder_name = prompt("please fill in a name for the folder");
                        if (folder_name != null) {
                            folder_name = folder_name.replace(/^\s+|\s+$/g, ''); // trim
                            if (!folder_name.match(/^[a-zA-Z0-9_\s]+$/i)) {
                                feedback.html("invalid folder name: " + folder_name);
                            } else {
                                console.log("/" + window.localStorage.getItem('user') + fileb['getcurrfolder']() + folder_name + '.folder');
                                DataUtils.createFolder("/" + window.localStorage.getItem('user') + fileb['getcurrfolder']() + folder_name + '.folder', function (statusCode, resp) {
                                    if (!utils.isHttpSuccessCode(statusCode)) {
                                        feedback.html(resp);
                                    } else {
                                        feedback.html('created ' + folder_name);
                                        fnames.push(fileb['getcurrfolder']() + folder_name + "/");
                                        fileb['refresh'](fnames);
                                    }
                                });
                            }
                        }
                    });
                folder_buttons.append(new_folder_b);

                rename_folder_b.html('rename folder')
                    .click(function (ev) {
                        var value = fileb['getcurrfolder']();
                        var folder_name = prompt("please fill in a new name for folder " + value);
                        if (folder_name != null) {
                            folder_name = folder_name.replace(/^\s+|\s+$/g, ''); // trim
                            if (!folder_name.match(/^[a-zA-Z0-9_\s]+$/i)) {
                                feedback.html("invalid folder name: " + folder_name);
                            } else {
                                DataUtils.renameInCloud("/" + window.localStorage.getItem('user') + value.slice(0, -1) + ".folder", folder_name, function (statusCode, resp) {
                                    if (!utils.isHttpSuccessCode(statusCode)) {
                                        feedback.html(resp);
                                    } else {
                                        var matches = value.match(/^\/(.*\/)?(.*)\/$/),
                                            newvalue = "/" + (matches[1] || "") + folder_name + "/";
                                        for (var idx in fnames) {
                                            fnames[idx] = fnames[idx].replace(new RegExp("^(" + value + ")(.*)"), newvalue + "$2");
                                        }
                                        fileb['refresh'](fnames, newvalue);
                                        fileb['clearselection']();
                                        feedback.html('renamed ' + value + ' to ' + newvalue);
                                    }
                                });
                            }
                        }
                    });
                folder_buttons.append(rename_folder_b);

                delete_folder_b.html('delete folder')
                    .click(function (ev) {
                        var value = fileb['getcurrfolder']();
                        if (confirm("are you sure you want to delete " + value + "?")) {
                            DataUtils.deleteFromCloud("/" + window.localStorage.getItem('user') + value.slice(0, -1) + ".folder", function (statusCode, resp) {
                                if (!utils.isHttpSuccessCode(statusCode)) {
                                    feedback.html(resp);
                                } else {
                                    var matches = value.match(/^\/(.*\/)?(.*)\/$/),
                                        newvalue = "/_Trash_" + value;
                                    for (var idx in fnames) {
                                        fnames[idx] = fnames[idx].replace(new RegExp("^(" + value + ")(.*)"), newvalue + "$2");
                                    }
                                    fileb['refresh'](fnames);
                                    fileb['clearselection']();
                                    feedback.html('deleted ' + value);
                                }
                            });
                        }
                    });
                folder_buttons.append(delete_folder_b);

                move_folder_b.html('move folder')
                    .click(function (ev) {
                        var value = fileb['getcurrfolder']();
                        var folder_loc = prompt("please fill in a new parent folder for folder " + value);
                        if (folder_loc != null) {
                            folder_loc = folder_loc.replace(/^\s+|\s+$/g, ''); // trim
                            if (!folder_loc.match(/^\/([a-zA-Z0-9_\s]+\/)*$/i)) {
                                feedback.html("invalid parent location: " + folder_loc);
                            } else {
                                DataUtils.moveInCloud("/" + window.localStorage.getItem('user') + value.slice(0, -1) + ".folder", folder_loc, function (statusCode, resp) {
                                    if (!utils.isHttpSuccessCode(statusCode)) {
                                        feedback.html(resp);
                                    } else {
                                        var matches = value.match(/^\/(.*\/)?(.*)\/$/),
                                            newvalue = folder_loc + matches[2] + "/";
                                        for (var idx in fnames) {
                                            fnames[idx] = fnames[idx].replace(new RegExp("^(" + value + ")(.*)"), newvalue + "$2");
                                        }
                                        fileb['refresh'](fnames, newvalue);
                                        fileb['clearselection']();
                                        feedback.html('moved ' + value + ' to ' + folder_loc);
                                    }
                                });
                            }
                        }
                    });
                folder_buttons.append(move_folder_b);

                rename_file_b.html('rename file')
                    .click(function (ev) {
                        var value = fileb['getselection']();
                        var file_name = prompt("please fill in a new name for file " + value);
                        if (file_name != null) {
                            file_name = file_name.replace(/^\s+|\s+$/g, ''); // trim
                            if (!file_name.match(/^[a-zA-Z0-9_\s\.]+$/i)) {
                                feedback.html("invalid file name: " + file_name);
                            } else {
                                DataUtils.renameInCloud("/" + window.localStorage.getItem('user') + value + ".file", file_name, function (statusCode, resp) {
                                    if (!utils.isHttpSuccessCode(statusCode)) {
                                        feedback.html(resp);
                                    } else {
                                        var matches = value.match(/^\/(.*\/)?(.*)$/),
                                            newvalue = "/" + (matches[1] || "") + file_name;
                                        var idx = fnames.indexOf(value);
                                        if (idx >= 0) {
                                            fnames[idx] = newvalue;
                                        }
                                        fileb['refresh'](fnames);
                                        fileb['clearselection']();
                                        feedback.html('renamed ' + value + ' to ' + newvalue);
                                    }
                                });
                            }
                        }
                    });
                file_buttons.append(rename_file_b);

                delete_file_b.html('delete file')
                    .click(function (ev) {
                        var value = fileb['getselection']();
                        if (confirm("are you sure you want to delete " + value + "?")) {
                            DataUtils.deleteFromCloud("/" + window.localStorage.getItem('user') + value + ".file", function (statusCode, resp) {
                                if (!utils.isHttpSuccessCode(statusCode)) {
                                    feedback.html(resp);
                                } else {
                                    feedback.html('deleted ' + value);
                                    var idx = fnames.indexOf(value);
                                    if (idx >= 0) {
                                        fnames.splice(idx, 1);
                                    }
                                    fileb['refresh'](fnames);
                                    fileb['clearselection']();
                                }
                            });
                        }
                    });
                file_buttons.append(delete_file_b);

                move_file_b.html('move file')
                    .click(function (ev) {
                        var value = fileb['getselection']();
                        var folder_loc = prompt("please fill in a new parent folder for file " + value);
                        if (folder_loc != null) {
                            folder_loc = folder_loc.replace(/^\s+|\s+$/g, ''); // trim
                            if (!folder_loc.match(/^\/([a-zA-Z0-9_\s]+\/)*$/i)) {
                                feedback.html("invalid parent location: " + folder_loc);
                            } else {
                                DataUtils.moveInCloud("/" + window.localStorage.getItem('user') + value + ".file", folder_loc, function (statusCode, resp) {
                                    if (!utils.isHttpSuccessCode(statusCode)) {
                                        feedback.html(resp);
                                    } else {
                                        var matches = value.match(/^\/(.*\/)?(.*)$/),
                                            newvalue = folder_loc + matches[2];
                                        feedback.html('moved ' + value + ' to ' + folder_loc);
                                        var idx = fnames.indexOf(value);
                                        if (idx >= 0) {
                                            fnames[idx] = newvalue;
                                        }
                                        fileb['refresh'](fnames);
                                        fileb['clearselection']();
                                    }
                                });
                            }
                        }
                    });
                file_buttons.append(move_file_b);

                GUIUtils.setupAndShowDialog(
                    [fileb['filebrowser'], folder_buttons, file_buttons, feedback],
                    function () {
                        var value = [fileb['getselection']()];
                        if (value.length > 0 && value[0] != "" && startDir) {
                            __setRecentDir(startDir, value[0].substring(0, value[0].lastIndexOf('/') + 1));
                        }
                        return value;
                    },
                    __TWO_BUTTONS,
                    title,
                    callback);
            });
    }


    /**
     * Returns a <div> with an interactive file browser within it
     *
     * @param fnames - a complete list of all files in the directory tree
     * structure
     * @param draggable - when true, files and folders can be meaningfully
     * dragged
     * @param newfile when true, an editable new file icon is present
     * @param startfolder if set, starts navigation at the specified folder
     */
    static getFileBrowser(fnames, draggable, newfile, startfolder) {
        var fileb = $("<div>"),
            navdiv = $("<div>"),
            input = $("<input>"),
            selection = undefined,
            currfolder = '/',
            clearSelection =
                function () {
                    if (selection) {
                        selection.attr("class", 'fileb_icon');
                        selection = undefined;
                        input.val('');
                    }
                },
            navbuttononclick =
                /* 1 construct the full path associated to the clicked button
                    2 remove 'deeper' buttons
                    3 chdir to selected folder */
                function (ev) {
                    var path = '';
                    for (var i = 0; i < navdiv.children("button").length; i++) {
                        path += $(navdiv.children()[i]).html() + '/';
                        if ($(navdiv.children()[i]).html() == $(ev.target).html())
                            break;
                    }

                    setCurrentFileBrowserFolder(path.substring(1), fnames);
                },
            setCurrentFileBrowserFolder =
                /* 1 determine files and folders from the given folder
                    2 produce icons for them and add them to to-be content div
                    3 create navigation toolbar for complete directory hierarchy
                    4 replace previous content div, if any, with new one
                      5 clear past selection, if any, and remember current folder */
                async function (folder, fnames) {
                    var div = $('#div_fileb-contents'),
                        folders = [],
                        files = [],
                        exists = false;

                    // If it already exists, remove everything!
                    if (div.length > 0) {
                        $('#div_fileb-contents').remove();
                        //					 exists = true;
                    }

                    div = $("<div>");

                    div.attr("class", 'fileb_pane')
                        .attr("id", 'div_fileb-contents');


                    //fnames might be a function that returns the files in
                    //the folder
                    //bentley: the ModelVerse only examines one folder at a time
                    let file_list = fnames;
                    if (!(Array.isArray(fnames))){
                        file_list = await fnames(folder);
                    }

                    let _folder = utils.regexpe(folder);
                    file_list.forEach(function (fname) {

                        let matches = fname.match('^' + _folder + '(.+?/)');
                        if (matches) {
                            if (!utils.contains(folders, matches[1]))
                                folders.push(matches[1]);
                        }
                        else if ((matches = fname.match('^' + _folder + '(.*)'))) {
                            if (matches[1].length > 0) {
                                files.push(matches[1]);
                            }
                        }
                    });

                    let all_entries = folders.concat(files);

                    //get the maximum filename length
                    let maxFnameLength = utils.max(all_entries, function (_) {
                        return _.length;
                    });

                    //				 var tmpDiv = $("<div>");
                    all_entries.forEach(function (fname) {
                        let icon = HttpUtils.getFileIcon(fname);
                        if (icon) {
                            icon.css("width", 8 + maxFnameLength + 'ex');
                            icon.click(function (ev) {
                                clearSelection();

                                if (fname.match(/\/$/))
                                    setCurrentFileBrowserFolder(folder + fname, fnames);
                                else {
                                    input.val(folder + fname);
                                    selection = icon;
                                    selection.attr("class", 'fileb_icon_selected');
                                }
                            });

                            if (draggable) {
                                //icon.setAttribute('draggable',true);
                                icon.attr("draggable", true);
                                icon.get(0).ondragstart =
                                    function (event) {
                                        var uri = HttpUtils.url(folder + fname + '.file', __NO_WID);
                                        event.dataTransfer.effectAllowed = 'copyMove';
                                        event.dataTransfer.setData(
                                            'DownloadURL',
                                            'application/zip:' + fname + '.zip:' +
                                            window.location.origin + uri);
                                        event.dataTransfer.setData('uri', uri);
                                    };
                            }

                            div.append(icon);
                        }
                    });

                    if (newfile) {
                        var icon = HttpUtils.getNewFileIcon(function (ev) {
                            input.val(folder + ev.target.textContent);
                        });
                        icon.css("width", 8 + maxFnameLength + 'ex');
                        div.append(icon);
                    }

                    navdiv.empty();

                    //				 while (navdiv.children().length > 0) {
                    //					navdiv.find(navdiv.lastChild).remove();
                    //				 }
                    //let tmpDiv = $("<div>");
                    var subfolders = folder.split('/').filter(function (subf) {
                        return subf != '';
                    });
                    subfolders.unshift('/');
                    subfolders.forEach(function (subfolder) {
                        var navbutton = $('<button>');
                        navbutton.html(subfolder);
                        navbutton.attr('id', 'navbar_' + subfolder);
                        navbutton.click(navbuttononclick);
                        navdiv.append(navbutton);
                    });

                    //navdiv.html( tmpDiv.html() );


                    if (exists) {
                        //					 $('#div_fileb-contents').html( div.html() );
                        //					 fileb.append(div);
                        $('#div_fileb-contents').remove();
                        fileb.append(div);
                    } else
                        fileb.append(div);

                    clearSelection();
                    currfolder = folder;
                };

        let file_browser_width = 120;
        fileb.css("width", file_browser_width + 'ex')
            .css("maxWidth", '100%');

        navdiv.css("align", 'left');

        input.attr("type", 'hidden');

        fileb.append(navdiv);
        fileb.append(input);

        setCurrentFileBrowserFolder(startfolder ? startfolder : '/', fnames);

        return {
            'filebrowser': fileb,
            'filepane': function () {
                return $('#div_fileb-contents');
            },
            'getcurrfolder': function () {
                return currfolder;
            },
            'getselection': function () {
                return input.val();
            },
            'clearselection': function () {
                clearSelection();
            },
            'refresh': function (fnames, the_folder) {
                setCurrentFileBrowserFolder(the_folder || currfolder, fnames);
            }
        };
    }


}