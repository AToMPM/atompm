/*
 * This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
 * Copyright 2011 by the AToMPM team and licensed under the LGPL
 * See COPYING.lesser and README.md in the root of this project for full details
 */


const _utils = require("./utils");
const _styleinfo = require("./styleinfo");
const _mt = require("./libmt");

/**************************** MODEL COMPILATION ****************************/
module.exports = {

    /* compile the current model and the given CS model into an icon definition
        metamodel

        0. the entire function body is wrapped in a try/catch... this is our lazy
              approach to verifying that the current model is indeed a valid model of
              an icon definition metamodel
        1. if the current model is missing the CS formalism, return error
        2. extract information about types from current model
            a) find all ConcreteSyntax/Icons and ConcreteSyntax/Links
            b) map all CS/Icons to their IconIcon in the CS model (argument)
            c) map all CS/Icons to the nodes they're [transitively] connected to
                (except their IconContents links)
            d)	save all edges between contained nodes from step c)
            e) enhance every contained node (from step c)) with information about
                its associated IconIcon (e.g., position, orientation)... this is
                needed so that the final '$contents' attributes of each generated
                *Icon hold sufficient information to render icons as the user
                specified them... note that position attributes are adjusted to make
                them relative to the containing IconIcon's top-left corner
            e*) enhance nodes contained within Links with link decorator
                 positioning information (e.g., xratio, yoffset)
            f) when pre-defined arrowheads/tails have been selected by the user,
                pretend the user has actually drawn them s.t. they get handled by
                link decorator positioning code during modelling... in practice:
                    i.   identify pre-defined arrowheads/tails
                    ii.  locate corresponding drawings within relevant Link's
                          LinkIcon $contents
                    iii. copy them into relevant Link's compiled $contents
                    iv.  enhance them with link decorator information (c.f., step e*)
        3. construct mm.types based on information from step 2... the resulting
            mm.types wil look very much like ConcreteSyntax.types, with a few added
            'special' attributes (e.g., $asuri, $contents, etc.)
        4. check whether all non-abstract types have an icon, and no abstract types have an icon
        5. return mm stringified (ensures no references to objects in this.model
            are returned) */
    'compileToIconDefinitionMetamodel':
        function (model, metamodels, csm, asmm) {
            let CS = '/Formalisms/__LanguageSyntax__/ConcreteSyntax/ConcreteSyntax';

            try {
                /* 1 */
                if (!_utils.contains(model.metamodels, CS))
                    throw 'icon definition models must have the ' + CS + ' formalism loaded';

                let nodes = {};
                for (let id in model.nodes) {
                    if (model.nodes[id]['$type'].slice(0, CS.length) == CS) {
                        nodes[id] = model.nodes[id];
                    }
                }
                model.nodes = nodes;

                /* 2 */
                let mm =
                    {
                        'types': {},
                        'constraints': [],
                        'actions': [],
                        'cardinalities': {},
                        'legalConnections': {},
                        'connectorTypes': {},
                        'types2parentTypes': {}
                    };
                let iids = [];
                let iids2contents = {};
                let ids2csids = {};
                let outNeighbors =
                    /* returns the given node's outbound neighbors */
                    function (source) {
                        return model.edges.filter(function (edge) {
                            return edge['src'] == source && model.nodes[edge['dest']] != undefined;
                        }).map(function (edge) {
                            return edge['dest'];
                        });
                    };
                let getConnectedNodes =
                    /* compute the [transitive] contents of 'container'... this
                        function is a bit of an oversimplification: it makes the
                        reasonable but not necessarily correct assumption that
                        anything that is [transitively] connected to a CS/Icon or
                        CS/Link is inside it */
                    function (container, contents) {
                        let _contents = {};
                        outNeighbors(container).forEach(
                            function (n) {
                                if (!(n in contents))
                                    _contents[n] = 1;
                            });

                        if (_utils.keys(_contents).length == 0)
                            return contents;

                        contents = _utils.mergeDicts([contents, _contents]);
                        return _utils.mergeDicts(
                            _utils.keys(_contents).map(
                                function (_c) {
                                    return getConnectedNodes(_c, contents);
                                }));
                    };

                /* 2a */
                for (let id in model.nodes)
                    if (model.nodes[id]['$type'] == CS + '/Icon' ||
                        model.nodes[id]['$type'] == CS + '/Link') {
                        iids.push(id);
                        iids2contents[id] = {'nodes': {}, 'edges': []};
                    }

                /* 2b */
                csm = _utils.jsonp(csm);
                for (let csid in csm.nodes) {
                    let id = csm.nodes[csid]['$asuri']['value'].match(/.*\/(.*)\.instance$/)[1];
                    ids2csids[id] = csid;
                }

                iids.forEach(
                    function (iid) {
                        /* 2c */
                        _utils.keys(getConnectedNodes(iid, {})).filter(
                            function (id) {
                                return model.nodes[id]['$type'] != CS + '/IconContents';
                            }).forEach(
                            function (id) {
                                iids2contents[iid].nodes[id] = model.nodes[id];
                            });

                        /* 2d */
                        model.edges.forEach(
                            function (edge) {
                                if (iids2contents[iid].nodes[edge['src']] != undefined &&
                                    iids2contents[iid].nodes[edge['dest']] != undefined)
                                    iids2contents[iid].edges.push(edge);
                            });

                        /* 2e */
                        let iidCSIcon = csm.nodes[ids2csids[iid]];
                        for (let vid in iids2contents[iid].nodes) {
                            let vidCSIcon = csm.nodes[ids2csids[vid]];
                            let vidContentsNode = iids2contents[iid].nodes[vid];
                            ['position', 'orientation', 'scale', 'link-style'].forEach(
                                function (_) {
                                    vidContentsNode[_] = vidCSIcon[_];
                                });
                            let vidContentsNodePosition = vidContentsNode['position']['value'],
                                iidCSIconPosition = iidCSIcon['position']['value'],
                                vidContentsNodeRelX = vidContentsNodePosition[0] - iidCSIconPosition[0],
                                vidContentsNodeRelY = vidContentsNodePosition[1] - iidCSIconPosition[1];
                            vidContentsNode['position']['value'] = [vidContentsNodeRelX, vidContentsNodeRelY];

                            /* 2e* */
                            if (model.nodes[iid]['$type'] == CS + '/Link') {
                                let sx = iidCSIcon['scale']['value'][0],
                                    sy = iidCSIcon['scale']['value'][1],
                                    linkPathBBox =
                                        {
                                            'x': sx * 35,
                                            'y': sy * 77,
                                            'width': sx * 198,
                                            'height': sy * (model.nodes[iid]['link-style']['stroke-width'] || 1)
                                        };

                                vidContentsNode['position']['value'] = [0, 0];
                                vidContentsNode['$linkDecoratorInfo'] =
                                    {
                                        'type': 'map<string,double>',
                                        'value':
                                            {
                                                'xratio': (vidContentsNodeRelX - linkPathBBox.x) / (linkPathBBox.width - linkPathBBox.x),
                                                'yoffset': vidContentsNodeRelY - (linkPathBBox.y + linkPathBBox.height / 2)
                                            }
                                    };
                            }
                        }

                        /* 2f */
                        if (model.nodes[iid]['$type'] == CS + '/Link') {
                            let contents = csm.nodes[ids2csids[iid]]['$contents']['value'].nodes,
                                sy = iidCSIcon['scale']['value'][1];
                            ['arrowHead', 'arrowTail'].forEach(
                                function (at) {
                                    if (!(at in model.nodes[iid]))
                                        throw 'migrate to new Link specification means to compile';

                                    let a = model.nodes[iid][at]['value'];
                                    if (a != 'custom')
                                        for (let vid in contents)
                                            if ('mapper' in contents[vid] &&
                                                (_styleinfo[a + ':' + at]) && (matches = contents[vid]['mapper']['value'].match("^'" + a + ":" + at + ":(.*)';"))) {
                                                iids2contents[iid].nodes[vid] = contents[vid];
                                                iids2contents[iid].nodes[vid]['mapper']['value'] = '';
                                                iids2contents[iid].nodes[vid]['position']['value'] = [0, 0];
                                                iids2contents[iid].nodes[vid]['$linkDecoratorInfo'] =
                                                    {
                                                        'type': 'map<string,double>',
                                                        'value':
                                                            {
                                                                'xratio': (at == 'arrowHead' ? -1 : 1),
                                                                'yoffset': -_styleinfo[a + ':' + at] / 2 * sy
                                                            }
                                                    };
                                                break;
                                            }
                                });
                        }


                        /* 3 */
                        let node = model.nodes[iid];
                        let type = node['typename']['value'];
                        let isConnectorType = 'link-style' in node;
                        mm.types[type] = [];

                        metamodels[CS].types[(isConnectorType ? 'Link' : 'Icon')].forEach(
                            function (attr) {
                                if (_utils.contains(['link-style', 'typename', 'mapper', 'parser', 'position'], attr['name']))
                                    mm.types[type].push(
                                        {
                                            'name': attr['name'],
                                            'type': node[attr['name']]['type'],
                                            'default': node[attr['name']]['value']
                                        });
                                else
                                    mm.types[type].push(attr);
                            });
                        mm.types[type].push(
                            {
                                'name': '$contents',
                                'type': 'map<string,*>',
                                'default': iids2contents[iid]
                            },
                            {
                                'name': '$asuri',
                                'type': 'string',
                                'default': '-1'
                            });
                        if (isConnectorType)
                            mm.types[type].push(
                                {
                                    'name': '$segments',
                                    'type': 'map<string,list<string>>',
                                    'default': {}
                                });


                        mm.cardinalities[type] = [];
                        mm.types2parentTypes[type] = [];
                    });

                /* 4 */
                let abstractTypes = [];

                for (let idx in asmm["constraints"]) {
                    let curr_constraint = asmm["constraints"][idx];
                    if (curr_constraint["name"] == "noAbstractInstances") {
                        abstractTypes.push(curr_constraint["targetType"]);
                    }
                }

                for (let curr_type in asmm["types"]) {
                    if ((curr_type + 'Link' in mm["types"]) || (curr_type + 'Icon' in mm["types"])) {
                        if (abstractTypes.indexOf(curr_type) >= 0) {
                            return {'$err': 'abstract type ' + curr_type + ' cannot have a visual representation'};
                        }
                    } else {
                        if (abstractTypes.indexOf(curr_type) < 0) {
                            return {'$err': 'concrete type ' + curr_type + ' needs to have a visual representation'};
                        }
                    }
                }

                for (let curr_type in mm["types"]) {
                    if (!(curr_type.slice(0, -4) in asmm["types"])) {
                        return {'$err': 'type ' + curr_type.slice(0, -4) + ' not found in the abstract syntax metamodel, visual representation ' + curr_type + ' invalid'};
                    }
                }

                /* 5 */
                return _utils.jsons(mm, null, "\t");
            } catch (err) {
                return {'$err': 'invalid metamodel model, crashed on :: ' + err};
            }
        },

    /* compile the current model into a metamodel

        0. the entire function body is wrapped in a try/catch... this is our lazy
              approach to verifying that the current model is indeed a valid model of
              a metamodel
        1. if the current model is not an ER or a SCD model, return error
        2. if the current model is a SCD model, transform it into an ER model
            before beginning compilation (via _mt.transform)
        3. copy information about types, constraints, actions, cardinalities,
            connectorTypes and types2parentTypes from current model to mm
        4. add any missing cardinalities (relationships between entities define
            legal connections but the user might have omitted to specify their
            cardinalities), then construct legalConnections and store it in mm
        5. return mm stringified (ensures no references to objects in this.model
            are returned) */
    'compileToMetamodel':
        function (model) {
            let ER = '/Formalisms/__LanguageSyntax__/EntityRelationship/EntityRelationship';
            let SCD = '/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram';
            let isolateMMModel =
                /* remove all non-ER/SCD entities from the provided model...
                    doing so considerably eases compilation */
                function (m) {
                    for (let id in m.nodes)
                        if (!m.nodes[id]['$type'].match('^' + ER) &&
                            !m.nodes[id]['$type'].match('^' + SCD))
                            delete m.nodes[id];
                    let keepEdges = [];
                    m.edges.forEach(
                        function (edge, i) {
                            if (edge['src'] in m.nodes && edge['dest'] in m.nodes)
                                keepEdges.push(edge);
                        });
                    m.edges = keepEdges;
                    return m;
                };
            try {
                /* 1-2 */
                if (_utils.contains(model.metamodels, ER) &&
                    _utils.contains(model.metamodels, SCD))
                    throw 'metamodel models should not have more than one loaded metametamodel';


                if (_utils.contains(model.metamodels, ER))
                    model = isolateMMModel(model);
                else if (_utils.contains(model.metamodels, SCD))
                    model = _mt.transform(
                        _utils.jsons(isolateMMModel(model)),
                        'SimpleClassDiagram-2-EntityRelationship');
                else
                    throw 'metamodel models should have at least one loaded metametamodel';

                /* 3 */
                let mm =
                    {
                        'types': {},
                        'constraints': [],
                        'actions': [],
                        'cardinalities': {},
                        'legalConnections': {},
                        'connectorTypes': {},
                        'types2parentTypes': {}
                    };
                for (let id in model.nodes) {
                    let node = model.nodes[id];
                    if (node['$type'] == ER + '/Entity' ||
                        node['$type'] == ER + '/Relationship') {
                        let type = node['name']['value'];

                        mm.types[type] = [];

                        node['attributes']['value'].forEach(
                            function (attr) {
                                mm.types[type].push(attr);
                            });

                        node['constraints']['value'].forEach(
                            function (constraint) {
                                constraint['targetType'] = type;
                                mm.constraints.push(constraint);
                            });

                        node['actions']['value'].forEach(
                            function (action) {
                                action['targetType'] = type;
                                mm.actions.push(action);
                            });

                        mm.cardinalities[type] = node['cardinalities']['value'];

                        if (node['linktype'] != undefined)
                            mm.connectorTypes[type] = node['linktype']['value'];
                    } else if (node['$type'] == ER + '/GlobalConstraint')
                        mm.constraints.push(
                            {
                                'name': node['name']['value'],
                                'event': node['event']['value'],
                                'targetType': '*',
                                'code': node['code']['value']
                            });

                    else if (node['$type'] == ER + '/GlobalAction')
                        mm.actions.push(
                            {
                                'name': node['name']['value'],
                                'event': node['event']['value'],
                                'targetType': '*',
                                'code': node['code']['value']
                            });

                    else
                        throw 'node "' + id + '" does not conform to the ' + ER + ' metamodel';
                }
                mm.types2parentTypes = model.types2parentTypes || {};

                /* 4 */
                let types2legalNeighborTypes = {},
                    addMissingCardinalities =
                        function (t1, t2, dir) {
                            /* if there is no cardinality between t1 and t2 for dir, add a default cardinality...
                                   1:1 			for links
                                   0:Infinity 	for nodes */
                            if (!mm.cardinalities[t1].some(function (c) {
                                return c['type'] == t2 && c['dir'] == dir;
                            })) {
                                if (mm.connectorTypes[t1])
                                    mm.cardinalities[t1].push(
                                        {
                                            'dir': dir,
                                            'type': t2,
                                            'min': '0',
                                            'max': '1'
                                        });
                                else
                                    mm.cardinalities[t1].push(
                                        {
                                            'dir': dir,
                                            'type': t2,
                                            'min': '0',
                                            'max': 'Infinity'
                                        });
                            }
                        };
                model.edges.forEach(
                    function (edge) {
                        let srcType = model.nodes[edge['src']]['name']['value'];
                        let destType = model.nodes[edge['dest']]['name']['value'];
                        addMissingCardinalities(srcType, destType, 'out', mm.connectorTypes[srcType]);
                        addMissingCardinalities(destType, srcType, 'in', mm.connectorTypes[destType]);
                    });
                for (let type in mm.types) {
                    if (types2legalNeighborTypes[type] == undefined)
                        types2legalNeighborTypes[type] = [];

                    mm.cardinalities[type].forEach(
                        function (cardinality) {
                            if (cardinality['dir'] == 'out')
                                types2legalNeighborTypes[type].push(cardinality['type']);
                        });
                }
                for (let type in types2legalNeighborTypes) {
                    if (mm.connectorTypes[type] != undefined)
                        continue;

                    types2legalNeighborTypes[type].forEach(
                        function (ntype) {
                            if (types2legalNeighborTypes[ntype] == undefined) {
                                throw "Error! Problem with edges for class: " + type + "\nFound constraints: " + JSON.stringify(types2legalNeighborTypes[type]);
                            }

                            types2legalNeighborTypes[ntype].forEach(
                                function (nntype) {
                                    if (mm.legalConnections[type] == undefined)
                                        mm.legalConnections[type] = {};
                                    if (mm.legalConnections[type][nntype] == undefined)
                                        mm.legalConnections[type][nntype] = [];
                                    mm.legalConnections[type][nntype].push(ntype);
                                });
                        });
                }

                /* 5 */
                return _utils.jsons(mm, null, "\t");
            } catch (err) {
                return {'$err': 'invalid metamodel model, crashed on :: ' + err};
            }
        },
}