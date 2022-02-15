/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

/* NOTES:
		atom3 supported pre/post actions and constraints for the 'SAVE' EVENT...
		this never really made any sense (e.g., the user could be prevented from
		saving and, technically, the effects of post-actions were never saved)...
		atom3 supported 'save' events as a hack to enable forcing mm validation...
		in atompm, such validation is carried out by _mmmk.validateModel (which
		clients can 'call') and thus, we do no support 'save' events... */

const _utils = require('./utils');
const _util = require("util");

module.exports = {
    /********************************* GLOBALS *********************************/
    'metamodels': {},
    'model': {'nodes': {}, 'edges': [], 'metamodels': []},
    'name': '',
    'next_id': 0,


    /********************************* ENV SETUP *******************************/
    /* produce a bundle of internal state variables sufficient to fully clone
        this instance
            OR
        use a provided bundle to overwrite this instance's internal state */
    'clone':
        function (clone) {
            if (clone) {
                this.metamodels = clone.metamodels;
                this.model = clone.model;
                this.name = clone.name;
                this.next_id = clone.next_id;
                this.journal = clone.journal;
                this.journalIndex = clone.journalIndex;
                this.undoredoJournal = clone.undoredoJournal;
            } else
                return _utils.clone(
                    {
                        'metamodels': this.metamodels,
                        'model': this.model,
                        'name': this.name,
                        'next_id': this.next_id,
                        'journal': this.journal,
                        'journalIndex': this.journalIndex,
                        'undoredoJournal': this.undoredoJournal
                    });
        },


    /* load a model into this.model

        0. create step-checkpoint
        1. make sure all required metamodels are loaded
        2. if 'insert' is specified,
            a) append 'model' to this.model (via __resetm__)
        2. otherwise, load 'model' into this.model and 'name' into this.name
            (via __resetm__) */
    'loadModel':
        function (name, model, insert) {
            this.__setStepCheckpoint();

            let new_model = eval('(' + model + ')');
            for (let i in new_model.metamodels)
                if (this.metamodels[new_model.metamodels[i]] == undefined)
                    return {'$err': 'metamodel not loaded :: ' + new_model.metamodels[i]};

            this.__resetm__(name, model, insert);
            return {'changelog': this.__changelog()};
        },


    /* load a metamodel

        0. create a step-checkpoint
        1. load metamodel into this.model.metamodels and this.metamodels (via
            __loadmm__) */
    'loadMetamodel':
        function (name, mm) {
            this.__setStepCheckpoint();

            this.__loadmm__(name, mm);
            return {'changelog': this.__changelog()};
        },


    /* unload a metamodel and delete all entities from that metamodel

        0. create a step-checkpoint
        1. deletes nodes from specified metamodel
        2. delete edges where deleted nodes appear
        3. remove metamodel from this.model.metamodels and this.metamodels
            (via __dumpmm__) */
    'unloadMetamodel':
        function (name) {
            this.__setStepCheckpoint();

            for (let i = 0; i < this.model.edges.length; i++) {
                let edge = this.model.edges[i];
                if (this.__getMetamodel(this.model.nodes[edge['src']]['$type']) == name ||
                    this.__getMetamodel(this.model.nodes[edge['dest']]['$type']) == name)
                    this.__rmedge__(i--);
            }

            for (let id in this.model.nodes)
                if (this.__getMetamodel(this.model.nodes[id]['$type']) == name)
                    this.__rmnode__(id);

            this.__dumpmm__(name);
            return {'changelog': this.__changelog()};
        },


    /******************************** MODEL CRUD *******************************/
    /* wraps crud operations with generic boilerplate

        0. setup next_type hack : the next_type variable is used to carry the type
            of the to-be-created node for the special case of pre-create handlers
            because their target nodes aren't yet in this.model.nodes
        1. create a checkpoint (any failure along the way causes checkpoint
            restore)
        2. run all applicable pre-events constraints and actions
        3. perform the specified crud operation
        4. run all applicable post-events actions and constraints
        5. clear unused checkpoint */
    '__crudOp':
        function (metamodel, events, eventTargets, op, args) {
            if (this.metamodels[metamodel] == undefined)
                return {'$err': 'metamodel not loaded :: ' + metamodel};

            if (_utils.contains(events, 'create'))
                this.next_type = args.fulltype || args.connectorType;

            this.__checkpoint();

            let pre_events = events.slice(0).map(function (ev) {
                return 'pre-' + ev;
            });
            let post_events = events.slice(0).map(function (ev) {
                return 'post-' + ev;
            });
            let err;
            if ((err = this.__runEventHandlers(this.metamodels[metamodel]['constraints'], pre_events, eventTargets, 'constraint')) ||
                (err = this.__runEventHandlers(this.metamodels[metamodel]['actions'], pre_events, eventTargets, 'action')) ||
                (err = this[op](args)) ||
                (err = this.__runEventHandlers(this.metamodels[metamodel]['actions'], post_events, eventTargets, 'action')) ||
                (err = this.__runEventHandlers(this.metamodels[metamodel]['constraints'], post_events, eventTargets, 'constraint'))) {
                this.__restoreCheckpoint();
                return err;
            }
            this.__clearCheckpoint();
        },


    /* connect specified nodes with instance of connectorType

        __connectNN: (connect 2 nodes)
            1. run pre-connect on end nodes
            2. run __create to create instance and connect it to end nodes
            3. run post-connect on end nodes
        __connectCN: (connect 1 node and 1 connector)
            1. add an appropriate edge to this.model.edges
        connect:
            0. create a step-checkpoint
            1. verify validity of requested connection (i.e., connection is legal
                  and max cardinalities haven't been reached)
            2. if one of the nodes is a connector
                a) run pre-connect on end nodes
                b) create appropriate new edge between them (via __connectCN)
                c) run post-connect on end nodes
            2. if both nodes are non-connectors
                a) run pre-create on connectorType
                b) create connectorType instance and connect it to end nodes (via
                      __connectNN)
                c) run post-create on connectorType
            3. return err or (new or existing) connector's id */
    '__connectNN':
        function (args/*id1,id2,connectorType,attrs*/) {
            return this.__crudOp(
                this.__getMetamodel(args.connectorType),
                ['connect'],
                [args.id1, args.id2],
                '__create',
                {
                    'fulltype': args.connectorType,
                    'id1': args.id1,
                    'id2': args.id2,
                    'attrs': args.attrs
                });
        },
    '__connectCN':
        function (args/*id1,id2,connectorId*/) {
            this.__mkedge__(args.id1, args.id2);
        },
    'connect':
        function (id1, id2, connectorType, attrs) {
            this.__setStepCheckpoint();

            let metamodel = this.__getMetamodel(connectorType),
                t1 = this.__getType(this.model.nodes[id1]['$type']),
                t2 = this.__getType(this.model.nodes[id2]['$type']),
                tc = this.__getType(connectorType),
                into = (t1 == tc ? t2 : tc),
                from = (t2 == tc ? t1 : tc),
                card_into = undefined,
                card_from = undefined,
                num_id1to = 0,
                num_toid2 = 0,
                self = this;

            [t1, '$*', '__p$*'].some(
                function (t) {
                    for (let i in self.metamodels[metamodel]['cardinalities'][t]) {
                        let cardinality = self.metamodels[metamodel]['cardinalities'][t][i];
                        if (cardinality['type'] == into && cardinality['dir'] == 'out') {
                            card_into = cardinality;
                            return true;
                        }
                    }
                });

            [t2, '$*', '__p$*'].some(
                function (t) {
                    for (let i in self.metamodels[metamodel]['cardinalities'][t]) {
                        let cardinality = self.metamodels[metamodel]['cardinalities'][t][i];
                        if (cardinality['type'] == from && cardinality['dir'] == 'in') {
                            card_from = cardinality;
                            return true;
                        }
                    }
                });

            if (card_into == undefined || card_from == undefined)
                return {'$err': 'can not connect types ' + t1 + ' and ' + t2};
            else if (card_into['max'] == 0)
                return {'$err': 'maximum outbound multiplicity reached for ' + t1 + ' (' + id1 + ') and type ' + into};
            else if (card_from['max'] == 0)
                return {'$err': 'maximum inbound multiplicity reached for ' + t2 + ' (' + id2 + ') and type ' + from};

            for (let i in this.model.edges) {
                let edge = this.model.edges[i];
                if (edge['src'] == id1 &&
                    this.__getType(this.model.nodes[edge['dest']]['$type']) == into &&
                    ++num_id1to >= card_into['max'])
                    return {'$err': 'maximum outbound multiplicity reached for ' + t1 + ' (' + id1 + ') and type ' + into};

                if (edge['dest'] == id2 &&
                    this.__getType(this.model.nodes[edge['src']]['$type']) == from &&
                    ++num_toid2 >= card_from['max'])
                    return {'$err': 'maximum inbound multiplicity reached for ' + t2 + ' (' + id2 + ') and type ' + from};
            }

            if (t1 == tc || t2 == tc) {
                let connectorId = (t1 == tc ? id1 : id2);
                let err = this.__crudOp(
                    metamodel,
                    ['connect'],
                    [id1, id2],
                    '__connectCN',
                    {
                        'id1': id1,
                        'id2': id2,
                        'connectorId': connectorId
                    });
                return err ||
                    {
                        'id': connectorId,
                        'changelog': this.__changelog()
                    };
            } else {
                let err = this.__crudOp(
                    metamodel,
                    ['create'],
                    [this.next_id],
                    '__connectNN',
                    {
                        'id1': id1,
                        'id2': id2,
                        'connectorType': connectorType,
                        'attrs': attrs
                    });
                return err ||
                    {
                        'id': this.next_id++,
                        'changelog': this.__changelog()
                    };

            }
        },


    /* create an instance of fulltype

        __create:
            1. create [default] instance using metamodel [and possibly specified
                attrs] + init $type
            2. add to current model nodes
            [3. if fulltype is a connectorType, create edges between node id1
                and new instance and between new instance and node id2
         create:
            0. create a step-checkpoint
             1. wrap __create in crudOp
            2. return err or new instance id */
    '__create':
        function (args/*fulltype,attrs,[,id1,id2]*/) {
            let metamodel = this.__getMetamodel(args.fulltype);
            let type = this.__getType(args.fulltype);
            let typeAttrs = this.metamodels[metamodel]['types'][type];
            let new_node = {};

            if (typeAttrs == undefined)
                return {'$err': 'can not create instance of unknown type :: ' + args.fulltype};

            typeAttrs.forEach(
                function (attr) {
                    let val = (args.attrs && attr['name'] in args.attrs ?
                        args.attrs[attr['name']] :
                        attr['default']);
                    new_node[attr['name']] =
                        {
                            'type': attr['type'],
                            'value': (typeof attr['default'] == 'object' ?
                                _utils.clone(val) :
                                val)
                        };
                });
            new_node['$type'] = args.fulltype;

            this.__mknode__(this.next_id, new_node);

            if (args.id1 != undefined) {
                this.__mkedge__(args.id1, String(this.next_id));
                this.__mkedge__(String(this.next_id), args.id2);
            }
        },
    'create':
        function (fulltype, attrs) {
            this.__setStepCheckpoint();

            let err = this.__crudOp(
                this.__getMetamodel(fulltype),
                ['create'],
                [this.next_id],
                '__create',
                {
                    'fulltype': fulltype,
                    'attrs': attrs
                });
            return err ||
                {
                    'id': this.next_id++,
                    'changelog': this.__changelog()
                };
        },


    /* delete the specified node (and appropriate edges and/or connectors)

        __delete:
            1. determine specified node's neighbors
            2. if specified node is a connector (neighbors are non-connectors),
                a) run pre-disconnect constraints and actions and on its neighbors
                b) delete it and all appropriate edges (via __deleteConnector)
                c) run post-disconnect constraints and actions and on its neighbors
            2. if specified node is not a connector (neighbors are connectors),
                a) recursively run __delete on each of its neighbors
                b) delete it
        __deleteConnector:
            1. delete all appropriate edges then delete node
         delete:
            0. create a step-checkpoint
             1. wrap __delete in crudOp
            2. return err or nothing */
    '__delete':
        function (args/*id*/) {
            let id = args.id;
            let metamodel = this.__getMetamodel(this.model.nodes[id]['$type']);
            let type = this.__getType(this.model.nodes[id]['$type']);
            let isConnector = (this.metamodels[metamodel]['connectorTypes'][type] != undefined);
            let neighbors = [];

            this.model.edges.forEach(
                function (edge) {
                    if (edge['src'] == id && !_utils.contains(neighbors, edge['dest']))
                        neighbors.push(edge['dest']);
                    else if (edge['dest'] == id && !_utils.contains(neighbors, edge['src']))
                        neighbors.push(edge['src']);
                });

            if (isConnector) {
                let res = this.__crudOp(
                    metamodel,
                    ['disconnect'],
                    neighbors,
                    '__deleteConnector',
                    {'id': id});
                if (res)
                    return res;
            } else {
                for (let i in neighbors) {
                    let res = this.__crudOp(
                        metamodel,
                        ['delete'],
                        [neighbors[i]],
                        '__delete',
                        {'id': neighbors[i]})
                    if (res)
                        return res;
                }
                this.__rmnode__(id);
            }
        },
    '__deleteConnector':
        function (args/*id*/) {
            for (let i = 0; i < this.model.edges.length; i++) {
                let edge = this.model.edges[i];
                if (edge['src'] == args.id || edge['dest'] == args.id)
                    this.__rmedge__(i--);
            }
            this.__rmnode__(args.id);
        },
    'delete':
        function (id) {
            this.__setStepCheckpoint();

            if (this.model.nodes[id] == undefined)
                return {'$err': 'invalid id :: ' + id};

            let err = this.__crudOp(
                this.__getMetamodel(this.model.nodes[id]['$type']),
                ['delete'],
                [id],
                '__delete',
                {'id': id});

            return err ||
                {'changelog': this.__changelog()};
        },


    /* returns the stringified full model, a stringified node, or a copy of an
          attribute's value */
    'read':
        function (id, attr) {
            let curr;
            if (id == undefined)
                return _utils.jsons(this.model);
            else if (this.model.nodes[id] == undefined)
                return {'$err': 'instance not found :: ' + id};
            else if (attr == undefined)
                return _utils.jsons(this.model.nodes[id]);
            else if (attr.match(/.+\/.+/)) {
                curr = this.model.nodes[id];
                let path = attr.split('/');
                for (let i in path) {
                    if (typeof curr == 'object' && path[i] in curr)
                        curr = curr[path[i]];
                    else
                        return {'$err': 'instance ' + id + ' has no attribute :: ' + attr};
                }
            } else if (!(attr in this.model.nodes[id]))
                return {'$err': 'instance ' + id + ' has no attribute :: ' + attr};

            let attrVal = (curr ? curr['value'] : this.model.nodes[id][attr]['value']);
            if (typeof attrVal == 'object')
                return _utils.clone(attrVal);
            else
                return attrVal;
        },


    /* returns a copy of one or all metamodels in this.metamodels */
    'readMetamodels':
        function (metamodel) {
            if (metamodel == undefined)
                return _utils.jsons(this.metamodels);
            else if (this.metamodels[metamodel] == undefined)
                return {'$err': 'metamodel not found :: ' + metamodel};
            else
                return _utils.jsons(this.metamodels[metamodel]);
        },


    /* returns this.name */
    'readName':
        function () {
            return this.name;
        },


    /* runs accesor-code that conforms to the DesignerCode API and returns its
        results */
    'runDesignerAccessorCode':
        function (code, desc, id) {
            let res = this.__runDesignerCode(code, desc, 'accessor', id);
            if (res && res['$err'])
                return res;
            return res;
        },


    /* runs action-code that conforms to the DesignerCode API (of interest is
        that this 'operation' is checkpointed and can thus be undone/redone; and
          that any exceptions thrown by the code cause a full rollback to before it
          was run and are then returned to the querier) */
    'runDesignerActionCode':
        function (code, desc, type, id) {
            this.__setStepCheckpoint();

            this.__checkpoint();
            let err = this.__runDesignerCode(code, desc, type, id);
            if (err) {
                this.__restoreCheckpoint();
                return err;
            }

            this.__clearCheckpoint();
            return {'changelog': this.__changelog()};
        },


    /* updates node with specified id

        __update:
            1. update instance as per data
            2. return err on unknown attributes
            3. TBA: type verification on new values
         update:
            0. create a step-checkpoint
             1. wrap __update in crudOp
            2. return err or nothing */
    '__update':
        function (args/*id,data*/) {
            for (let attr in args.data) {
                if (args.data[attr] == null)
                    return {'$err': 'tried to set attribute ' + attr + ' to "null"'};

                let res = this.read(args.id, attr);
                if (res['$err'])
                    return res;
                else
                    this.__chattr__(args.id, attr, args.data[attr]);
            }
        },
    'update':
        function (id, data/*{..., attr_i:val_i, ...}*/) {
            this.__setStepCheckpoint();

            if (this.model.nodes[id] == undefined)
                return {'$err': 'invalid id :: ' + id};

            let err = this.__crudOp(
                this.__getMetamodel(this.model.nodes[id]['$type']),
                ['edit'],
                [id],
                '__update',
                {
                    'id': id,
                    'data': data
                });

            return err ||
                {'changelog': this.__changelog()};
        },


    /*************************** EVENT HANDLER EXEC ****************************/
    /* run the given constraint|action|accessor... when id is specified, we
        consider it to be the id of the node that "owns" the current
        constraint|action|accessor...

        this function is divided in 3 parts
        1. constraints/actions/accessors API definition
        2. safe_eval definition
        3. actual code that runs the handler and handles its output */
    '__runDesignerCode':
        function (code, desc, type, id) {
            /* the functions below implement the API available for constraints,
                 actions and 'accessors'... they can only be called from "designer"
                code (i.e., from actions/constraints/accessors written by language
                  and/or model transformation designers)... the main consequence of
                this is our design decision that setAttr() is not treated like a
                normal crud operation: it does not go through the crudOp pipeline
                of pre/post edit constraints/actions... on one hand, this decision
                  avoids any weird recursion cases (e.g., setAttr() in pre-edit action
                  triggers pre-edit action and on and on and on)... on the other hand,
                  designers should be aware that:
                    1. setAttr() may set attributes to values that the user could not
                          input (e.g., due to constraints)
                    2. consequences (specified as edit actions) of a user setting an
                          attribute A to value 'a' might not take effect if setAttr()
                        sets attribute A to value 'a' : for instance, if an edit
                        action says that attribute B should be 'a'+2, setAttr() won't
                          trigger that action
                    3. even though setAttr() bypasses crudOp constraints/actions, its
                        effects are still immediate: a getAttr() on the next line (of
                        designer code) reports the updated value

                moral of story:
                    designers must be very careful with setAttr() to avoid putting
                    the model into otherwise unreachable states


                API:
                    hasAttr(_attr[,_id])
                        return true if the specified node has an attribute of the
                        given name

                    getAttr(_attr[,_id])
                        return the requested attr of the specified node... to ensure
                          getAttr can't be used to edit the model, JSON parse+stringify
                          is used to return a *copy* of the attribute when its value has
                        an object type (i.e., hash or array)

                    getAllNodes([_fulltypes])
                        if _fulltypes is undefined, return the ids all of nodes...
                        otherwise, return ids of all nodes with specified fulltypes

                    getNeighbors(_dir[,_type,_id])
                        return all inbound (_dir = '<'), outbound (_dir = '>') or both
                          (_dir = '*') neighbor ids for specified type (if any)

                    print(str)
                        print something to the console that launched the server

                    setAttr(_attr,_val[,_id])
                        ((this function is only available in actions))... update the
                          requested attr of the specified node using __chattr__ (s.t.
                        the change is logged)...
                        TBA:: type-checking on _val

                basic checks are made on input parameters to aid in debugging faulty
                actions and constraints... for functions with id parameters, if no
                id is given, we use the id passed to __runDesignerCode... which is
                either the id of the node that "owns" the current constraint|action|
                accessor, or undefined if the parameter was omitted */
            let self = this;

            function getAttr(_attr, _id) {
                if (_id == undefined)
                    _id = id;

                if (self.model.nodes[_id] == undefined)
                    throw 'invalid getAttr() id :: ' + _id;
                else if (!(_attr in self.model.nodes[_id]))
                    throw 'invalid getAttr() attribute :: ' + _attr;

                if (_attr.charAt(0) == '$')
                    return self.model.nodes[_id][_attr];
                else if (typeof self.model.nodes[_id][_attr]['value'] == 'object')
                    return _utils.clone(self.model.nodes[_id][_attr]['value']);
                else
                    return self.model.nodes[_id][_attr]['value'];
            }

            function getAttrNames(_id) {
                if (_id == undefined)
                    _id = id;
                if (self.model.nodes[_id] == undefined)
                    throw 'invalid getAttrNames() id :: ' + _id;
                return Object.getOwnPropertyNames(self.model.nodes[_id]);
            }

            function hasAttr(_attr, _id) {
                if (_id == undefined)
                    _id = id;

                if (self.model.nodes[_id] == undefined)
                    throw 'invalid getAttr() id :: ' + _id;
                return _attr in self.model.nodes[_id];
            }

            function getAllNodes(_fulltypes) {
                if (_fulltypes != undefined && !(_fulltypes instanceof Array))
                    throw 'invalid getAllNodes() types array :: ' + _fulltypes;

                let ids = [];
                for (let _id in self.model.nodes) {
                    if (_fulltypes == undefined ||
                        _utils.contains(_fulltypes, self.model.nodes[_id]['$type']))
                        ids.push(_id);
                }
                return ids;
            }

            function getNeighbors(_dir, _type, _id) {
                if (_id == undefined)
                    _id = id;

                if (_type == undefined)
                    _type = '*';

                if (self.model.nodes[_id] == undefined)
                    throw 'invalid getNeighbors() id :: ' + _id;

                let ids = [];
                for (let i in self.model.edges) {
                    let edge = self.model.edges[i];
                    if (edge['src'] == _id &&
                        (_dir == '>' || _dir == '*' || _dir == "out") &&
                        (_type == '*' || self.model.nodes[edge['dest']]['$type'] == _type) &&
                        !_utils.contains(ids, edge['dest']))
                        ids.push(edge['dest']);
                    else if (edge['dest'] == _id &&
                        (_dir == '<' || _dir == '*' || _dir == "in") &&
                        (_type == '*' || self.model.nodes[edge['src']]['$type'] == _type) &&
                        !_utils.contains(ids, edge['src']))
                        ids.push(edge['src']);
                }
                return ids;
            }

            function print(str) {
                _util.log(str);
            }

            function setAttr(_attr, _val, _id) {
                if (type != 'action')
                    throw 'setAttr() can only be used within actions';

                if (_id == undefined)
                    _id = id;

                if (self.model.nodes[_id] == undefined)
                    throw 'invalid setAttr() id :: ' + _id;
                else if (!(_attr in self.model.nodes[_id]) || _attr.charAt(0) == '$')
                    throw 'invalid setAttr() attribute :: ' + _attr;

                self.__chattr__(_id, _attr, _val);
            }


            /* evaluate provided code without the said code having access to
                globals (i.e., model, journal) or to 'self' (which we use above to
                allow non-global functions to access globals), and catching any
                exceptions it may throw... escaped newlines if any are unescaped */
            function safe_eval(code) {
                let self = undefined;
                try {
                    return eval(code);
                } catch (err) {
                    if (err == 'IgnoredConstraint')
                        return true;
                    return {'$err': err};
                }
            }


            let res = safe_eval(code);

            if (res != undefined && res['$err'] != undefined)
                return {'$err': type + ' (' + desc + ') crashed on :: ' + res['$err']};

            /* completed accessor */
            else if (type == 'accessor')
                return res;

            /* failed constraint */
            else if (res == false)
                return {'$err': type + ' (' + desc + ') failed'};
        },


    /* run actions or constraints for specified events and specified nodes

        1. get types of specified nodes (note that we do a little hack for the
            special case of pre-create handlers because this.model.nodes does not
            yet contain a node with the to-be-created node's id... thus its type
            is read from this.next_type)
        2. identify and run applicable handlers based on events and targetTypes */
    '__runEventHandlers':
        function (allHandlers, events, ids, handlerType) {
            let types2ids = {};
            for (let i in ids) {
                let id = ids[i];
                let type;
                if (id == this.next_id)
                    type = this.__getType(this.next_type);
                else if (this.model.nodes[id] == undefined)
                    continue;
                else
                    type = this.__getType(this.model.nodes[id]['$type']);

                if (types2ids[type] == undefined)
                    types2ids[type] = [];
                types2ids[type].push(id);
            }

            for (let i in allHandlers) {
                let handler = allHandlers[i];

                let handled = _utils.contains(events, handler['event']) ||
                    (_utils.contains(events, "validate") && handler['event'] == ""); //handle legacy events

                if (!handled) {
                    continue;
                }
                if (handler['targetType'] == '*') {
                    let result = null;
                    for (let j in ids) {
                        result = this.__runDesignerCode(
                            handler['code'],
                            handler['event'] + ' ' + handler['name'],
                            handlerType,
                            ids[j]);
                        if (result) {
                            return result;
                        }
                    }

                    if (ids.length == 0) {
                        result = this.__runDesignerCode(
                            handler['code'],
                            handler['event'] + ' ' + handler['name'],
                            handlerType);

                        if (result) {
                            return result;
                        }
                    }
                } else {
                    for (let j in types2ids[handler['targetType']]) {
                        let id = types2ids[handler['targetType']][j];
                        let result = this.__runDesignerCode(
                            handler['code'],
                            handler['event'] + ' ' + handler['name'],
                            handlerType,
                            id);

                        if (result) {
                            return result;
                        }
                    }
                }

            }
        },


    /**************************** MODEL VALIDATION *****************************/
    /* verifies that the current model satisfies (1) the min cardinalities set
        by its metamodel(s) and (2) all global eventless constraints... returns
        the first encountered discrepancy or nothing

        1. count incoming and outgoing connections of each type for each node
        2. compare the above to the min cardinalities
        3. run all global eventless constraints */
    'validateModel':
        function (model) {
            let inCounts = {};
            let outCounts = {};
            let outContainments = {};
            let containmentTargets = {};

            model = (model == undefined ? this.model : model);

            if (model.nodes == undefined ||
                model.edges == undefined ||
                model.metamodels == undefined ||
                model.metamodels.length == 0)
                return {'$err': 'provided model is either empty or not an atompm model'};

            for (let i in model.edges) {
                let edge = model.edges[i];
                let srcType = this.__getType(model.nodes[edge['src']]['$type']);
                let destType = this.__getType(model.nodes[edge['dest']]['$type']);
                let srcMetamodel = this.__getMetamodel(model.nodes[edge['src']]['$type']);
                let destMetamodel = this.__getMetamodel(model.nodes[edge['dest']]['$type']);

                if (inCounts[edge['dest']] == undefined)
                    inCounts[edge['dest']] = {};
                if (inCounts[edge['dest']][srcType] == undefined)
                    inCounts[edge['dest']][srcType] = 0;
                inCounts[edge['dest']][srcType]++;

                if (outCounts[edge['src']] == undefined)
                    outCounts[edge['src']] = {};
                if (outCounts[edge['src']][destType] == undefined)
                    outCounts[edge['src']][destType] = 0;
                outCounts[edge['src']][destType]++;

                if (outContainments[edge['src']] == undefined) {
                    outContainments[edge['src']] = [];
                }
                if (destType in this.metamodels[destMetamodel]['connectorTypes'] && this.metamodels[destMetamodel]['connectorTypes'][destType] == 'containment') {
                    outContainments[edge['src']].push(edge['dest']);
                }

                if (containmentTargets[edge['src']] == undefined) {
                    containmentTargets[edge['src']] = [];
                }
                if (srcType in this.metamodels[srcMetamodel]['connectorTypes'] && this.metamodels[srcMetamodel]['connectorTypes'][srcType] == 'containment') {
                    containmentTargets[edge['src']].push(edge['dest']);
                }
            }

            let checked_for_loops = [];
            for (let id in model.nodes) {
                let metamodel = this.__getMetamodel(model.nodes[id]['$type']);
                let type = this.__getType(model.nodes[id]['$type']);

                for (let i in this.metamodels[metamodel]['cardinalities'][type]) {
                    let cardinality = this.metamodels[metamodel]['cardinalities'][type][i];
                    let tc = cardinality['type'];
                    if (cardinality['dir'] == 'out' &&
                        cardinality['min'] > (outCounts[id] == undefined || outCounts[id][tc] == undefined ? 0 : outCounts[id][tc]))
                        return {'$err': 'insufficient outgoing connections of type ' + tc + ' for ' + model.nodes[id]['$type'] + '/' + id};
                    else if (cardinality['dir'] == 'in' &&
                        cardinality['min'] > (inCounts[id] == undefined || inCounts[id][tc] == undefined ? 0 : inCounts[id][tc]))
                        return {'$err': 'insufficient incoming connections of type ' + tc + ' for ' + model.nodes[id]['$type'] + '/' + id};
                }

                if (checked_for_loops.indexOf(id) < 0 && !(type in this.metamodels[metamodel]['connectorTypes'])) {
                    let visited = [];
                    let tv = [id];

// eslint-disable-next-line no-inner-declarations
                    function dfs(to_visit) {
                        let curr = to_visit.pop();
                        if (curr == undefined)
                            return undefined; // no more to check
                        else if (visited.indexOf(curr) > -1)
                            return {'$err': 'containment loop found for ' + model.nodes[id]['$type'] + '/' + id}; // error: loop found!
                        else {
                            visited.push(curr);
                            // find all (containment) associations linked to the object, and add their targets to the to_visit list.
                            for (let oc_idx in outContainments[curr]) {
                                to_visit = to_visit.concat(containmentTargets[outContainments[curr][oc_idx]]);
                            }
                            return dfs(to_visit);
                        }
                    }

                    let res = dfs(tv);
                    if (res != undefined) {
                        return res;
                    }
                    checked_for_loops = checked_for_loops.concat(visited);
                }
            }

            for (let metamodel in this.metamodels) {

                let err = this.__runEventHandlers(this.metamodels[metamodel]['constraints'], ['validate'], [], 'constraint');
                if (err)
                    return err;
            }
        },


    /************************* JOURNALING + UNDO/REDO **************************/
    'journal': [],
    'journalIndex': 0,

    /* NOTE: on this.undoredoJournal
            this.undoredoJournal contains cud operations performed during the last
            undo()/redo() call provided no user-operations was performed since the
            said call (in which case this.undoredoJournal is empty)... undo/redo
            ops need to be logged for __changelog() to be able to return their
            effects... however, they should not be logged in the main journal since
              all they conceptually do is move a cursor in it... in practice,
            this.undoredoJournal is emptied on every call to undo(), redo() and
            __setStepCheckpoint() */


    /*	create a checkpoint : add an entry in the log used as a delimiter to know
          where to stop when restoring (i.e., undoing failed pre-/post-actions or
        crud ops) */
    '__checkpoint':
        function () {
            this.__log({'op': 'MKCHKPT'});
        },


    /* deletes the last checkpoint of the current model (other than tidying the
          journal, there's no reason for ever clearing unused checkpoints) */
    '__clearCheckpoint':
        function () {
            for (let i = this.journal.length - 1; i >= 0; i--)
                if (this.journal[i]['op'] == 'MKCHKPT') {
                    this.journal.splice(i, 1);
                    this.journalIndex--;
                    break;
                }
        },


    /* case 1: 'this.undoredoJournal is defined (possibly empty)'
        returns the operations performed by the last undo()/redo()

        case 2: 'this.undoredoJournal = undefined'
        returns a copy of the portion of the journal that describes the changes
          made by the last user-operation... note that user-operations always call
        __setStepCheckpoint before running */
    '__changelog':
        function () {
            if (this.undoredoJournal != undefined)
                return _utils.clone(this.undoredoJournal.splice(0));

            let ji = this.journalIndex;
            while (ji > 0)
                if (this.journal[--ji]['op'] == 'MKSTPCHKPT')
                    break;
            return _utils.clone(this.journal.slice(ji + 1, this.journalIndex));
        },


    /* case 1: 'log=undefined'
        logs an internal cud operation into the journal... if the current index in
        the journal is anything but the end of the journal, clear everything after
        the index (this effectively erases the command "future-history" when
        editing an "undone" model)

        case 2: 'log="UNDOREDO"'
        logs an internal cud operation into this.undoredoJournal

        case 3: 'log="DONTLOG"'
        do nothing

            legal logging commands:
                MKNODE	id,node
                RMNODE	id,node
                MKEDGE	id,id
                RMEDGE	id,id
                 CHATTR	id,attr,new_val,old_val
                LOADMM	name,mm
                DUMPMM	name,mm
                RESETM	name,model
                MKCHKPT
                MKSTPCHKPT
                MKUSRCHKPT */
    '__log':
        function (step, log) {
            if (log == undefined) {
                if (this.journalIndex != this.journal.length)
                    this.journal.splice(this.journalIndex);
                this.journal.push(step);
                this.journalIndex++;
            } else if (log == 'UNDOREDO')
                this.undoredoJournal.push(step);

            //else if( log == 'DONTLOG' )
            //	;
        },


    /* redo a single step

          1. identify the nature of the logged operation
         2. reproduce its effects (these are logged in this.undoredoJournal) */
    '__redo':
        function (step) {
            let log = 'UNDOREDO';
            if (step['op'] == 'CHATTR') this.__chattr__(step['id'], step['attr'], step['new_val'], log);
            else if (step['op'] == 'DUMPMM') this.__dumpmm__(step['name'], log);
            else if (step['op'] == 'LOADMM') this.__loadmm__(step['name'], step['mm'], log);
            else if (step['op'] == 'MKEDGE') this.__mkedge__(step['id1'], step['id2'], step['i'], log);
            else if (step['op'] == 'MKNODE') this.__mknode__(step['id'], _utils.jsonp(step['node']), log);
            else if (step['op'] == 'RESETM') this.__resetm__(step['new_name'], step['new_model'], false, log);
            else if (step['op'] == 'RMEDGE') this.__rmedge__(step['i'], log);
            else if (step['op'] == 'RMNODE') this.__rmnode__(step['id'], log);
        },


    /* redo all of the changes until the next step-checkpoint or until after the
        specified user-checkpoint, if any... when complete the journal index is
        after the redone MKSTPCHKPT/MKUSRCHKPT entry... redoing when the journal
        index is at the end of the journal will have no effect */
    'redo':
        function (uchkpt) {
            this.undoredoJournal = [];
            let self = this;
            let uchkptEncountered = false;
            let uchkptReached = function (step) {
                return step['op'] == 'MKUSRCHKPT' && step['name'] == uchkpt;
            };
            let uchkptFound =
                function (i) {
                    while (i < self.journal.length)
                        if (uchkptReached(self.journal[i++]))
                            return true;
                    return false;
                };
            let stopMarkerReached =
                (uchkpt == undefined ?
                    function (step) {
                        return step['op'] == 'MKSTPCHKPT';
                    } :
                    function (step) {
                        return uchkptEncountered && step['op'] == 'MKUSRCHKPT';
                    });

            if (uchkpt == undefined || uchkptFound(this.journalIndex))
                while (this.journalIndex < this.journal.length) {
                    if (uchkpt != undefined &&
                        !uchkptEncountered &&
                        uchkptReached(this.journal[this.journalIndex]))
                        uchkptEncountered = true;
                    if (this.journal[++this.journalIndex] == undefined ||
                        stopMarkerReached(this.journal[this.journalIndex]))
                        break;
                    else
                        this.__redo(this.journal[this.journalIndex]);
                }

            return {'changelog': this.__changelog()};
        },


    /*	undo every logged operation until a MKCHKPT is reached (and remove them
        and the said MKCHKPT from the journal)... note that this operation is only
        called internally and that the journalIndex will always be at the end of
        the journal when it's called (and after its called) */
    '__restoreCheckpoint':
        function () {
            while (this.journal.length > 0) {
                let step = this.journal.pop();
                if (step['op'] == 'MKCHKPT')
                    break;
                else
                    this.__undo(step, 'DONTLOG');
            }
            this.journalIndex = this.journal.length;
        },


    /*	create a step-checkpoint : add an entry in the log used as a delimiter to
        know where to stop when undoing/redoing (i.e., on client undo/redo)

        1. create new step-checkpoint or re-use a 'zombie' step-checkpoint (zombie
              step-checkpoints (SC) are SCs associated to failed or effectless user
            operations... they are recognizable as SCs with no following log
            entries... there's at most 1 zombie SC in the log at any given time) */
    '__setStepCheckpoint':
        function () {
            this.undoredoJournal = undefined;
            if (this.journal.length == 0 ||
                this.journal[this.journal.length - 1]['op'] != 'MKSTPCHKPT')
                this.__log({'op': 'MKSTPCHKPT'});
        },


    /*	create a user-checkpoint : add an entry in the log used as a delimiter to
        enable undoing/redoing until a specified marker

        1. create new step-checkpoint or re-use a 'zombie' user-checkpoint (zombie
              user-checkpoints (UC) are UCs associated to failed or effectless user
            operations... they are recognizable as same-name UCs with no following
            log entries... there's at most 1 zombie UC per name in the log at any
            given time) */
    'setUserCheckpoint':
        function (name) {
            this.undoredoJournal = undefined;
            if (this.journal.length == 0 ||
                this.journal[this.journal.length - 1]['op'] != 'MKUSRCHKPT' ||
                this.journal[this.journal.length - 1]['name'] != name)
                this.__log({'op': 'MKUSRCHKPT', 'name': name});
        },


    /* undo a single step

          1. identify the nature of the logged operation
         2. invert its effects (these may be ignored (log = 'DONTLOG') or logged in
              this.undoredoJournal (log = 'UNDOREDO') */
    '__undo':
        function (step, log) {
            if (step['op'] == 'CHATTR') this.__chattr__(step['id'], step['attr'], step['old_val'], log);
            else if (step['op'] == 'DUMPMM') this.__loadmm__(step['name'], step['mm'], log);
            else if (step['op'] == 'LOADMM') this.__dumpmm__(step['name'], log);
            else if (step['op'] == 'MKEDGE') this.__rmedge__(step['i'], log);
            else if (step['op'] == 'MKNODE') this.__rmnode__(step['id'], log);
            else if (step['op'] == 'RESETM') this.__resetm__(step['old_name'], step['old_model'], false, log);
            else if (step['op'] == 'RMEDGE') this.__mkedge__(step['id1'], step['id2'], step['i'], log);
            else if (step['op'] == 'RMNODE') this.__mknode__(step['id'], _utils.jsonp(step['node']), log);
        },


    /* undo all of the changes since the last step-checkpoint or since the
        specified user-checkpoint, if any... when complete the journal index is on
          the undone MKSTPCHKPT/MKUSRCHKPT entry... undoing when the journal index is 0
        or when a non-existing user-checkpoint is given will have no effect */
    'undo':
        function (uchkpt) {
            this.undoredoJournal = [];
            var stopMarkerReached =
                    (uchkpt == undefined ?
                        function (step) {
                            return step['op'] == 'MKSTPCHKPT';
                        } :
                        function (step) {
                            return step['op'] == 'MKUSRCHKPT' && step['name'] == uchkpt;
                        }),
                self = this,
                stopMarkerFound =
                    function (i) {
                        while (--i >= 0)
                            if (stopMarkerReached(self.journal[i]))
                                return true;
                        return false;
                    };

            if (uchkpt == undefined || stopMarkerFound(this.journalIndex))
                while (this.journalIndex > 0)
                    if (stopMarkerReached(this.journal[--this.journalIndex]))
                        break;
                    else
                        this.__undo(this.journal[this.journalIndex], 'UNDOREDO');

            return {'changelog': this.__changelog()};
        },


    /****************************** INTERNAL CUD *******************************/
    /* the following functions are super basic and low-level, they offer cud (no
          read) commands on this' internal data structures... their main purposes
        are (1) to localize the said cud operations, and (2) to log everything
        they do... logging enables undoing and redoing (on constraint/action/...
        failure or on client requests) and facilitates change pushing (i.e., push
        a short change log rather the full model)... note that it is assumed that
        only valid parameters are passed to these functions... last but not least,
        the optional 'log' parameter is used when undoing/redoing to log undoing/
        redoing cud ops elsewhere than in this.journal

        __chattr__	change an attribute's value
                        > log id,attr,new_val,old_val
        __dumpmm__	remove mm from this.model.metamodels and this.metamodels
                        > log name,mm
        __loadmm__	add a mm to this.model.metamodels and this.metamodels
                        > log name,mm
        __mkedge__	add an edge to this.model.edges... optional 'i' parameter
                        specifies index of new edge in this.model.edges
                        > log id1,id2,i
        __mknode__	add a node to this.model.nodes
                        > log id,node
        __resetm__	when the 'insert' parameter is false, replaces the current
                          model with another + updates this.next_id to account for ids
                          in loaded model + updates model.metamodels to account for
                        metamodels loaded before the model
                        when the 'insert' parameter is true, inserts the given model
                        alongside the current model + alters the given model's ids to
                          avoid clashes with existing ids + updates this.next_id... the
                          logged value of 'insert' ends up being the offset we applied
                        to the provided model's ids
                        > log new_name,new_model,old_name,old_model,insert
        __rmedge__	remove an edge from this.model.edges
                        > log id1,id2,i
        __rmnode__	remove a node from this.model.nodes
                        > log id,node

        note: these functions never log any 'live' data into the log (i.e., any
                references that could be altered elsewhere thereby altering the
                journal's contents) */
    '__chattr__':
        function (id, attr, new_val, log) {
            let getattr = undefined;
            let setattr = undefined;
            let attrval = function (v) {
                return (v == undefined ? v : _utils.jsonp(v));
            };
            let self = this;
            if (attr.match(/.+\/.+/)) {
                let curr = this.model.nodes[id];
                let path = attr.split('/');
                for (let i in path)
                    curr = curr[path[i]];
                getattr = function () {
                    return curr['value'];
                };
                setattr = function (v) {
                    curr['value'] = v;
                };
            } else {
                getattr = function () {
                    return self.model.nodes[id][attr]['value'];
                };
                setattr = function (v) {
                    self.model.nodes[id][attr]['value'] = v;
                };
            }

            let _old_val = _utils.jsons(getattr());
            let _new_val = _utils.jsons(new_val);
            if (_old_val == _new_val)
                return;
            setattr(attrval(_new_val));
            this.__log(
                {
                    'op': 'CHATTR',
                    'id': id,
                    'attr': attr,
                    'new_val': attrval(_new_val),
                    'old_val': attrval(_old_val)
                },
                log);
        },
    '__dumpmm__':
        function (name, log) {
            for (let i in this.model.metamodels)
                if (this.model.metamodels[i] == name) {
                    this.model.metamodels.splice(i, 1);
                    break;
                }
            let mm = this.metamodels[name];
            delete this.metamodels[name];
            this.__log(
                {
                    'op': 'DUMPMM',
                    'name': name,
                    'mm': _utils.jsons(mm)
                },
                log);
        },
    '__loadmm__':
        function (name, mm, log) {
            this.metamodels[name] = eval('(' + mm + ')');
            if (!_utils.contains(this.model.metamodels, name))
                this.model.metamodels.push(name);
            this.__log(
                {
                    'op': 'LOADMM',
                    'name': name,
                    'mm': mm
                },
                log);
        },
    '__mkedge__':
        function (id1, id2, i, log) {
            if (i == undefined)
                i = this.model.edges.push({'src': id1, 'dest': id2}) - 1;
            else
                this.model.edges.splice(i, 0, {'src': id1, 'dest': id2});

            this.__log(
                {
                    'op': 'MKEDGE',
                    'id1': id1,
                    'id2': id2,
                    'i': i
                },
                log);
        },
    '__mknode__':
        function (id, node, log) {
            this.model.nodes[id] = node;
            this.__log(
                {
                    'op': 'MKNODE',
                    'id': id,
                    'node': _utils.jsons(node)
                },
                log);
        },
    '__resetm__':
        function (new_name, new_model, insert, log) {
            let old_model = this.read();
            let old_name = this.name;

            if (insert) {
                let _new_model = eval('(' + new_model + ')');

                for (let id in _new_model.nodes)
                    this.model.nodes[parseInt(id) + this.next_id] = _new_model.nodes[id];

                _new_model.edges.forEach(
                    function (edge) {
                        this.model.edges.push(
                            {
                                'src': parseInt(edge.src) + this.next_id,
                                'dest': parseInt(edge.dest) + this.next_id
                            });
                    }, this);

                new_model = this.read();
                insert = this.next_id;
            } else {
                this.model = eval('(' + new_model + ')');
                for (let mm in this.metamodels)
                    if (!_utils.contains(this.model.metamodels, mm))
                        this.model.metamodels.push(mm);
            }

            this.name = new_name;
            for (let id in this.model.nodes)
                if (id >= this.next_id)
                    this.next_id = parseInt(id) + 1;

            this.__log(
                {
                    'op': 'RESETM',
                    'new_name': new_name,
                    'new_model': new_model,
                    'old_name': old_name,
                    'old_model': old_model,
                    'insert': insert
                },
                log);
        },
    '__rmedge__':
        function (i, log) {
            let edge = this.model.edges.splice(i, 1).pop();
            this.__log(
                {
                    'op': 'RMEDGE',
                    'i': i,
                    'id1': edge['src'],
                    'id2': edge['dest']
                },
                log);
        },
    '__rmnode__':
        function (id, log) {
            let node = this.model.nodes[id];
            delete this.model.nodes[id];
            this.__log(
                {
                    'op': 'RMNODE',
                    'id': id,
                    'node': _utils.jsons(node)
                },
                log);
        },


    /***************************** INTERNAL UTILS ******************************/
    /* splits a full type of the form '/path/to/metamodel/type' and returns
        '/path/to/metamodel' */
    '__getMetamodel':
        function (fulltype) {
            return fulltype.match(/(.*)\/.*/)[1];
        },


    /* splits a full type of the form '/path/to/metamodel/type' and returns
          'type' */
    '__getType':
        function (fulltype) {
            return fulltype.match(/.*\/(.*)/)[1];
        }
};
