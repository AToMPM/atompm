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
    [{'method': 'POST', 'url=': '/exportMM2Ecore'}],
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

                        //This variable will contain the lines of the generated files, i.e. the xml code.
                        var file_contents = '';

                        //This variable will contain the identifier of the root.
                        var rootNode = null;

                        //This variable represent the abstract syntax. It contains all the information.
                        var as = _utils.jsonp(asdata['data']);

                        //This variable will contain a list of possible roots
                        var listRoots = [];

                        //This variable will contain all the classes to be created
                        var listClasses = [];

                        //This variable will contain all the enumerations to be created
                        var listEnums = [];


                        /**
                         We create the package that will contain all the classes. The name of the package
                         is the name of the metamodel, aside of the MM, if apply.
                         The URI of the metamodel is asked to the user.
                         **/
                        var packageName = reqData['name'];
                        var nsURI = reqData['uri'];
                        if (reqData['name'].endsWith("MM"))
                            packageName = packageName.substr(0, packageName.length - 2);


                        /**
                         This object maps how the type is written. For example, in AToMPM it's "string",
                         while in Ecore it's "EString"
                         **/
                        var dataType = {
                            'string': 'EString',
                            'int': 'EInt',
                            'float': 'EFloat',
                            'boolean': 'EBoolean',
                            'code': 'EString'
                        };


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
                         This function will search if the class, specified by its identifier (nodeIdentifier), is a
                         subclass of another one, i.e. if it inherits from another class.
                         It will return the name of the superclass, if it exists.
                         If the class has multiple inheritance, it will return the last one that was found since ecore
                         doesn't allow multiple inheritance.
                         **/
                        function findSuperClass(nodeIdentifier) {
                            var superclassName = null;
                            var superclassKey = null;
                            for (var edge in as.edges) {
                                if (as.edges[edge].src == nodeIdentifier) {
                                    var linkKey = as.edges[edge].dest;
                                    if (isInheritanceLink(linkKey))
                                        superclassKey = linkDestination(linkKey);
                                }
                            }
                            if (superclassKey != null)
                                superclassName = as.nodes[superclassKey].name.value;
                            return superclassName;
                        }


                        /**
                         This function will return the identifier of the destination of a link,
                         specified by its identifier.
                         **/
                        function linkDestination(linkIdentifier) {
                            var cleDest = null;
                            for (var dest in as.edges) {
                                if (as.edges[dest].src == linkIdentifier)
                                    cleDest = as.edges[dest].dest;
                            }
                            return cleDest;
                        }


                        /**
                         This function will return true if the class is an inheritance link.
                         It will return false otherwise.
                         **/
                        function isInheritanceLink(nodeIdentifier) {
                            return as.nodes[nodeIdentifier]["$type"].endsWith("Inheritance");
                        }


                        /**
                         This function will return true if the class is an association link.
                         It will return false otherwise.
                         **/
                        function isAssociationLink(nodeIdentifier) {
                            return as.nodes[nodeIdentifier]["$type"].endsWith("Association");
                        }


                        /**
                         This function will return true if the class is an actual class.
                         It will return false otherwise.
                         **/
                        function isClass(nodeIdentifier) {
                            return as.nodes[nodeIdentifier]["$type"].endsWith("Class");
                        }


                        /**
                         This function searches if a root exists. A root is a class from which all the other
                         classes are accessible.
                         The process :
                         - find all the classes;
                         - eliminate all the classes that are the end of a link, that means they are accessible;
                         - if listNodes contains only an element, that is the root. Else, there is no root.
                         **/
                        function hasRoot() {
                            var listNodes = [];
                            for (var key in as.nodes) {
                                if (isClass(key))
                                    listNodes.push(key);
                            }
                            for (var i = 0; i < as.edges.length; i += 2) {
                                if (as.edges[i].src != as.edges[i + 1].dest)
                                    remove(listNodes, as.edges[i].src);
                            }
                            return listNodes;
                        }


                        /**
                         This function returns the root. If none was found, it will create one.
                         **/
                        function setRoot() {
                            listRoots = hasRoot();
                            if (listRoots.length == 1) {
                                rootNode = listRoots[0];
                                reformRootClass(rootNode);
                            }
                            else
                                createRootClass();
                        }


                        /**
                         This function creates a root and assigns all the possible roots as references.
                         **/
                        function createRootClass() {
                            var root = {};
                            root.name = packageName + 'Root';
                            var refers = [];
                            for (var i = 0; i < listRoots.length; i++) {
                                reformRootClass(listRoots[i]);
                                var refType = as.nodes[listRoots[i]].name.value;
                                var refName = refType + 'Link';
                                var ref = createEReference(refName, "containment", refType, [1, -1]);
                                refers.push(ref);
                            }
                            root.references = refers;
                            root.attributes = [];
                            listClasses.push(root);
                        }


                        /**
                         This function change all the linkType property of each reference of
                         the node to containment. The node is the root or a possible one.
                         **/
                        function reformRootClass(rootNode) {
                            var rootClass = createEClass(rootNode);
                            for (var i = 0; i < rootClass.references.length; i++)
                                rootClass.references[i].linkType = "containment";
                            listClasses.push(rootClass);
                        }


                        /**
                         This function creates an EClassifier.
                         Input: the identifier of the node
                         Output: an object with all the needed properties
                         **/
                        function createEClass(nodeIdentifier) {
                            var eClass = {};
                            var node = as.nodes[nodeIdentifier];
                            eClass.name = node.name.value;
                            eClass.abstract = node.abstract.value;
                            eClass.superclass = findSuperClass(nodeIdentifier);
                            eClass.references = findReferences(nodeIdentifier);
                            eClass.attributes = findAttributes(eClass, nodeIdentifier);
                            return eClass;
                        }


                        /**
                         This function creates an EReference.
                         Input: the name, linktype, type and bounds of the reference
                         Output: an object with all the needed properties
                         **/
                        function createEReference(name, linktype, type, bounds) {
                            var eReference = {};
                            eReference.name = name;
                            eReference.linkType = linktype; //containment or visual
                            if (bounds != null) {
                                if (bounds[0] != 0)
                                    eReference.lowerBound = bounds[0];
                                if (bounds[1] == 'inf')
                                    eReference.upperBound = -1;
                                else if (bounds[1] != 1) //else we have the value 1 by default in ecore
                                    eReference.upperBound = bounds[1];
                            }
                            eReference.type = type; //eType, type of the destination class
                            return eReference;
                        }


                        /**
                         This function create an EAttribute.
                         Input: the name, datatype, default value of the attribute and the booleans eenum, map and list
                         Output: an object with all the needed properties
                         **/
                        function createEAttribute(name, datatype, defaultValue, eenum, list, map) {
                            var eAttribute = {};
                            eAttribute.name = name;
                            eAttribute.complexType = (eenum || list || map);
                            eAttribute.list = list;
                            eAttribute.eenum = eenum;
                            eAttribute.map = map;
                            if (!eAttribute.complexType) {
                                eAttribute.dataType = dataType[datatype];
                                if (defaultValue != '')
                                    eAttribute.defaultValue = defaultValue;
                            }
                            else
                                setDataType(eAttribute, datatype, eenum, list, map, defaultValue);
                            return eAttribute;
                        }


                        /**
                         This function is to assign the datatype and related variables to an attribute, but
                         just for complex types, i.e. list or ENUM.
                         **/
                        function setDataType(eAttribute, datatype, eenum, list, map, defaultValue) {
                            if (list)
                                setListType(eAttribute, datatype);
                            else if (eenum)
                                setEnumType(eAttribute, datatype, defaultValue);
                            else if (map)
                                setMapType(eAttribute, datatype, defaultValue);
                        }


                        /**
                         This function sets the default value and matches the datatype of a list attribute.
                         The matching types are contained in the object dataType.
                         **/
                        function setListType(eAttribute, datatype) {
                            var listType = datatype.split('<')[1].split('>')[0];
                            listType = dataType[listType];
                            eAttribute.dataType = listType;
                        }


                        /**
                         This function sets the datatype (and the default value?) of an enumeration attribute.
                         **/
                        function setEnumType(eAttribute, datatype, defaultValue) {
                            var name = eAttribute.name;
                            var nameEnum = name.charAt(0).toUpperCase() + name.slice(1);
                            eAttribute.dataType = nameEnum;
                            eAttribute.defaultValue = defaultValue;
                            createEnumClass(nameEnum, datatype);
                        }


                        /**
                         This function creates an Enum class related to an enumeration attribute.
                         **/
                        function createEnumClass(nameEnum, datatype) {
                            var eEnum = {};
                            eEnum.name = nameEnum;
                            var options = datatype.split('(')[1].split(')')[0];
                            options = options.split(', ');
                            eEnum.options = options;
                            listEnums.push(eEnum);
                        }


                        /**
                         This function sets the datatype (and the default value?) of a map attribute.
                         **/
                        function setMapType(eAttribute, datatype, defaultValue) {
                            //var keys = datatype.split('[')[1].split(']')[0];
                            //keys = keys.split(',');
                            //var values = datatype.split(']')[1].split('[')[1].split(']')[0];
                            var values = datatype.split('<')[1].split('>')[0];
                            values = values.split(',');

                            //for(var i = 0; i < keys.length; i++)
                            //	createMapClass(keys[i], values[i]);
                        }


                        /**
                         This function finds all the attributes of a class.
                         Input: the class identifier
                         Output: a list of all the attributes of the class
                         **/
                        function findAttributes(classe, nodeIdentifier) {
                            var attributesList = [];
                            var node = as.nodes[nodeIdentifier].attributes['value'];
                            for (var attr in node) {
                                var name = node[attr].name;
                                var defaultValue = node[attr]['default'];
                                var datatype = node[attr].type;
                                var eenum = false;
                                var list = false;
                                var map = false;
                                if (datatype.startsWith("list"))
                                    list = true;
                                else if (datatype.startsWith("ENUM"))
                                    eenum = true;
                                else if (datatype.startsWith("map"))
                                    map = true;
                                var attribute = createEAttribute(name, datatype, defaultValue, eenum, list, map);
                                attributesList.push(attribute);
                            }
                            return attributesList;
                        }


                        /**
                         This function finds the cardinalities of a reference.
                         Input: the class identifier (nodeIdentifier) and the reference name
                         Output: a list of bounds (min and max)
                         **/
                        function findCardinalities(nodeIdentifier, referenceName) {
                            var bounds = [];
                            var cardinal = as.nodes[nodeIdentifier].cardinalities['value'];
                            for (var car in cardinal) {
                                if (cardinal[car].type == referenceName) {
                                    bounds.push(cardinal[car].min);
                                    bounds.push(cardinal[car].max);
                                }
                            }
                            return bounds;
                        }


                        /**
                         This function finds all the references of a class.
                         Input: the class identifier
                         Output: a list of all the references of the class
                         **/
                        function findReferences(nodeIdentifier) {
                            var referencesList = [];
                            for (var edge in as.edges) {
                                if (as.edges[edge].src == nodeIdentifier) {
                                    var linkKey = as.edges[edge].dest;
                                    if (isAssociationLink(linkKey)) {
                                        var name = as.nodes[linkKey].name.value;
                                        var linktype = as.nodes[linkKey].linktype['value'];
                                        if (nodeIdentifier == rootNode || inside(listRoots, nodeIdentifier))
                                            linktype = "containment";
                                        var bounds = findCardinalities(nodeIdentifier, name);
                                        var dest = linkDestination(linkKey);
                                        var type = as.nodes[dest].name.value;
                                        var reference = createEReference(name, linktype, type, bounds);
                                        referencesList.push(reference);
                                    }
                                }
                            }
                            return referencesList;
                        }


                        /**
                         This function returns what's to be written in the file in the beginning, including the
                         package's name and the URI.
                         **/
                        function writeHeader() {
                            var header = '<?xml version="1.0" encoding="UTF-8"?> \n';
                            header += '<ecore:EPackage xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \n';
                            header += '    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="' + packageName;
                            header += '" nsURI="' + nsURI + '" nsPrefix="' + packageName + '"> \n';
                            return header;
                        }


                        /**
                         This function returns what's to be written in the file in the case of an EClass.
                         **/
                        function writeEClassifier(classe) {
                            var classLine = '  <eClassifiers xsi:type="ecore:EClass" name="' + classe.name;
                            if (classe.abstract)
                                classLine += '" abstract="true';
                            if (classe.superclass != null)
                                classLine += '" eSuperTypes="#//' + classe.superclass;
                            if (classe.attributes.length > 0 || classe.references.length > 0) {
                                classLine += '"> \n';
                                for (var i = 0; i < classe.attributes.length; i++)
                                    classLine += writeEAttribute(classe.attributes[i]);
                                for (var i = 0; i < classe.references.length; i++)
                                    classLine += writeEReference(classe.references[i]);
                                classLine += '  </eClassifiers> \n';
                            }
                            else
                                classLine += '"/> \n';
                            return classLine;
                        }


                        /**
                         This function returns what's to be written in the file in the case of an EAttribute.
                         **/
                        function writeEAttribute(attr) {
                            var attrLine = '    <eStructuralFeatures xsi:type="ecore:EAttribute" name="' + attr.name;
                            if (attr.map)
                                attrLine += writeMapAttribute(attr);
                            else {
                                if (attr.list)
                                    attrLine += '" upperBound="-1';
                                if (attr.list || !(attr.complexType))
                                    attrLine += '" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//' + attr.dataType;
                                if (attr.eenum)
                                    attrLine += '" eType="#//' + attr.dataType;
                                if (attr.defaultValue != null)
                                    attrLine += '" defaultValueLiteral="' + attr.defaultValue;
                                attrLine += '"/> \n';
                            }
                            return attrLine;
                        }


                        /**
                         This function returns what's to be written in a Map attribute.
                         **/
                        function writeMapAttribute(attr) {
                            var mapAttr = '';
                            mapAttr += '" upperBound="-1" transient="true"> \n';
                            mapAttr += writeEGenericType("EMap");
                            mapAttr += '    </eStructuralFeatures> \n';
                            return mapAttr;
                        }


                        /**
                         This function returns what's to be written in a GenericType.
                         **/
                        function writeEGenericType(datatype) {
                            var gentype = '        <eGenericType eClassifier="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//';
                            gentype += datatype + '"> \n';
                            gentype += writeETypeArguments(["EEList", "EString"]);
                            gentype += writeETypeArguments(["EEList", "EDataType"]);
                            gentype += '        </eGenericType> \n';
                            return gentype;
                        }


                        /**
                         This function returns what's to be written in a ETypeArguments.
                         **/
                        function writeETypeArguments(types) {
                            var typeArg = '            <eTypeArguments eClassifier="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//';
                            typeArg += types[0] + '"> \n';
                            typeArg += writeSingleETypeArguments(types[1]);
                            typeArg += '            </eTypeArguments> \n';
                            return typeArg;
                        }


                        /**
                         This function returns what's to be written in a ETypeArguments.
                         **/
                        function writeSingleETypeArguments(type) {
                            var singleTypeArg = '                <eTypeArguments eClassifier="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//';
                            singleTypeArg += type + '"/> \n';
                            return singleTypeArg;
                        }


                        /**
                         This function returns what's to be written in the file in the case of an EReference.
                         **/
                        function writeEReference(ref) {
                            var refLine = '    <eStructuralFeatures xsi:type="ecore:EReference" name="' + ref.name;
                            if (ref.lowerBound != null)
                                refLine += '" lowerBound="' + ref.lowerBound;
                            if (ref.upperBound != null)
                                refLine += '" upperBound="' + ref.upperBound;
                            refLine += '" eType="#//' + ref.type;
                            if (ref.linkType == "containment")
                                refLine += '" containment="true';
                            refLine += '"/> \n';
                            return refLine;
                        }


                        /**
                         This function returns what's to be written in the file in the case of an EEnum.
                         **/
                        function writeEEnum(enume) {
                            var enumLine = '  <eClassifiers xsi:type="ecore:EEnum" name="' + enume.name + '"> \n';
                            for (var i = 0; i < enume.options.length; i++)
                                enumLine += '    <eLiterals name="' + enume.options[i] + '"/> \n';
                            enumLine += '  </eClassifiers> \n';
                            return enumLine;
                        }


                        /**
                         This function creates the classes then put them in the variable listClasses.
                         **/
                        function populateListClasses() {
                            for (var node in as.nodes) {
                                if (!(inside(listRoots, node)) && isClass(node)) {
                                    var eclass = createEClass(node);
                                    listClasses.push(eclass);
                                }
                            }
                        }


                        /**
                         This function will write everything (classes, attributes, references, enumerations)
                         in a string.
                         **/
                        function writeFile() {
                            file_contents += writeHeader();
                            for (var i = 0; i < listClasses.length; i++)
                                file_contents += writeEClassifier(listClasses[i]);
                            for (var i = 0; i < listEnums.length; i++)
                                file_contents += writeEEnum(listEnums[i]);
                            file_contents += '</ecore:EPackage>';
                        }


                        /****************************************************************************************************************************************************************
                         The following is like the main class of this file. It will call the appropriate functions
                         in order to create the export file.
                         ****************************************************************************************************************************************************************/
                        //creation of root and, if apply, possible roots
                        setRoot();
                        //creation of classes, including their attributes and references
                        populateListClasses();
                        //write the file
                        writeFile();


                        _fs.writeFileSync('./exported_to_ecore/' + packageName + 'Metamodel.ecore', file_contents);
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
