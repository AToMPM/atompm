/*
 * This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
 * Copyright 2011 by the AToMPM team and licensed under the LGPL
 * See COPYING.lesser and README.md in the root of this project for full details
 */

const _utils = require("./utils");

/* NOTES:
		atom3 supported pre/post actions and constraints for the 'SAVE' EVENT...
		this never really made any sense (e.g., the user could be prevented from
		saving and, technically, the effects of post-actions were never saved)...
		atom3 supported 'save' events as a hack to enable forcing mm validation...
		in atompm, such validation is carried out by libeventhandler.validateModel (which
		clients can 'call') and thus, we do not support 'save' events... */

module.exports = {
    /* runs accesor-code that conforms to the DesignerCode API and returns its
            results */
    'runDesignerAccessorCode':
        function (_mmmk, code, desc, id) {
            let res = this.__runDesignerCode(_mmmk, code, desc, 'accessor', id);
            if (res && res['$err'])
                return res;
            return res;
        },


    /* runs action-code that conforms to the DesignerCode API (of interest is
        that this 'operation' is checkpointed and can thus be undone/redone; and
          that any exceptions thrown by the code cause a full rollback to before it
          was run and are then returned to the querier) */
    'runDesignerActionCode':
        function (_mmmk, code, desc, type, id) {
            _mmmk.__setStepCheckpoint();

            _mmmk.__checkpoint();
            let err = this.__runDesignerCode(_mmmk, code, desc, type, id);
            if (err) {
                _mmmk.__restoreCheckpoint();
                return err;
            }

            _mmmk.__clearCheckpoint();
            return {'changelog': _mmmk.__changelog()};
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
        function (_mmmk, code, desc, type, id) {
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
            let self = undefined;

            function getAttr(_attr, _id) {
                if (_id == undefined)
                    _id = id;

                if (_mmmk.model.nodes[_id] == undefined)
                    throw 'invalid getAttr() id :: ' + _id;
                else if (!(_attr in _mmmk.model.nodes[_id]))
                    throw 'invalid getAttr() attribute :: ' + _attr;

                if (_attr.charAt(0) == '$')
                    return _mmmk.model.nodes[_id][_attr];
                else if (typeof _mmmk.model.nodes[_id][_attr]['value'] == 'object')
                    return _utils.clone(_mmmk.model.nodes[_id][_attr]['value']);
                else
                    return _mmmk.model.nodes[_id][_attr]['value'];
            }

            function getAttrNames(_id) {
                if (_id == undefined)
                    _id = id;
                if (_mmmk.model.nodes[_id] == undefined)
                    throw 'invalid getAttrNames() id :: ' + _id;
                return Object.getOwnPropertyNames(_mmmk.model.nodes[_id]);
            }

            function hasAttr(_attr, _id) {
                if (_id == undefined)
                    _id = id;

                if (_mmmk.model.nodes[_id] == undefined)
                    throw 'invalid getAttr() id :: ' + _id;
                return _attr in _mmmk.model.nodes[_id];
            }

            function getAllNodes(_fulltypes) {
                if (_fulltypes != undefined && !(_fulltypes instanceof Array))
                    throw 'invalid getAllNodes() types array :: ' + _fulltypes;

                let ids = [];
                for (let _id in _mmmk.model.nodes) {
                    if (_fulltypes == undefined ||
                        _utils.contains(_fulltypes, _mmmk.model.nodes[_id]['$type']))
                        ids.push(_id);
                }
                return ids;
            }

            function getNeighbors(_dir, _type, _id) {
                if (_id == undefined)
                    _id = id;

                if (_type == undefined)
                    _type = '*';

                if (_mmmk.model.nodes[_id] == undefined)
                    throw 'invalid getNeighbors() id :: ' + _id;

                let ids = [];
                for (let i in _mmmk.model.edges) {
                    let edge = _mmmk.model.edges[i];
                    if (edge['src'] == _id &&
                        (_dir == '>' || _dir == '*' || _dir == "out") &&
                        (_type == '*' || _mmmk.model.nodes[edge['dest']]['$type'] == _type) &&
                        !_utils.contains(ids, edge['dest']))
                        ids.push(edge['dest']);
                    else if (edge['dest'] == _id &&
                        (_dir == '<' || _dir == '*' || _dir == "in") &&
                        (_type == '*' || _mmmk.model.nodes[edge['src']]['$type'] == _type) &&
                        !_utils.contains(ids, edge['src']))
                        ids.push(edge['src']);
                }
                return ids;
            }

            function print(str) {
                console.log(str);
            }

            function setAttr(_attr, _val, _id) {
                if (type != 'action')
                    throw 'setAttr() can only be used within actions';

                if (_id == undefined)
                    _id = id;

                if (_mmmk.model.nodes[_id] == undefined)
                    throw 'invalid setAttr() id :: ' + _id;
                else if (!(_attr in _mmmk.model.nodes[_id]) || _attr.charAt(0) == '$')
                    throw 'invalid setAttr() attribute :: ' + _attr;

                _mmmk.__chattr__(_id, _attr, _val);
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
        function (_mmmk, allHandlers, events, ids, handlerType) {
            let types2ids = {};
            for (let i in ids) {
                let id = ids[i];
                let type;
                if (id == _mmmk.next_id)
                    type = this.__getType(_mmmk.next_type);
                else if (_mmmk.model.nodes[id] == undefined)
                    continue;
                else
                    type = this.__getType(_mmmk.model.nodes[id]['$type']);

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
                            _mmmk,
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
                            _mmmk,
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
                            _mmmk,
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
        function (_mmmk, model) {
            let inCounts = {};
            let outCounts = {};
            let outContainments = {};
            let containmentTargets = {};

            model = (model == undefined ? _mmmk.model : model);
            let metamodels = _mmmk.metamodels;

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
                if (destType in metamodels[destMetamodel]['connectorTypes'] && metamodels[destMetamodel]['connectorTypes'][destType] == 'containment') {
                    outContainments[edge['src']].push(edge['dest']);
                }

                if (containmentTargets[edge['src']] == undefined) {
                    containmentTargets[edge['src']] = [];
                }
                if (srcType in metamodels[srcMetamodel]['connectorTypes'] && metamodels[srcMetamodel]['connectorTypes'][srcType] == 'containment') {
                    containmentTargets[edge['src']].push(edge['dest']);
                }
            }

            let checked_for_loops = [];
            for (let id in model.nodes) {
                let metamodel = this.__getMetamodel(model.nodes[id]['$type']);
                let type = this.__getType(model.nodes[id]['$type']);

                for (let i in metamodels[metamodel]['cardinalities'][type]) {
                    let cardinality = metamodels[metamodel]['cardinalities'][type][i];
                    let tc = cardinality['type'];
                    if (cardinality['dir'] == 'out' &&
                        cardinality['min'] > (outCounts[id] == undefined || outCounts[id][tc] == undefined ? 0 : outCounts[id][tc]))
                        return {'$err': 'insufficient outgoing connections of type ' + tc + ' for ' + model.nodes[id]['$type'] + '/' + id};
                    else if (cardinality['dir'] == 'in' &&
                        cardinality['min'] > (inCounts[id] == undefined || inCounts[id][tc] == undefined ? 0 : inCounts[id][tc]))
                        return {'$err': 'insufficient incoming connections of type ' + tc + ' for ' + model.nodes[id]['$type'] + '/' + id};
                }

                if (checked_for_loops.indexOf(id) < 0 && !(type in metamodels[metamodel]['connectorTypes'])) {
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

            for (let metamodel in metamodels) {

                let err = this.__runEventHandlers(_mmmk, metamodels[metamodel]['constraints'], ['validate'], [], 'constraint');
                if (err)
                    return err;
            }
        },

    /***************************** INTERNAL UTILS ******************************/
    //copied from mmmk.js
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
}