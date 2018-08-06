const {
    __errorContinuable,
    __httpReq,
    __wHttpReq,
    __postInternalErrorMsg, __postMessage,
    __sequenceNumber,
    __successContinuable,
	__uri_to_id
} = require("../__worker");

const _do = require("../___do");
const _utils = require('../utils');
const _mmmk = require("../mmmk");
const _fs = _do.convert(require('fs'), ['readFile', 'writeFile', 'readdir']);
const _fspp	= _do.convert(require('../___fs++'), ['mkdirs']);

module.exports = {
    'interfaces'
:
    [{'method': 'POST', 'url=': '/exportM2Ecore'}],
        'csworker'
:

    function (resp, method, uri, reqData, wcontext) {

        var actions = [__wHttpReq('GET', '/current.model?wid=' + wcontext.__aswid)];

        _do.chain(actions)(
            function (asdata) {

                //The generated file will be in the "exported_to_ecore" folder
                var writeActions = [_fspp.mkdirs('./exported_to_ecore/')];

                _do.chain(writeActions)(
                    function () {

                        //This variable will contain the lines of the generated files, i.e. the xmi code.
                        var file_contents = '';

                        //This variable represent the abstract syntax. It contains all the information.
                        var as = _utils.jsonp(asdata['data']);

                        //This variable will contain the root and all the other elements contained by the root.
                        var root = {};
                        var listRoots = [];
                        var graph = [];
                        var taken = [];
                        var listCycle = [];


                        /**
                         This function removes an element of an array.
                         **/
                        function remove(array, elem) {
                            var index = array.indexOf(elem);
                            if (index !== -1) {
                                array.splice(index, 1);
                            }
                        }


                        /**
                         This function searches if a root exists. A root is a class from which all the other
                         classes are accessible.
                         The process :
                         - find all the classes;
                         - eliminate all the classes that are the end of a link, that means they are accessible;
                         - if there are classes that form a cycle, add them all to listNodes;
                         - if listNodes contains only an element, that is the root. Else, there is no root.
                         **/
                        function hasRoot() {
                            var listNodes = [];
                            for (var key in as.nodes)
                                listNodes.push(key);
                            //removing links node
                            for (var edge = 0; edge < as.edges.length; edge = edge + 2)
                                remove(listNodes, as.edges[edge].dest);
                            //removing accessible classes
                            for (var edge = 0; edge < as.edges.length; edge = edge + 2) {
                                if (as.edges[edge].src != as.edges[edge + 1].dest)
                                    remove(listNodes, as.edges[edge + 1].dest);
                            }
                            //if there are graph cycles, add the nodes in listNodes
                            constructGraph();
                            for (var edge = 0; edge < as.edges.length; edge = edge + 2) {
                                var id = as.edges[edge].src;
                                var cycle = detectCycle(id, id);
                                if (cycle && !inside(listNodes, id)) {
                                    listNodes.push(id);
                                    listCycle.push(id);
                                }
                            }
                            return listNodes;
                        }


                        /**
                         This function returns the root. If none was found, it will create one.
                         **/
                        function setRoot() {
                            listRoots = hasRoot();
                            if (listRoots.length == 1)
                                root = createNode(listRoots[0]);
                            else
                                root = createRootClass(listRoots);
                        }


                        /**
                         This function creates a root and assigns all the possible roots as references.
                         **/
                        function createRootClass(list) {
                            var node = {};
                            node.name = reqData['name'] + 'Root';
                            var contain = [];
                            for (var i = 0; i < list.length; i++)
                                contain.push(createNode(list[i]));
                            node.contain = contain;
                            return node;
                        }


                        /**
                         This function change all the linkType property of each reference of
                         the node to containment. The node is the root or a possible one.
                         **/
                        function createNode(identifier) {
                            var node = {};
                            var elem = as.nodes[identifier];
                            var linkType = findType(identifier);
                            if (inside(listRoots, identifier))
                                node.linkType = linkType + 'Link';
                            else
                                node.linkType = linkType;
                            node.id = identifier;
                            var keys = Object.keys(elem);
                            remove(keys, "$type");
                            var attr = [];
                            for (var i = 0; i < keys.length; i++)
                                attr.push(findAttribute(keys[i], identifier));
                            node.attributes = attr;
                            node.contain = findContained(identifier);
                            return node;
                        }


                        /**
                         This function creates the appropriate indentation.
                         **/
                        function space(deep) {
                            var space = '';
                            for (var i = 0; i < deep; i++)
                                space += ' ';
                            return space;
                        }


                        /**
                         This function finds the link's type of the attribute given the link's identifier.
                         Input : identifier
                         Output : type
                         **/
                        function findType(linkIdentifier) {
                            var midType = as.nodes[linkIdentifier]["$type"].split("/");
                            var attrType = midType[midType.length - 1];
                            return attrType;
                        }


                        /**
                         This function finds all the attributes of an element.
                         **/
                        function findAttribute(key, keyDest) {
                            var attr = {};
                            attr.name = key;
                            attr.value = as.nodes[keyDest][key].value;
                            var attrType = as.nodes[keyDest][key].type;
                            if (attr.value.length > 0) {
                                if (attrType.startsWith("list"))
                                    attr.list = true;
                                else
                                    attr.list = false;
                            }
                            return attr;
                        }


                        /**
                         This function finds all the elements contained in another one, in a recursive way.
                         **/
                        function findContained(nodeKey) {
                            var listContained = [];
                            if (inside(listCycle, nodeKey) && inside(taken, nodeKey))
                                return [];
                            for (var k = 0; k < as.edges.length; k++) {
                                if (nodeKey == as.edges[k].src) {
                                    if (inside(listCycle, nodeKey))
                                        taken.push(nodeKey);
                                    var lien = as.edges[k].dest;
                                    var keyDest = as.edges[k + 1].dest;
                                    var linkType = findType(lien);
                                    var elem = {};
                                    elem.linkType = linkType;
                                    elem.attributes = [];
                                    var keys = Object.keys(as.nodes[keyDest]);
                                    remove(keys, "$type");
                                    for (var i = 0; i < keys.length; i++) {
                                        var attr = findAttribute(keys[i], keyDest);
                                        if (attr.value.length > 0)
                                            elem.attributes.push(attr);
                                    }
                                    var contain = [];
                                    if (!isInRoot(keyDest))
                                        contain = findContained(keyDest);
                                    elem.contain = contain;
                                    listContained.push(elem);
                                }
                            }
                            return listContained;
                        }


                        /**
                         This function returns true if the node, specified by its identifier,
                         is directly in root.contain, not in one of the subnode.
                         **/
                        function isInRoot(key) {
                            for (var i = 0; i < listCycle.length; i++) {
                                if (listCycle[i] == key)
                                    return true;
                            }
                            return false;
                        }


                        /**
                         This function will write the header of the file including the
                         name of the root and the URI of the metamodel.
                         This header is generated when the user doesn't want a dynamic instance.
                         **/
                        function writeHeaderStatic() {
                            var head = '<?xml version="1.0" encoding="UTF-8"?> \n';
                            head += '<' + root.name;
                            head += ' xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns="' + reqData['uri'] + '"';
                            if (root.attributes != null)
                                head += writeAttributes(root, 0);
                            else
                                head += '> \n';
                            return head;
                        }


                        /**
            								This function will write the header of the file including the
            								name of the root and the URI of the metamodel.
            								This header is generated when the user want a dynamic instance.
          							**/
          							function writeHeaderDynamic(){
          								var head = '<?xml version="1.0" encoding="UTF-8"?> \n';
          								head += '<' + reqData['name'] + ':' + root.name;
          								head += ' xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
          								head += 'xmlns:' + reqData['name'] + '="' + reqData['uri'] + '" xsi:schemaLocation="' + reqData['uri'] + ' ' + reqData['nameMM'] + '.ecore"';
          								if(root.attributes != null)
          									head += writeAttributes(root, 0);
          								else
          									head += '> \n';
          								return head;
          							}


                        /**
                         This function writes the attributes of an element.
                         **/
                        function writeAttributes(node, deep) {
                            var attribut = '';
                            var listAttr = '';
                            for (var i = 0; i < node.attributes.length; i++) {
                                var attr = node.attributes[i];
                                if (attr.list)
                                    listAttr += writeListAttribute(attr.value, attr.name, deep + 2);
                                else
                                    attribut += ' ' + attr.name + '="' + attr.value + '"';
                            }
                            attribut += '> \n' + listAttr;
                            return attribut;
                        }


                        /**
                         This function writes a list attribute.
                         **/
                        function writeListAttribute(list, name, deep) {
                            var liste = '';
                            for (var i = 0; i < list.length; i++)
                                liste += space(deep) + '<' + name + '>' + list[i] + '</' + name + '> \n';
                            return liste;
                        }


                        /**
                         This function writes all the contained nodes of the specified node
                         **/
                        function writeContained(listContained, deep) {
                            var contained = '';
                            for (var i = 0; i < listContained.length; i++) {
                                contained += space(deep + 2) + '<' + listContained[i].linkType;
                                var attributes = '';
                                // if (listContained[i].attributes != null) {
                                // }
                                contained += writeAttributes(listContained[i], deep + 2);
                                if (listContained[i].contain.length > 0)
                                    contained += writeContained(listContained[i].contain, deep + 2);
                                contained += space(deep + 2) + '</' + listContained[i].linkType + '> \n';
                            }
                            return contained;
                        }


                        /**
                         This function will write everything (classes, attributes, references, enumerations)
                         in a string.
                         **/
                        function writeFile() {
                            if(reqData['type'] == 'Dynamic instance')
                              file_contents += writeHeaderDynamic();
                            else
                              file_contents += writeHeaderStatic();
                            file_contents += writeContained(root.contain, 0);
                            file_contents += '</' + root.name + '>';
                        }


                        /**
                         This function returns true if the element is in the array.
                         **/
                        function inside(array, elem) {
                            for (var i = 0; i < array.length; i++) {
                                if (array[i] == elem)
                                    return true;
                            }
                            return false;
                        }


                        /**
                         This function populates graph. It takes all the classes
                         and register them in graph. graph is a list.
                         **/
                        function constructGraph() {
                            var list = [];
                            for (var i = 0; i < as.edges.length; i += 2) {
                                var src = as.edges[i].src;
                                if (!inside(list, src)) {
                                    list.push(src);
                                    var srcNode = {};
                                    srcNode.id = src;
                                    var linked = findLinked(src);
                                    srcNode.linked = linked;
                                    graph.push(srcNode);
                                }
                            }
                        }


                        /**
                         This function detects graph cycle.
                         Input :
                         - id : the identifier of the actual node;
                         - initial : the identifier of the first node of the cycle.
                         Output :
                         - true : there is a graph cycle;
                         - false : no graph cycle.
                         **/
                        function detectCycle(id, initial) {
                            for (var i = 0; i < graph.length; i++) {
                                if (graph[i].id == id) {
                                    if (inside(graph[i].linked, initial))
                                        return true;
                                    else {
                                        for (var j = 0; j < graph[i].linked.length; j++)
                                            return detectCycle(graph[i].linked[j], initial);
                                    }
                                    return false;
                                }
                            }
                        }


                        /**
                         This function finds all the related class of a class.
                         **/
                        function findLinked(src) {
                            var listLinked = [];
                            for (var i = 0; i < as.edges.length; i += 2) {
                                if (as.edges[i].src == src && as.edges[i + 1].dest != src) {
                                    listLinked.push(as.edges[i + 1].dest);
                                }
                            }
                            return listLinked;
                        }


                        /***************************************************************************************************************************************************************
                         The following is like the main class of this file. It will call the appropriate functions
                         in order to create the export file.
                         ****************************************************************************************************************************************************************/
                        setRoot();
                        writeFile();


                        _fs.writeFileSync('./exported_to_ecore/' + reqData['name'] + 'Model.xmi', file_contents);
                        __postMessage({
                            'statusCode': 200,
                            'respIndex': resp
                        });

                    },
                    function (writeErr) {
                        __postInternalErrorMsg(resp, writeErr);
                    }
                );
            },
            function (err) {
                __postInternalErrorMsg(resp, err);
            }
        );
    }

,
    'asworker'
:

    function (resp, method, uri, reqData, wcontext) {
        __postMessage(
            {
                'statusCode': 200,
                'respIndex': resp
            });
    }
};
