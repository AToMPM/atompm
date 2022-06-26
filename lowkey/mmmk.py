#  This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
#  Copyright 2011 by the AToMPM team and licensed under the LGPL
#  See COPYING.lesser and README.md in the root of this project for full details

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

from MMMKModel import Model

from lowkey.network.Client import Client

__author__ = "Benley James Oakes, Istvan David"
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
        logging.debug("{}: Starting connection thread".format(self.__name))
        connection_thread.start()
    
    # Join a server and receive the updates
    def join(self):
        self._snapshot.send(b"request_snapshot")
        while True:
            try:
                receviedMessage = self._snapshot.recv()
                logging.debug("{}: Received message from server.".format(self.__name))
                _, message = self.getMessage(receviedMessage)
                self.processMessage(message)
            except:
                return  # Interrupted
            if message == b"finished_snapshot":
                logging.debug("{}: Received snapshot".format(self.__name))
                break  # Done
    
    # The behavior that will be executed in the polling loop
    def subscriberAction(self):
        logging.debug("{}: Printing received message.".format(self.__name))
        receviedMessage = self._subscriber.recv()
        senderId, senderType, senderName, op, args = self.getMessage(receviedMessage)
        
        if self.throwawayMessage(senderId, senderType, senderName):
            logging.debug("{}: Throwing message {} ### {}".format(self.__name, op, args))
        else:
            logging.debug("{}: Processing message {} ### {}".format(self.__name, op, args))
            self.processMessage(op, args)
        
        logging.debug("{}: Received message via subscribe: {}".format(self.__name, receviedMessage))

    '''
    Message production
    '''
    def messageToBeForwarded(self, command):
        return command in ["create"]
    
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
        logging.debug("{}: Checking if message is throwaway. SenderID: {}. My ID: {}. SenderType: {}. My type:{}. SenderName: {}. My name:{}.".format(self.__name, senderId, self._id, senderType, self.__type, senderName, self.__name))
        sameType = senderType == self.__type
        logging.debug("{}: Comparing {} to {}. Same? {}.".format(self.__name, senderType, self.__type, sameType))
        sameName = senderName == self.__name
        logging.debug("{}: Comparing {} to {}. Same? {}.".format(self.__name, senderName, self.__name, sameName))
        logging.debug("{}: Same type? {}. Same name? {}.".format(self.__name, sameType, sameName))
        throwaway = (not sameType) or sameName
        logging.debug("{}: Throwaway? {}.".format(self.__name, throwaway))
        return throwaway

    def processMessage(self, op, args):
        logging.debug("{}: ProcessingMessage...........................".format(self.__name))
        args = self.unpackArgs(args)
        logging.debug("{}: args: {}. type: {}.".format(self.__name, args, type(args)))
        
        # TODO this runs into an infinite loop
        #self.dispatch(op, args)
        
    def unpackArgs(self, args):
        args = args.replace('[', '').replace(']', '')
        args = args.split(',')
        
        arglist = []
        for a in args:
            logging.debug("{}: Cleaning up arg: {}.".format(self.__name, a))
            a = a.replace("'", '')
            a = a.strip()
            logging.debug("{}: Cleaned up arg: {}.".format(self.__name, a))
            arglist.append(a)
        
        logging.debug("{}: Unpacked args: {}. type: {}.".format(self.__name, arglist, type(arglist)))
        
        return arglist
    
    '''
    Timeout action
    '''
    def timeoutAction(self):
        pass    


    ############################## MMMK functionality ##############################
    '''
    This is the single point of entry from lowkey's point of view.
    '''
    def dispatch(self, op, args):
        logging.debug('PyMMMK.dispatch')
        logging.debug("{}: args: {}. type: {}.".format(self.__name, args, type(args)))
        method_to_call = getattr(self, op)
        logging.debug('PyMMMK -- calling self.{}'.format(op))
        res = method_to_call(*args)
        
        logging.debug(args)
        
        if self.messageToBeForwarded(op):
            logging.debug("Sending message to lowkey")
            message = self.createMessage(f"senderType:{self.__type} ### senderName:{self.__name} ### op:{op} ### args:{args}")
            self._publisher.send(message)
        
        with open("model.json", "w") as outfile:
            json.dump(self.model.to_dict(), outfile)

        return res
        
    '''
    This is a temporary method here for minimizing API break. This info should be passed in the constructor.
    '''
    def setName(self, workerName):
        self.__name = workerName
        
    def setType(self, workerType):
        self.__type = workerType
        
    def clone(self, clone):
        logging.debug('PyMMMK.clone()')
        raise NotImplementedError()

    # load a model into this.model
    #
    #     0. create step-checkpoint
    #     1. make sure all required metamodels are loaded
    #     2. if 'insert' is specified,
    #         a) append 'model' to this.model (via __resetm__)
    #     2. otherwise, load 'model' into this.model and 'name' into this.name
    #         (via __resetm__)
    def loadModel(self, name, model, insert):
        logging.debug('PyMMMK.loadModel()')
        self.__setStepCheckpoint()

        new_model = json.loads(model)
        for mm in new_model["metamodels"]:
            if not mm in self.metamodels:
                return {'$err': 'metamodel not loaded :: ' + mm}

        self.__resetm__(name, model, insert)
        return {'changelog': self.__changelog()}

    # load a metamodel
    #
    # 0. create a step - checkpoint
    # 1. load metamodel into this.model.metamodels and this.metamodels
    # (via__loadmm__)
    def loadMetamodel(self, name, mm):
        logging.debug('PyMMMK.loadMetamodel()')
        self.__setStepCheckpoint()

        self.__loadmm__(name, mm)
        return {'changelog': self.__changelog()}

    def unloadMetamodel(self, name):
        logging.debug('PyMMMK.unloadMetamodel()')
        raise NotImplementedError()

    def __crudOp(self, metamodel, events, eventTargets, op, args):
        logging.debug('PyMMMK.__crudOp()')
        if not self.metamodels[metamodel]:
            return {'$err': 'metamodel not loaded :: ' + metamodel}

        if 'create' in events:
            if args["fulltype"]:
                self.next_type = args["fulltype"]
            else:
                self.next_type = args["connectorType"]

        self.__checkpoint()

        #TODO: Implement event handler
        method_to_call = getattr(self, op)
        err = method_to_call(args)
        if err:
            self.__restoreCheckpoint()
            return err
        self.__clearCheckpoint()

    def __connectNN(self, args):
        logging.debug('PyMMMK.__connectNN()')
        raise NotImplementedError()

    def __connectCN(self, args):
        logging.debug('PyMMMK.__connectCN()')
        raise NotImplementedError()

    def connect(self, id1, id2, connectorType, attrs):
        logging.debug('PyMMMK.connect()')
        raise NotImplementedError()


    def _create(self, args):
        logging.debug('PyMMMK._create()')
        """
        1. create [default] instance using metamodel [and possibly specified attrs] + init $type
        2. add to current model nodes
        3. if fulltype is a connectorType, create edges between node id1
        and new instance and between new instance and node id2
        :param args:
        :return:
        """
        metamodel = self.__getMetamodel(args["fulltype"])
        fulltype = self.__getType(args["fulltype"])
        typeAttrs = self.metamodels[metamodel]['types'][fulltype]
        new_node = {}

        if not typeAttrs:
            return {'$err': 'can not create instance of unknown type :: ' + args["fulltype"]}

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
        """
        0. create a step-checkpoint
        1. wrap __create in crudOp
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
                'attrs':'attrs'
            }
        )
        if err:
            return err
        ret = {'id': self.next_id,
               'changelog': self.__changelog()}
        self.next_id += 1
        return ret

    def _delete(self, args):
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

    def delete(self, ident):
        logging.debug('PyMMMK.delete()')
        self.__setStepCheckpoint()

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

    # returns the stringified full model,
    # a stringified node,
    # or a copy of an attribute's value
    def read(self, ident=None, attr=None):
        logging.debug('PyMMMK.read()')
        curr = None
        if not ident:
            return json.dumps(self.model.to_dict())

        if ident not in self.model.nodes:
            print(self.model.nodes.keys())
            return {'$err': 'instance not found :: ' + ident}

        if not attr:
            return json.dumps(self.model.nodes[ident])

        if re.match(r".+/.+", attr):
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

    def readMetamodels(self, metamodel):
        logging.debug('PyMMMK.readMetamodels()')
        raise NotImplementedError()

    # returns self.name
    def readName(self):
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
            if not args["data"][attr]:
                return {"$err": 'tried to set attribute ' + str(attr) + ' to "null"'}

            res = self.read(args["id"], attr)
            if '$err' in res:
                return res

            self.__chattr__(args["id"], attr, args["data"][attr])

    def update(self, ident, data):
        logging.debug('PyMMMK.update()')
        """
        0. create a step-checkpoint
        1. wrap _update in crudop
        2. return err or nothing
        :param ident:
        :param data:
        :return:
        """
        self.__setStepCheckpoint()

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

    def __checkpoint(self):
        logging.debug('PyMMMK.__checkpoint()')
        self.__log({'op': 'MKCHKPT'})

    def __clearCheckpoint(self):
        logging.debug('PyMMMK.__clearCheckpoint()')
        for i in range(len(self.journal)-1, 0, -1):
            if self.journal[i]["op"] == 'MKCHKPT':
                self.journal.pop(i)
                self.journalIndex -= 1
                break

    def __changelog(self):
        logging.debug('PyMMMK.__changelog()')
        
        print(self.model.nodes)
        
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
        logging.debug('PyMMMK.__redo()')
        raise NotImplementedError()

    def redo(self, uchkpt):
        logging.debug('PyMMMK.redo()')
        raise NotImplementedError()

    def __restoreCheckpoint(self):
        logging.debug('PyMMMK.__restoreCheckpoint()')
        while len(self.journal) > 0:
            step = self.journal.pop()
            if step["op"] == 'MKCHKPT':
                break
            else:
                self.__undo(step, 'DONTLOG')
        self.journalIndex = len(self.journal)

    def __setStepCheckpoint(self):
        logging.debug('PyMMMK.__setStepCheckpoint()')
        self.undoredoJournal = None
        if len(self.journal) == 0 or self.journal[-1]['op'] != 'MKSTPCHKPT':
            self.__log({'op': 'MKSTPCHKPT'})

    def setUserCheckpoint(self, name):
        logging.debug('PyMMMK.setUserCheckpoint()')
        self.undoredoJournal = None
        if len(self.journal) == 0 or \
                self.journal[len(self.journal)-1]['op'] != 'MKUSRCHKPT' or \
                self.journal[len(self.journal)-1]['name'] != name:
            self.__log({'op': 'MKUSRCHKPT', 'name': name})

    def __undo(self, step, log):
        logging.debug('PyMMMK.__undo()')
        raise NotImplementedError()

    def undo(self, uchkpt):
        logging.debug('PyMMMK.undo()')
        raise NotImplementedError()

    def __chattr__(self, ident, attr, new_val, log=None):
        logging.debug('PyMMMK.__chattr__()')
        get_attr = None
        set_attr = None

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
        _new_val = json.dumps(new_val)
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

    def __dumpmm__(self, name, log):
        logging.debug('PyMMMK.__dumpmm__()')
        raise NotImplementedError()

    def __loadmm__(self, name, mm, log=None):
        logging.debug('PyMMMK.__loadmm__()')
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
            i = self.model.edges.append(edge) - 1
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
        node = self.model.nodes[ident]
        del self.model.nodes[ident]
        self.__log(
            {
                'op': 'RMNODE',
                'id': ident,
                'node': json.dumps(node)
            }
        )


    def __getMetamodel(self, fulltype):
        logging.debug('PyMMMK.__getMetamodel()')
        return os.path.dirname(fulltype)

    def __getType(self, fullType):
        logging.debug('PyMMMK.__getType()')
        return os.path.basename(fullType)