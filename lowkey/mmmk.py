#  This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
#  Copyright 2011 by the AToMPM team and licensed under the LGPL
#  See COPYING.lesser and README.md in the root of this project for full details
import ast
import copy
import json
import os.path
import re
import argparse
import logging
import os
import sys
import threading
import json
import urllib

import requests as req

from libeventhandler import __runEventHandlers as runEventHandlers
from libeventhandler import runDesignerAccessorCode

from MMMKModel import Model

from lowkey.network.Client import Client

__author__ = "Istvan David, Benley James Oakes"
__copyright__ = "Copyright 2022, GEODES"
__credits__ = "Eugene Syriani"
__license__ = "GPL-3.0"

class PyMMMK(Client):
    __encoding = "utf-8"

    def __init__(self):
        logging.debug('PyMMMK.__init()__')
        super().__init__()
        
        self.metamodels = {}
        self.model = Model()
        self.name = ''

        self.next_id = 0

        self.journal = []
        self.journalIndex = 0

        self.undoredoJournal = []

    ########## lowkey client functionality ########## 

    def run(self):
        connection_thread = threading.Thread(target=self.subscribe, args=())
        connection_thread.daemon = True
        #logging.debug("{}: Starting connection thread".format(self.__name))
        connection_thread.start()
    
    # Join a server and receive the updates
    def join(self):
        self._snapshot.send(b"request_snapshot")
        while True:
            try:
                receviedMessage = self._snapshot.recv()
                #logging.debug("{}: Received message from server.".format(self.__name))
                _, message = self.getMessage(receviedMessage)
                self.processMessage(message)
            except:
                return  # Interrupted
            if message == b"finished_snapshot":
                logging.info("{}: Received snapshot".format(self.__name))
                break  # Done
    
    # The behavior that will be executed in the polling loop
    def subscriberAction(self):
        if not self.__listen:
            return
        
        logging.info("{}: Received message from lowkey.".format(self.__name))
        receviedMessage = self._subscriber.recv()
        senderId, senderType, senderName, op, args = self.getMessage(receviedMessage)
        
        if self.throwawayMessage(senderId, senderType, senderName):
            #logging.debug("{}: Throwing message {} ### {}".format(self.__name, op, args))
            pass
        else:
            logging.info("{}: Processing message {} ### {}".format(self.__name, op, args))
            self.processMessage(op, args)
            
    def listen(self, listen = True):
        self.__listen = listen

    '''
    Message production
    '''
    def messageToBeForwarded(self, command):
        return command in ["create", "loadMetamodel"]
    
    def createMessage(self, body):
        return bytes('[{}] {}'.format(self._id, body), self.__encoding)
        
    '''
    Message processing
    '''

    def getMessage(self, rawMessage):
        #return rawMessage.decode(self.__encoding).split('###', 2)
        senderId, message = rawMessage.decode(self.__encoding).split(' ', 1)
        senderId = senderId.replace('[', '').replace(']', '')
        senderType, senderName, op, args = message.split('###')
        senderType = senderType.split(':', 1)[1].strip()
        senderName = senderName.split(':', 1)[1].strip()
        op = op.split(':', 1)[1].strip()
        args = args.split(':', 1)[1].strip()
        return senderId, senderType, senderName, op, args
        
    def throwawayMessage(self, senderId, senderType, senderName):
        #logging.debug("{}: Checking if message is throwaway. SenderID: {}. My ID: {}. SenderType: {}. My type:{}. SenderName: {}. My name:{}.".format(self.__name, senderId, self._id, senderType, self.__type, senderName, self.__name))
        sameType = senderType == self.__type
        logging.info("{}: Comparing {} to {}. Same? {}.".format(self.__name, senderType, self.__type, sameType))
        sameName = senderName == self.__name
        #logging.debug("{}: Comparing {} to {}. Same? {}.".format(self.__name, senderName, self.__name, sameName))
        #logging.debug("{}: Same type? {}. Same name? {}.".format(self.__name, sameType, sameName))
        throwaway = (not sameType) or sameName
        #logging.debug("{}: Throwaway? {}.".format(self.__name, throwaway))
        return throwaway

    def processMessage(self, op, args):
        logging.info("{}: ProcessingMessage...........................".format(self.__name))
        args = ast.literal_eval(args)
        #logging.info("{}: args: {}. type: {}.".format(self.__name, args, type(args)))
        
        logging.info("{}: I'm now going to call dispatch with remote = True".format(self.__name))
        self.dispatch(op, args, remote = True)

    
    '''
    Timeout action
    '''
    def timeoutAction(self):
        pass    


    ############################## MMMK functionality ##############################
    '''
    This is the single point of entry from lowkey's point of view.
    '''
    def dispatch(self, op, args, remote = False):
        logging.info('PyMMMK.dispatch')
        logging.info("{}: args: {}. type: {}.".format(self.__name, args, type(args)))
        method_to_call = getattr(self, op)
        logging.info('PyMMMK -- calling self.{}'.format(op))
        logging.info('{}: PyMMMK -- calling self.{}, args:{}, remote:{}'.format(self.__name, op, args, remote))
        
        res = method_to_call(*args)
        
        logging.info(args)
        
        if self.messageToBeForwarded(op) and not remote:
            #If the message is the type that others need to now about (e.g., create) AND this message doesn't come from someone else.
            #If the message comes from someone else, its distribution has been taken care of already.
            logging.info("Sending message to lowkey")
            message = self.createMessage(f"senderType:{self.__type} ### senderName:{self.__name} ### op:{op} ### args:{args}")
            self._publisher.send(message)
        
        with open("model.json", "w") as outfile:
            json.dump(self.model.to_dict(), outfile)
        
        if remote:
            # send the changelog to the session manager
            # to inform listening workers/clients
            encoded_changelog = urllib.parse.quote(str(res))
            _wid = re.findall(r'\d+', self.__name)[0]
            _url = 'http://localhost:8124/atompm/' + 'changelogPush' + '?wid=' + str(_wid) + '&changelog=' + encoded_changelog
            print("Sending HTTP message")
            print(_url)
            x = req.post(_url)
            logging.info(x.text)
        
        logging.info('{}: Classes in the model: {}.'.format(self.__name, len(self.model.nodes)))
        
        return res
        
    '''
    This is a temporary method here for minimizing API break. This info should be passed in the constructor.
    '''
    def setName(self, workerName):
        self.__name = workerName
        
    def setType(self, workerType):
        self.__type = workerType
        
    def setManager(self, manager):
        self.__manager = manager

    '''
    This is needed for the CSWorker
    '''
    def getNextID(self):
        return self.next_id

    #/********************************* ENV SETUP *******************************/

    def clone(self, clone):
        """
        # /* produce a bundle of internal state variables sufficient to fully clone
        # this instance
        # OR
        # use a provided bundle to overwrite this instance's internal state */
        :param clone:
        :return:
        """
        logging.debug('PyMMMK.clone()')

        if clone:
            self.metamodels = clone.metamodels
            self.model = clone.model
            self.name = clone.name
            self.next_id = clone.next_id
            self.journal = clone.journal
            self.journalIndex = clone.journalIndex
            self.undoredoJournal = clone.undoredoJournal
        else:
            return copy.deepcopy({
                'metamodels': self.metamodels,
                'model': self.model,
                'name': self.name,
                'next_id': self.next_id,
                'journal': self.journal,
                'journalIndex': self.journalIndex,
                'undoredoJournal': self.undoredoJournal
            })


    def loadModel(self, name, model, insert):
        """
        # load a model into this.model
        #
        #     0. create step-checkpoint
        #     1. make sure all required metamodels are loaded
        #     2. if 'insert' is specified,
        #         a) append 'model' to this.model (via __resetm__)
        #     2. otherwise, load 'model' into this.model and 'name' into this.name
        #         (via __resetm__)
        :param name:
        :param model:
        :param insert:
        :return:
        """
        logging.debug('PyMMMK.loadModel()')
        self.__setStepCheckpoint()

        new_model = json.loads(model)
        for mm in new_model["metamodels"]:
            if not mm in self.metamodels:
                return {'$err': 'metamodel not loaded :: ' + mm}

        self.__resetm__(name, model, insert)
        return {'changelog': self.__changelog()}


    def loadMetamodel(self, name, mm):
        """
        # load a metamodel
        #
        # 0. create a step - checkpoint
        # 1. load metamodel into this.model.metamodels and this.metamodels
        # (via__loadmm__)
        :param name:
        :param mm:
        :return:
        """
        logging.debug('PyMMMK.loadMetamodel()')
        self.__setStepCheckpoint()

        self.__loadmm__(name, mm)
        return {'changelog': self.__changelog()}


    def unloadMetamodel(self, name):
        """
        # /* unload a metamodel and delete all entities from that metamodel
        #
        # 0. create a step-checkpoint
        # 1. deletes nodes from specified metamodel
        # 2. delete edges where deleted nodes appear
        # 3. remove metamodel from this.model.metamodels and this.metamodels
        #     (via __dumpmm__) */
        :param name:
        :return:
        """
        logging.debug('PyMMMK.unloadMetamodel()')
        self.__setStepCheckpoint()

        edges_to_remove = []
        for i, edge in enumerate(self.model.edges):
            if (self.__getMetamodel(self.model.nodes[edge['src']]['$type']) == name or
            self.__getMetamodel(self.model.nodes[edge['dest']]['$type']) == name):
                edges_to_remove.append(i)
        for i in edges_to_remove:
            self.__rmedge__(i)

        nodes_to_remove = []
        for ident in self.model.nodes:
            if self.__getMetamodel(self.model.nodes['$type']) == name:
                nodes_to_remove.append(ident)
        for ident in nodes_to_remove:
            self.__rmnode__(ident)

        self.__dumpmm__(name)
        return {'changelog': self.__changelog()}

    # /******************************** MODEL CRUD *******************************/

    def __crudOp(self, metamodel, events, eventTargets, op, args):
        """
        # /* wraps crud operations with generic boilerplate
        #
        # 0. setup next_type hack : the next_type variable is used to carry the type
        #     of the to-be-created node for the special case of pre-create handlers
        #     because their target nodes aren't yet in this.model.nodes
        # 1. create a checkpoint (any failure along the way causes checkpoint
        #     restore)
        # 2. run all applicable pre-events constraints and actions
        # 3. perform the specified crud operation
        # 4. run all applicable post-events actions and constraints
        # 5. clear unused checkpoint */
        :param metamodel:
        :param events:
        :param eventTargets:
        :param op:
        :param args:
        :return:
        """
        logging.debug('PyMMMK.__crudOp()')
        if not self.metamodels[metamodel]:
            return {'$err': 'metamodel not loaded :: ' + metamodel}

        if 'create' in events:
            if "fulltype" in args:
                self.next_type = args["fulltype"]
            else:
                self.next_type = args["connectorType"]

        self.__checkpoint()

        pre_events = ['pre-' + ev for ev in events]
        post_events = ['post-' + ev for ev in events]

        class ErrorRaised(Exception):
            def __init__(self, _err):
                self.err = _err

        try:
            err = runEventHandlers(self, self.metamodels[metamodel]['constraints'], pre_events, eventTargets, 'constraint')
            if err: raise ErrorRaised(err)

            err = runEventHandlers(self, self.metamodels[metamodel]['actions'], pre_events, eventTargets, 'action')
            if err: raise ErrorRaised(err)

            method_to_call = getattr(self, op)
            err = method_to_call(args)
            if err: raise ErrorRaised(err)

            err = runEventHandlers(self, self.metamodels[metamodel]['actions'], post_events, eventTargets, 'action')
            if err: raise ErrorRaised(err)

            err = runEventHandlers(self, self.metamodels[metamodel]['constraints'], post_events, eventTargets, 'constraint')
            if err: raise ErrorRaised(err)

        except ErrorRaised as e:
            self.__restoreCheckpoint()
            logging.debug("Error in crudOp: " + str(e.err))
            return e.err
        self.__clearCheckpoint()

    # /* connect specified nodes with instance of connectorType */

    def _connectNN(self, args): #/*id1,id2,connectorType,attrs*/
        """
        # _connectNN: (connect 2 nodes)
        # 1. run pre-connect on end nodes
        # 2. run _create to create instance and connect it to end nodes
        # 3. run post-connect on end nodes
        :param args:
        :return:
        """
        logging.debug('PyMMMK._connectNN()')
        return self.__crudOp(
                self.__getMetamodel(args["connectorType"]),
                ['connect'],
                [args["id1"], args["id2"]],
                '_create',
                {
                    'fulltype': args["connectorType"],
                    'id1': args["id1"],
                    'id2': args["id2"],
                    'attrs': args["attrs"]
                })


    def __connectCN(self, args): #/*id1,id2,connectorId*/
        """
        # __connectCN: (connect 1 node and 1 connector)
        # 1. add an appropriate edge to this.model.edges
        :param args:
        :return:
        """
        logging.debug('PyMMMK.__connectCN()')
        self.__mkedge__(args["id1"], args["id2"])


    def connect(self, id1, id2, connectorType, attrs):
        """
        # connect:
        # 0. create a step-checkpoint
        # 1. verify validity of requested connection (i.e., connection is legal
        #       and max cardinalities haven't been reached)
        # 2. if one of the nodes is a connector
        #     a) run pre-connect on end nodes
        #     b) create appropriate new edge between them (via __connectCN)
        #     c) run post-connect on end nodes
        # 2. if both nodes are non-connectors
        #     a) run pre-create on connectorType
        #     b) create connectorType instance and connect it to end nodes (via
        #           _connectNN)
        #     c) run post-create on connectorType
        # 3. return err or (new or existing) connector's id */
        :param id1:
        :param id2:
        :param connectorType:
        :param attrs:
        :return:
        """
        logging.debug('PyMMMK.connect()')
        self.__setStepCheckpoint()

        metamodel = self.__getMetamodel(connectorType)
        t1 = self.__getType(self.model.nodes[id1]['$type'])
        t2 = self.__getType(self.model.nodes[id2]['$type'])
        tc = self.__getType(connectorType)
        if t1 == tc:
            _into = t2
        else:
            _into = tc
        if t2 == tc:
            _from = t1
        else:
            _from = tc
        card_into = None
        card_from = None
        num_id1to = 0
        num_toid2 = 0

        for t in [t1, '$*', '__p$*']:
            if t not in self.metamodels[metamodel]['cardinalities']:
                continue

            for card in self.metamodels[metamodel]['cardinalities'][t]:
                if card['type'] == _into and card['dir'] == 'out':
                    card_into = card
                    break

        for t in [t2, '$*', '__p$*']:
            if t not in self.metamodels[metamodel]['cardinalities']:
                continue

            for card in self.metamodels[metamodel]['cardinalities'][t]:
                if card['type'] == _from and card['dir'] == 'in':
                    card_from = card
                    break

        if card_into is None or card_from is None:
                return {'$err': 'can not connect types ' + t1 + ' and ' + t2}
        elif card_into['max'] == 0:
            return {'$err': 'maximum outbound multiplicity reached for ' + t1 + ' (' + id1 + ') and type ' + _into}
        elif card_from['max'] == 0:
            return {'$err': 'maximum inbound multiplicity reached for ' + t2 + ' (' + id2 + ') and type ' + _from}

        for edge in self.model.edges:
            if edge['src'] == id1 and self.__getType(self.model.nodes[edge['dest']]['$type']) == _into:
                num_id1to += 1
                if card_into['max'] != "Infinity" and num_id1to >= int(card_into['max']):
                    return {'$err': 'maximum outbound multiplicity reached for ' + t1 + ' (' + id1 + ') and type ' + _into}

            if edge['dest'] == id2 and self.__getType(self.model.nodes[edge['src']]['$type']) == _from:
                num_toid2 += 1
                if card_from['max'] != "Infinity" and num_toid2 >= int(card_from['max']):
                    return {'$err': 'maximum inbound multiplicity reached for ' + t2 + ' (' + id2 + ') and type ' + _from}

        if t1 == tc or t2 == tc:
            if t1 == tc:
                connectorId = id1
            else:
                connectorId = id2

            err = self.__crudOp(
                metamodel,
                ['connect'],
                [id1, id2],
                '__connectCN',
                {
                    'id1': id1,
                    'id2': id2,
                    'connectorId': connectorId
                })

            if err:
                return err
            else:
                return {
                    'id': connectorId,
                    'changelog': self.__changelog()
                }
        else:
            err = self.__crudOp(
                metamodel,
                ['create'],
                [self.next_id],
                '_connectNN',
                {
                    'id1': id1,
                    'id2': id2,
                    'connectorType': connectorType,
                    'attrs': attrs
                })
            if err:
                return err
            else:
                old_id = self.next_id
                self.next_id += 1
                return {
                    'id': old_id,
                    'changelog': self.__changelog()
                }

    def _create(self, args):
        """
        1. create [default] instance using metamodel [and possibly specified attrs] + init $type
        2. add to current model nodes
        3. if fulltype is a connectorType, create edges between node id1
        and new instance and between new instance and node id2
        :param args:
        :return:
        """
        logging.debug('PyMMMK._create()')

        metamodel = self.__getMetamodel(args["fulltype"])
        fulltype = self.__getType(args["fulltype"])

        if not fulltype in self.metamodels[metamodel]['types']:
            return {'$err': 'can not create instance of unknown type :: ' + args["fulltype"]}

        typeAttrs = self.metamodels[metamodel]['types'][fulltype]

        new_node = {}
        for attr in typeAttrs:
            val = attr["default"]
            if args["attrs"] and attr['name'] in args["attrs"]:
                val = args["attrs"][attr["name"]]
            new_node[attr["name"]] = {
                'type' : attr["type"],
                'value' : copy.deepcopy(val)
            }
        new_node['$type'] = args["fulltype"]

        self.__mknode__(self.next_id, new_node)

        if "id1" in args:
            self.__mkedge__(args["id1"], str(self.next_id))
            self.__mkedge__(str(self.next_id), args["id2"])

    def create(self, fullType, attrs):
        logging.debug('PyMMMK.create()')
        logging.debug('{}: PyMMMK.create() -- fullType: {}, attrs: {}.'.format(self.__name, fullType, attrs))
        """
        0. create a step-checkpoint
        1. wrap _create in crudOp
        2. return err or new instance id
        :param fullType:
        :param attrs:
        :return:
        """
        self.__setStepCheckpoint()

        err = self.__crudOp(
            self.__getMetamodel(fullType),
            ['create'],
            [self.next_id],
            '_create',
            {
                'fulltype': fullType,
                'attrs':attrs
            }
        )
        if err:
            return err
        ret = {'id': self.next_id,
               'changelog': self.__changelog()}
        self.next_id += 1
        return ret

    def _delete(self, args):
        """
        _delete:
            1. determine specified node's neighbors
            2. if specified node is a connector (neighbors are non-connectors),
                a) run pre-disconnect constraints and actions and on its neighbors
                b) delete it and all appropriate edges (via __deleteConnector)
                c) run post-disconnect constraints and actions and on its neighbors
            2. if specified node is not a connector (neighbors are connectors),
                a) recursively run __delete on each of its neighbors
                b) delete it
        :param args:
        :return:
        """
        logging.debug('PyMMMK._delete()')
        ident = args["id"]
        metamodel = self.__getMetamodel(self.model.nodes[ident]['$type'])
        n_type = self.__getType(self.model.nodes[ident]['$type'])
        isConnector = n_type in self.metamodels[metamodel]['connectorTypes']
        neighbors = []

        for edge in self.model.edges:
            if edge['src'] == ident and edge['dest'] not in neighbors:
                neighbors.append(edge['dest'])
            elif edge['dest'] == ident and edge['src'] not in neighbors:
                neighbors.append(edge['src'])

        if isConnector:
            res = self.__crudOp(
                metamodel,
                ['disconnect'],
                neighbors,
                '_deleteConnector',
                {'id': ident}
            )
            if res: return res
        else:
            for neighbor in neighbors:
                res = self.__crudOp(
                    metamodel,
                    ['delete'],
                    [neighbor],
                    '_delete',
                    {'id': neighbor}
                )
                if res: return res
            self.__rmnode__(ident)

    def _deleteConnector(self, args):
        """
        _deleteConnector:
            1. delete all appropriate edges then delete node
        :param args:
        :return:
        """
        logging.debug('PyMMMK._deleteConnector()')
        # gather all the indices to remove
        indices = []
        for i, edge in enumerate(self.model.edges):
            if edge['src'] == args["id"] or edge['dest'] == args["id"]:
                indices.append(i)

        # make a count to adjust future indices
        num_removed = 0
        for i in indices:
            self.__rmedge__(i - num_removed)
            num_removed += 1

        # remove the connector node itself
        self.__rmnode__(args["id"])

    def delete(self, ident):
        """
        0. create a step-checkpoint
        1. wrap __delete in crudOp
        2. return err or nothing */
        :param ident:
        :return:
        """
        logging.debug('PyMMMK.delete()')
        self.__setStepCheckpoint()

        ident = str(ident)

        if ident not in self.model.nodes:
            return {'$err': 'invalid id :: ' + ident}

        err = self.__crudOp(
            self.__getMetamodel(self.model.nodes[ident]['$type']),
            ['delete'],
            [ident],
            '_delete',
            {'id': ident}
        )
        if err: return err
        return {'changelog': self.__changelog()}


    def read(self, ident=None, attr=None):
        """
        # returns the stringified full model,
        # a stringified node,
        # or a copy of an attribute's value
        :param ident:
        :param attr:
        :return:
        """
        logging.debug('PyMMMK.read(' + str(ident) + ', ' + str(attr) + ')')
        curr = None
        if ident is None:
            return json.dumps(self.model.to_dict())

        ident = str(ident)

        if ident not in self.model.nodes:
            print(self.model.nodes.keys())
            return {'$err': 'instance not found :: ' + ident}

        if not attr:
            return json.dumps(self.model.nodes[ident])

        if re.match(r".+/.+", str(attr)):
            curr = self.model.nodes[ident]
            path = attr.split('/')
            for p in path:
                if p in curr:
                    curr = curr[p]
                else:
                    return {'$err': 'instance ' + ident + ' has no attribute :: ' + attr}

        elif not attr in self.model.nodes[ident]:
            return {'$err': 'instance ' + ident + ' has no attribute :: ' + attr}

        attrVal = None
        if curr:
            attrVal = curr['value']
        else:
            attrVal = self.model.nodes[ident][attr]['value']

        if type(attrVal) is dict:
            return copy.deepcopy(attrVal)
        else:
            return attrVal

    def readMetamodels(self, metamodel=None):
        """
        /* returns a copy of one or all metamodels in this.metamodels */
        :param metamodel:
        :return:
        """
        logging.debug('PyMMMK.readMetamodels(' + str(metamodel) + ')')
        if metamodel is None:
            return json.dumps(self.metamodels)
        elif metamodel not in self.metamodels:
            return {'$err': 'metamodel not found :: ' + metamodel}
        else:
            return json.dumps(self.metamodels[metamodel])


    def readName(self):
        """
        # returns self.name
        :return:
        """
        logging.debug('PyMMMK.readName()')
        return self.name


    def _update(self, args):
        logging.debug('PyMMMK._update()')
        """
        1. update instance as per data
        2. return err on unknown attributes
        3. TBA: type verification on new values
        :param args:
        """
        for attr in args["data"]:
            if args["data"][attr] is None:
                return {"$err": 'tried to set attribute ' + str(attr) + ' to "null"'}

            res = self.read(args["id"], attr)
            if type(res) is dict and '$err' in res:
                return res

            self.__chattr__(args["id"], attr, args["data"][attr])

    def update(self, ident, data):
        logging.debug('PyMMMK.update(' + str(ident) + ')')
        """
        0. create a step-checkpoint
        1. wrap _update in crudop
        2. return err or nothing
        :param ident:
        :param data:
        :return:
        """
        self.__setStepCheckpoint()

        ident = str(ident)

        if not ident in self.model.nodes:
            return {'$err': 'invalid id: ' + str(ident)}

        err = self.__crudOp(
            self.__getMetamodel(self.model.nodes[ident]['$type']),
            ['edit'],
            [ident],
            '_update',
            {
                'id': ident,
                'data': data
            }
        )
        if err: return err
        return {'changelog': self.__changelog()}


    def runDesignerAccessorCode(self, code, desc, ident):
        """
        Forwards this request to the libeventhandler.
        :param code:
        :param desc:
        :param ident:
        :return:
        """
        return runDesignerAccessorCode(self, code, desc, ident)

    # /************************* JOURNALING + UNDO/REDO **************************/

    # /* NOTE: on this.undoredoJournal
    # this.undoredoJournal contains cud operations performed during the last
    # undo()/redo() call provided no user-operations was performed since the
    # said call (in which case this.undoredoJournal is empty)... undo/redo
    # ops need to be logged for __changelog() to be able to return their
    # effects... however, they should not be logged in the main journal since
    #   all they conceptually do is move a cursor in it... in practice,
    # this.undoredoJournal is emptied on every call to undo(), redo() and
    # __setStepCheckpoint() */
    def __checkpoint(self):
        """
        /*	create a checkpoint : add an entry in the log used as a delimiter to know
          where to stop when restoring (i.e., undoing failed pre-/post-actions or
        crud ops) */
        :return:
        """
        logging.debug('PyMMMK.__checkpoint()')
        self.__log({'op': 'MKCHKPT'})

    def __clearCheckpoint(self):
        """
        /* deletes the last checkpoint of the current model (other than tidying the
          journal, there's no reason for ever clearing unused checkpoints) */
        :return:
        """
        logging.debug('PyMMMK.__clearCheckpoint()')
        for i in range(len(self.journal)-1, 0, -1):
            if self.journal[i]["op"] == 'MKCHKPT':
                self.journal.pop(i)
                self.journalIndex -= 1
                break

    def __changelog(self):
        """
         /* case 1: 'this.undoredoJournal is defined (possibly empty)'
        returns the operations performed by the last undo()/redo()
        case 2: 'this.undoredoJournal = undefined'
        returns a copy of the portion of the journal that describes the changes
          made by the last user-operation... note that user-operations always call
        __setStepCheckpoint before running */
        :return:
        """
        logging.debug('PyMMMK.__changelog()')
        
        if self.undoredoJournal:
            ret = copy.deepcopy(self.undoredoJournal)
            self.undoredoJournal = []
            return ret

        ji = self.journalIndex
        while ji > 0:
            ji -= 1
            if self.journal[ji]['op'] == 'MKSTPCHKPT':
                break
        return self.journal[ji + 1: self.journalIndex]

    def __log(self, step, log=None):
        """
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
        :param step:
        :param log:
        :return:
        """
        logging.debug('PyMMMK.__log()')
        if not log:
            if self.journalIndex != len(self.journal):
                self.journal = self.journal[:self.journalIndex]
            self.journal.append(step)
            self.journalIndex += 1
        elif log == 'UNDOREDO':
            self.undoredoJournal.append(step)

        elif log == 'DONTLOG':
            pass

    def __redo(self, step):
        """
        /* redo a single step
        1. identify the nature of the logged operation
        2. reproduce its effects (these are logged in this.undoredoJournal) */
        :param step:
        :return:
        """
        logging.debug('PyMMMK.__redo()')
        log = 'UNDOREDO'
        if step['op'] == 'CHATTR': self.__chattr__(step['id'], step['attr'], step['new_val'], log)
        elif step['op'] == 'DUMPMM': self.__dumpmm__(step['name'], log)
        elif step['op'] == 'LOADMM': self.__loadmm__(step['name'], step['mm'], log)
        elif step['op'] == 'MKEDGE': self.__mkedge__(step['id1'], step['id2'], step['i'], log)
        elif step['op'] == 'MKNODE': self.__mknode__(step['id'], json.loads(step['node']), log)
        elif step['op'] == 'RESETM': self.__resetm__(step['new_name'], step['new_model'], False, log)
        elif step['op'] == 'RMEDGE': self.__rmedge__(step['i'], log)
        elif step['op'] == 'RMNODE': self.__rmnode__(step['id'], log)

    def redo(self, uchkpt):
        """
        /* redo all of the changes until the next step-checkpoint or until after the
        specified user-checkpoint, if any... when complete the journal index is
        after the redone MKSTPCHKPT/MKUSRCHKPT entry... redoing when the journal
        index is at the end of the journal will have no effect */
        :param uchkpt:
        :return:
        """
        logging.debug('PyMMMK.redo()')
        self.undoredoJournal = []
        uchkptEncountered = False
        def uchkptReached(step):
            return step['op'] == 'MKUSRCHKPT' and step['name'] == uchkpt

        def uchkptFound(i):
            for j in range(i, len(self.journal)):
                if uchkptReached(self.journal[j]):
                    return True
            return False

        def stopMarkerReached(step):
            if not uchkpt:
                return step['op'] == 'MKSTPCHKPT'
            else:
                return uchkptEncountered and step['op'] == 'MKUSRCHKPT'

        if not uchkpt or uchkptFound(self.journalIndex):
            while self.journalIndex < len(self.journal):
                if uchkpt and not uchkptEncountered and uchkptReached(self.journal[self.journalIndex]):
                    uchkptEncountered = True
                self.journalIndex += 1
                if self.journalIndex >= len(self.journal) or stopMarkerReached(self.journal[self.journalIndex]):
                    break
                else:
                    self.__redo(self.journal[self.journalIndex])

        return {'changelog': self.__changelog()}

    def __restoreCheckpoint(self):
        """
        /*	undo every logged operation until a MKCHKPT is reached (and remove them
        and the said MKCHKPT from the journal)... note that this operation is only
        called internally and that the journalIndex will always be at the end of
        the journal when it's called (and after its called) */
        :return:
        """
        logging.debug('PyMMMK.__restoreCheckpoint()')
        while len(self.journal) > 0:
            step = self.journal.pop()
            if step["op"] == 'MKCHKPT':
                break
            else:
                self.__undo(step, 'DONTLOG')
        self.journalIndex = len(self.journal)

    def __setStepCheckpoint(self):
        """
        /*	create a step-checkpoint : add an entry in the log used as a delimiter to
        know where to stop when undoing/redoing (i.e., on client undo/redo)
        1. create new step-checkpoint or re-use a 'zombie' step-checkpoint (zombie
              step-checkpoints (SC) are SCs associated to failed or effectless user
            operations... they are recognizable as SCs with no following log
            entries... there's at most 1 zombie SC in the log at any given time) */
        :return:
        """
        logging.debug('PyMMMK.__setStepCheckpoint()')
        self.undoredoJournal = None
        if len(self.journal) == 0 or self.journal[-1]['op'] != 'MKSTPCHKPT':
            self.__log({'op': 'MKSTPCHKPT'})

    def setUserCheckpoint(self, name = None):
        # /*	create a user-checkpoint : add an entry in the log used as a delimiter to
        # enable undoing/redoing until a specified marker
        #
        # 1. create new step-checkpoint or re-use a 'zombie' user-checkpoint (zombie
        #       user-checkpoints (UC) are UCs associated to failed or effectless user
        #     operations... they are recognizable as same-name UCs with no following
        #     log entries... there's at most 1 zombie UC per name in the log at any
        #     given time) */
        logging.debug('PyMMMK.setUserCheckpoint()')
        self.undoredoJournal = None
        if len(self.journal) == 0 or \
                self.journal[len(self.journal)-1]['op'] != 'MKUSRCHKPT' or \
                self.journal[len(self.journal)-1]['name'] != name:
            self.__log({'op': 'MKUSRCHKPT', 'name': name})

    def __undo(self, step, log):
        """
        /* undo a single step
          1. identify the nature of the logged operation
         2. invert its effects (these may be ignored (log = 'DONTLOG') or logged in
              this.undoredoJournal (log = 'UNDOREDO') */
        :param step:
        :param log:
        :return:
        """
        logging.debug('PyMMMK.__undo()')
        if step['op'] == 'CHATTR': self.__chattr__(step['id'], step['attr'], step['old_val'], log);
        elif step['op'] == 'DUMPMM': self.__loadmm__(step['name'], step['mm'], log);
        elif step['op'] == 'LOADMM': self.__dumpmm__(step['name'], log);
        elif step['op'] == 'MKEDGE': self.__rmedge__(step['i'], log);
        elif step['op'] == 'MKNODE': self.__rmnode__(step['id'], log);
        elif step['op'] == 'RESETM': self.__resetm__(step['old_name'], step['old_model'], False, log);
        elif step['op'] == 'RMEDGE': self.__mkedge__(step['id1'], step['id2'], step['i'], log);
        elif step['op'] == 'RMNODE': self.__mknode__(step['id'], json.loads(step['node']), log);


    def undo(self, uchkpt):
        """
        /* undo all of the changes since the last step-checkpoint or since the
            specified user-checkpoint, if any... when complete the journal index is on
              the undone MKSTPCHKPT/MKUSRCHKPT entry... undoing when the journal index is 0
            or when a non-existing user-checkpoint is given will have no effect */
        :param self:
        :param uchkpt:
        :return:
        """
        logging.debug('PyMMMK.undo()')
        self.undoredoJournal = []
        def stopMarkerReached(step):
            if not uchkpt:
                return step['op'] == 'MKSTPCHKPT'
            else:
                return step['op'] == 'MKUSRCHKPT' and step['name'] == uchkpt

        def stopMarkerFound(i):
            for j in range(i-1, -1, -1):
                if stopMarkerReached(self.journal[i]):
                    return True
            return False

        if not uchkpt or stopMarkerFound(self.journalIndex):
            for step in reversed(self.journal):
                if stopMarkerReached(step):
                    break
                else:
                    self.__undo(step, 'UNDOREDO')

        return {'changelog': self.__changelog()}

#      /****************************** INTERNAL CUD *******************************/
#     /* the following functions are super basic and low-level, they offer cud (no
#           read) commands on this' internal data structures... their main purposes
#         are (1) to localize the said cud operations, and (2) to log everything
#         they do... logging enables undoing and redoing (on constraint/action/...
#         failure or on client requests) and facilitates change pushing (i.e., push
#         a short change log rather the full model)... note that it is assumed that
#         only valid parameters are passed to these functions... last but not least,
#         the optional 'log' parameter is used when undoing/redoing to log undoing/
#         redoing cud ops elsewhere than in this.journal
#
#         __chattr__	change an attribute's value
#                         > log id,attr,new_val,old_val
#         __dumpmm__	remove mm from this.model.metamodels and this.metamodels
#                         > log name,mm
#         __loadmm__	add a mm to this.model.metamodels and this.metamodels
#                         > log name,mm
#         __mkedge__	add an edge to this.model.edges... optional 'i' parameter
#                         specifies index of new edge in this.model.edges
#                         > log id1,id2,i
#         __mknode__	add a node to this.model.nodes
#                         > log id,node
#         __resetm__	when the 'insert' parameter is false, replaces the current
#                           model with another + updates this.next_id to account for ids
#                           in loaded model + updates model.metamodels to account for
#                         metamodels loaded before the model
#                         when the 'insert' parameter is true, inserts the given model
#                         alongside the current model + alters the given model's ids to
#                           avoid clashes with existing ids + updates this.next_id... the
#                           logged value of 'insert' ends up being the offset we applied
#                         to the provided model's ids
#                         > log new_name,new_model,old_name,old_model,insert
#         __rmedge__	remove an edge from this.model.edges
#                         > log id1,id2,i
#         __rmnode__	remove a node from this.model.nodes
#                         > log id,node
#
#         note: these functions never log any 'live' data into the log (i.e., any
#                 references that could be altered elsewhere thereby altering the
#                 journal's contents) */
    def __chattr__(self, ident, attr, new_val, log=None):
        logging.debug('PyMMMK.__chattr__(' + str(ident) +', ' + str(attr) + ', ' + str(new_val) + ')')
        get_attr = None
        set_attr = None

        ident = str(ident)

        if re.match(r".+/.+", attr):
            curr = self.model.nodes[ident]
            for i in attr.split('/'):
                curr = curr[i]
                def get_attr():
                    return curr['value']
                def set_attr(v):
                    curr['value'] = v

        else:
            def get_attr():
                return self.model.nodes[ident][attr]['value']
            def set_attr(v):
                self.model.nodes[ident][attr]['value'] = v

        _old_val = get_attr()
        _new_val = new_val

        if _old_val == _new_val:
            return
        set_attr(new_val)
        self.__log({
            'op': 'CHATTR',
            'id': ident,
            'attr': attr,
            'new_val': new_val,
            'old_val': _old_val,
        }, log)

    def __dumpmm__(self, name, log=None):
        logging.debug('PyMMMK.__dumpmm__()')
        if name in self.model.metamodels:
            self.model.metamodels.remove(name)


        mm = self.metamodels[name]
        del self.metamodels[name]
        self.__log(
            {
                'op': 'DUMPMM',
                'name': name,
                'mm': json.dumps(mm)
            },
            log)

    def __loadmm__(self, name, mm, log=None):
        logging.debug('PyMMMK.__loadmm__(' + name + ')')
        self.metamodels[name] = json.loads(mm)
        if name not in self.model.metamodels:
            self.model.metamodels.append(name)
        self.__log(
            {'op': 'LOADMM',
             'name': name,
             'mm': mm},
            log)

    def __mkedge__(self, ident1, ident2, i=None, log=None):
        logging.debug('PyMMMK.__mkedge__()')
        edge = {'src': ident1, 'dest': ident2}
        if not i:
            self.model.edges.append(edge)
            i = len(self.model.edges) - 1
        else:
            self.model.edges.insert(i, edge)

        self.__log(
            {
                'op': 'MKEDGE',
                'id1': ident1,
                'id2': ident2,
                'i': i
            },
            log
        )

    def __mknode__(self, ident, node, log = None):
        logging.debug('PyMMMK.__mknode__()')
        self.model.nodes[str(ident)] = node
        self.__log(
            {
                'op': 'MKNODE',
                'id': ident,
                'node': json.dumps(node)
            },
            log
        )

    def __resetm__(self, new_name, new_model, insert, log=None):
        logging.debug('PyMMMK.__resetm__()')
        old_model = self.read()
        old_name = self.name

        if insert:
            _new_model = json.loads(new_model)

            for ident in _new_model["nodes"]:
                self.model.nodes[int(ident) + self.next_id] = _new_model["nodes"][ident]

            for edge in _new_model["edges"]:
                self.model.edges.append(
                    {
                        'src': int(edge["src"]) + self.next_id,
                        'dest': int(edge["dest"]) + self.next_id
                    })

            new_model = self.read()
            insert = self.next_id
        else:
            self.model = Model(json.loads(new_model))
            for mm in self.metamodels:
                if mm not in self.metamodels:
                    self.model.metamodels.append(mm)

        self.name = new_name
        for ident in self.model.nodes:
            if int(ident) >= self.next_id:
                self.next_id = int(ident) + 1

        step = {
                   'op': 'RESETM',
                   'new_name': new_name,
                   'new_model': new_model,
                   'old_name': old_name,
                   'old_model': old_model,
               }
        # only add insert if not null
        if insert:
            step['insert'] =  insert
        self.__log(step, log)

    def __rmedge__(self, i, log=None):
        logging.debug('PyMMMK.__rmedge__()')
        edge = self.model.edges.pop(i)
        self.__log(
            {
                'op': 'RMEDGE',
                'i': i,
                'id1': edge['src'],
                'id2': edge['dest']
            }
        )

    def __rmnode__(self, ident, log=None):
        logging.debug('PyMMMK.__rmnode__()')
        node = self.model.nodes[str(ident)]
        del self.model.nodes[str(ident)]
        self.__log(
            {
                'op': 'RMNODE',
                'id': ident,
                'node': json.dumps(node)
            }
        )

    # /***************************** INTERNAL UTILS ******************************/
    def __getMetamodel(self, fulltype):
        """
        /* splits a full type of the form '/path/to/metamodel/type' and returns
        '/path/to/metamodel' */
        :param fulltype:
        :return:
        """
        logging.debug('PyMMMK.__getMetamodel()')
        return os.path.dirname(fulltype)

    def __getType(self, fullType):
        """
        /* splits a full type of the form '/path/to/metamodel/type' and returns
          'type' */
        :param fullType:
        :return:
        """
        logging.debug('PyMMMK.__getType()')
        return os.path.basename(fullType)