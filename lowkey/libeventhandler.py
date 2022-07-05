#  This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
#  Copyright 2011 by the AToMPM team and licensed under the LGPL
#  See COPYING.lesser and README.md in the root of this project for full details

__author__ = "Benley James Oakes"
__copyright__ = "Copyright 2022, GEODES"
__credits__ = "Eugene Syriani"
__license__ = "GPL-3.0"

import copy
import logging
import os
import re
import sys


def runDesignerAccessorCode(_mmmk, code, desc, ident):
    """
    /* runs accessor-code that conforms to the DesignerCode API and returns its
            results */
    :param _mmmk: 
    :param code: 
    :param desc: 
    :param ident: 
    :return: 
    """
    logging.debug('libeventhandler.runDesignerAccessorCode()')
    return __runDesignerCode(_mmmk, code, desc, 'accessor', ident)


def runDesignerActionCode(_mmmk, code, desc, event_type, ident):
    """
    /* runs action-code that conforms to the DesignerCode API (of interest is
        that this 'operation' is checkpointed and can thus be undone/redone; and
          that any exceptions thrown by the code cause a full rollback to before it
          was run and are then returned to the querier) */
    :param _mmmk:
    :param code:
    :param desc:
    :param event_type:
    :param ident:
    :return:
    """
    logging.debug('libeventhandler.runDesignerActionCode()')

    _mmmk.__setStepCheckpoint()

    _mmmk.__checkpoint()
    err = __runDesignerCode(_mmmk, code, desc, event_type, ident)
    if err:
        _mmmk.__restoreCheckpoint()
        return err

    _mmmk.__clearCheckpoint()
    return {'changelog': _mmmk.__changelog()}


#    /*************************** EVENT HANDLER EXEC ****************************/

def __runDesignerCode(_mmmk, code, desc, event_type, ident=None):
    """
    /* run the given constraint|action|accessor... when id is specified, we
    consider it to be the id of the node that "owns" the current
    constraint|action|accessor...

    this function is divided in 3 parts
    1. constraints/actions/accessors API definition
    2. safe_eval definition
    3. actual code that runs the handler and handles its output */
    :param _mmmk:
    :param code:
    :param desc:
    :param event_type:
    :param ident:
    :return:
    """

    """
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
    """

    """
    basic checks are made on input parameters to aid in debugging faulty
    actions and constraints... for functions with id parameters, if no
    id is given, we use the id passed to __runDesignerCode... which is
    either the id of the node that "owns" the current constraint|action|
    accessor, or undefined if the parameter was omitted */
    """

    def getAttr(_attr, _id=None):
        """
        getAttr(_attr[,_id])
        return the requested attr of the specified node... to ensure
          getAttr can't be used to edit the model, a deepcopy
          is used to return a *copy* of the attribute when its value has
        an object type (i.e., hash or array)
        """
        if not _id:
            _id = ident

        _id = str(_id)

        if _id not in _mmmk.model.nodes:
            raise KeyError('invalid getAttr() id :: ' + _id)
        elif _attr not in _mmmk.model.nodes[_id]:
            raise AttributeError('invalid getAttr() attribute :: ' + _attr)

        if _attr[0] == '$':
            return _mmmk.model.nodes[_id][_attr]

        value_type = type(_mmmk.model.nodes[_id][_attr]['value'])
        if value_type == dict or value_type == list:
            return copy.deepcopy(_mmmk.model.nodes[_id][_attr]['value'])
        else:
            return _mmmk.model.nodes[_id][_attr]['value']

    def getAttrNames(_id=None):
        if not _id:
            _id = ident
        if _id not in _mmmk.model.nodes:
            raise 'invalid getAttrNames() id :: ' + _id
        return list(_mmmk.model.nodes[_id].keys())

    def hasAttr(_attr, _id):
        """
        hasAttr(_attr[,_id])
        return true if the specified node has an attribute of the
        given name
        """
        if not _id:
            _id = ident
        if _id not in _mmmk.model.nodes:
            raise 'invalid getAttr() id :: ' + _id
        return _attr in _mmmk.model.nodes[_id]

    def getAllNodes(_fulltypes=None):
        """
        getAllNodes([_fulltypes])
        if _fulltypes is undefined, return the ids all of nodes...
        otherwise, return ids of all nodes with specified fulltypes
        """
        if _fulltypes and type(_fulltypes) != list:
            raise 'invalid getAllNodes() types array :: ' + _fulltypes

        ids = []
        for _id in _mmmk.model.nodes:
            if not _fulltypes or _mmmk.model.nodes[_id]['$type'] in _fulltypes:
                ids.append(_id)
        return ids

    def getNeighbors(_dir, _type=None, _id=None):
        """
        getNeighbors(_dir[,_type,_id])
        return all inbound (_dir = '<'), outbound (_dir = '>') or both
        (_dir = '*') neighbor ids for specified type (if any)
        """
        if not _id:
            _id = ident

        if not _type:
            _type = '*'

        if _id not in _mmmk.model.nodes[_id]:
            raise 'invalid getNeighbors() id :: ' + _id

        ids = []
        for edge in _mmmk.model.edges:
            if edge['src'] == _id and \
                    (_dir == '>' or _dir == '*' or _dir == "out") and \
                    (_type == '*' or _mmmk.model.nodes[edge['dest']]['$type'] == _type) and \
                    edge['dest'] not in ids:
                ids.append(edge['dest'])
            elif edge['dest'] == _id and \
                    (_dir == '<' or _dir == '*' or _dir == "in") and \
                    (_type == '*' or _mmmk.model.nodes[edge['src']]['$type'] == _type) and \
                    edge['src'] not in ids:
                ids.append(edge['src'])

        return ids

    def print(_str):
        """
        print(str)
        print something to the console that launched the server
        """
        sys.stdout.write(_str)

    def setAttr(_attr, _val, _id=None):
        """
        setAttr(_attr,_val[,_id])
        ((this function is only available in actions))... update the
          requested attr of the specified node using __chattr__ (s.t.
        the change is logged)...
        TBA:: type-checking on _val
        """
        if event_type != 'action':
            raise 'setAttr() can only be used within actions'

        if not _id:
            _id = ident

        if _id not in _mmmk.model.nodes:
            raise 'invalid setAttr() id :: ' + _id
        elif _attr not in _mmmk.model.nodes[_id] or _attr[0] == '$':
            raise 'invalid setAttr() attribute :: ' + _attr

        _mmmk.__chattr__(_id, _attr, _val)

    def convert_js_to_python(_code):
        """
        This function handles the conversion of the Javascript action code
        to Python. In the future, the JS action code should be rewritten.
        :param _code:
        :return:
        """
        block_comment = re.compile(r"/\*.*?\*/", re.DOTALL)
        line_comment = re.compile(r"\w*//.*")
        _code = re.sub(block_comment, "", _code)
        _code = re.sub(line_comment, "", _code)
        return _code

    def safe_eval(_code):
        """
         /* evaluate provided code without the said code having access to
        globals (i.e., model, journal) or to 'self' (which we use above to
        allow non-global functions to access globals), and catching any
        exceptions it may throw... escaped newlines if any are unescaped */
        :param _code:
        :return: 
        """
        try:
            logging.debug('libeventhandler.eval()')
            _code = convert_js_to_python(_code)

            if not _code:
                return None

            logging.debug(_code)

            # TODO: Fix this
            if "getAttr('arrow" in _code:
                opacity = 0
                if "getAttr('arrowTail" in _code and 'arrow-black-large' in _code: opacity = 1
                return {'style' : {"stroke": "#000000",
                 "fill": "#000000",
                 "opacity": opacity,
                 "stroke-width": 1} }

            # create a mapping for the code to access these functions
            designer_funcs = {
                 'getAttr': getAttr,
                 'getAttrNames': getAttrNames,
                 'hasAttr': hasAttr,
                 'getAllNodes': getAllNodes,
                 'getNeighbors': getNeighbors,
                 'print': print,
                 'setAttr': setAttr,
            }

            if "\n" in _code:
                # this is multi-line, need to assign 'val' in code
                _locals = {'val': None}
                co = compile(_code, '<string>', 'exec')
                exec(co, designer_funcs, _locals)
                return _locals['val']
            else:
                # this is single line, can return last value in code
                co = compile(_code, '<string>', 'eval')
                return eval(co, designer_funcs)
        except Exception as err:
            logging.debug(err)
            if "invalid syntax" in str(err):
                # ignore Javascript code for now
                return {}
            if 'IgnoredConstraint' in str(err):
                return True
            return {'$err': str(err)}

    logging.debug('libeventhandler.__runDesignerCode()')

    res = safe_eval(code)

    logging.debug("Result: " + str(res))

    if res is not None and type(res) is dict and '$err' in res:
        return {'$err': event_type + ' (' + desc + ') crashed on :: ' + res['$err']}

    # /* completed accessor */
    elif event_type == 'accessor':
        return res

    # /* failed constraint */
    elif not res:
        return {'$err': event_type + ' (' + desc + ') failed'}


def __runEventHandlers(_mmmk, allHandlers, events, ids, handlerType):
    """
     /* run actions or constraints for specified events and specified nodes

    1. get types of specified nodes (note that we do a little hack for the
        special case of pre-create handlers because this.model.nodes does not
        yet contain a node with the to-be-created node's id... thus its type
        is read from this.next_type)
    2. identify and run applicable handlers based on events and targetTypes */
    :param _mmmk:
    :param allHandlers:
    :param events:
    :param ids:
    :param handlerType:
    :return:
    """
    logging.debug('libeventhandler.__runEventHandlers()')
    types2ids = {}
    for ident in ids:
        if ident == _mmmk.next_id:
            _type = __getType(_mmmk.next_type)
        elif ident not in _mmmk.model.nodes:
            continue
        else:
            _type = __getType(_mmmk.model.nodes[ident]['$type'])

        if _type not in types2ids:
            types2ids[_type] = []
        types2ids[_type].append(ident)

    for handler in allHandlers:

        handled = handler['event'] in events or (
                    "validate" in events and handler['event'] == "")  # handle legacy events

        if not handled:
            continue

        if handler['targetType'] == '*':
            result = None
            for _id in ids:
                result = __runDesignerCode(
                    _mmmk,
                    handler['code'],
                    handler['event'] + ' ' + handler['name'],
                    handlerType,
                    _id)
                if result:
                    return result

            if len(ids) == 0:
                result = __runDesignerCode(
                    _mmmk,
                    handler['code'],
                    handler['event'] + ' ' + handler['name'],
                    handlerType)

                if result:
                    return result

        elif handler['targetType'] in types2ids:
            for _id in types2ids[handler['targetType']]:
                result = __runDesignerCode(
                    _mmmk,
                    handler['code'],
                    handler['event'] + ' ' + handler['name'],
                    handlerType,
                    _id)

                if result:
                    return result


# /**************************** MODEL VALIDATION *****************************/

def validateModel(_mmmk, model=None):
    """
    /* verifies that the current model satisfies (1) the min cardinalities set
    by its metamodel(s) and (2) all global eventless constraints... returns
    the first encountered discrepancy or nothing

    1. count incoming and outgoing connections of each type for each node
    2. compare the above to the min cardinalities
    3. run all global eventless constraints */
    :param _mmmk:
    :param model:
    :return:
    """
    logging.debug('libeventhandler.validateModel()')
    inCounts = {}
    outCounts = {}
    outContainments = {}
    containmentTargets = {}

    if not model:
        model = _mmmk.model

    metamodels = _mmmk.metamodels

    if not model.nodes or \
            not model.edges or \
            not model.metamodels or \
            len(model.metamodels.length) == 0:
        return {'$err': 'provided model is either empty or not an atompm model'}

    for edge in model.edges:
        srcType = __getType(model.nodes[edge['src']]['$type'])
        destType = __getType(model.nodes[edge['dest']]['$type'])
        srcMetamodel = __getMetamodel(model.nodes[edge['src']]['$type'])
        destMetamodel = __getMetamodel(model.nodes[edge['dest']]['$type'])

        if edge['dest'] not in inCounts:
            inCounts[edge['dest']] = {}
        if srcType not in inCounts[edge['dest']]:
            inCounts[edge['dest']][srcType] = 0
        inCounts[edge['dest']][srcType] += 1

        if edge['src'] not in outCounts:
            outCounts[edge['src']] = {}
        if destType not in outCounts[edge['src']]:
            outCounts[edge['src']][destType] = 0
        outCounts[edge['src']][destType] += 1

        if edge['src'] not in outContainments:
            outContainments[edge['src']] = []

        if destType in metamodels[destMetamodel]['connectorTypes'] and metamodels[destMetamodel]['connectorTypes'][
            destType] == 'containment':
            outContainments[edge['src']].append(edge['dest'])

        if edge['src'] not in containmentTargets:
            containmentTargets[edge['src']] = []

        if srcType in metamodels[srcMetamodel]['connectorTypes'] and metamodels[srcMetamodel]['connectorTypes'][
            srcType] == 'containment':
            containmentTargets[edge['src']].append(edge['dest'])

    checked_for_loops = []
    for _id in model.nodes:
        _metamodel = __getMetamodel(model.nodes[_id]['$type'])
        _type = __getType(model.nodes[_id]['$type'])

        for cardinality in metamodels[_metamodel]['cardinalities'][_type]:
            tc = cardinality['type']

            if cardinality['dir'] == 'out':
                out_tc = 0
                if _id in outCounts[_id] and tc in outCounts[_id]:
                    out_tc = outCounts[_id][tc]
                if cardinality['min'] > out_tc:
                    return {'$err': 'insufficient outgoing connections of type ' + tc + ' for ' + model.nodes[_id][
                        '$type'] + '/' + _id}
            elif cardinality['dir'] == 'in':
                in_tc = 0
                if _id in inCounts[_id] and tc in inCounts[_id]:
                    in_tc = inCounts[_id][tc]
                if cardinality['min'] > in_tc:
                    return {'$err': 'insufficient incoming connections of type ' + tc + ' for ' + model.nodes[_id][
                        '$type'] + '/' + _id}

        if _id not in checked_for_loops and _type not in metamodels[_metamodel]['connectorTypes']:
            visited = []
            tv = [_id]

            def dfs(to_visit):
                if not to_visit:
                    return None  # no more to check
                curr = to_visit.pop()
                if curr in visited:
                    return {'$err': 'containment loop found for ' + model.nodes[_id][
                        '$type'] + '/' + _id}  # // error: loop found!
                else:
                    visited.append(curr)
                    # find all (containment) associations linked to the object, and add their targets to the to_visit list.
                    for oc in outContainments[curr]:
                        to_visit = to_visit + containmentTargets[oc]
                    return dfs(to_visit)

            res = dfs(tv)
            if res:
                return res

            checked_for_loops = checked_for_loops + visited

    for _metamodel in metamodels:
        err = __runEventHandlers(_mmmk, metamodels[_metamodel]['constraints'], ['validate'], [], 'constraint')
        if err:
            return err


# /***************************** INTERNAL UTILS ******************************/
def __getMetamodel(fulltype):
    """
    /* splits a full type of the form '/path/to/metamodel/type' and returns
    '/path/to/metamodel' */
    :param fulltype:
    :return:
    """
    logging.debug('PyMMMK.__getMetamodel()')
    return os.path.dirname(fulltype)


def __getType(fullType):
    """
    /* splits a full type of the form '/path/to/metamodel/type' and returns
      'type' */
    :param fullType:
    :return:
    """
    logging.debug('PyMMMK.__getType()')
    return os.path.basename(fullType)
