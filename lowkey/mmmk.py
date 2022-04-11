'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''
import copy
import json
import os.path
import re


class Model:
    def __init__(self, from_dict = None):
        self.nodes = {}
        self.edges = []
        self.metamodels = []

        if from_dict:
            self.nodes = from_dict["nodes"]
            self.edges = from_dict["nodes"]
            self.metamodels = from_dict["metamodels"]

    def to_dict(self):
        return {
            "nodes": self.nodes,
            "edges": self.edges,
            "metamodels": self.metamodels,
        }

class PyMMMK:

    def __init__(self):
        self.metamodels = {}
        self.model = Model()
        self.name = ''

        self.next_id = 0

        self.journal = []
        self.journalIndex = 0

        self.undoredoJournal = []

    def clone(self, clone):
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
        self.__setStepCheckpoint()

        self.__loadmm__(name, mm)
        return {'changelog': self.__changelog()}

    def unloadMetamodel(self, name):
        raise NotImplementedError()

    def __crudOp(self, metamodel, events, eventTargets, op, args):
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
        raise NotImplementedError()

    def __connectCN(self, args):
        raise NotImplementedError()

    def connect(self, id1, id2, connectorType, attrs):
        raise NotImplementedError()


    def _create(self, args):
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

    def __delete(self, args):
        raise NotImplementedError()

    def __deleteConnector(self, args):
        raise NotImplementedError()

    def delete(self, id):
        raise NotImplementedError()

    # returns the stringified full model,
    # a stringified node,
    # or a copy of an attribute's value
    def read(self, ident=None, attr=None):

        curr = None
        if not ident:
            return json.dumps(self.model.to_dict())

        if not self.model.nodes[ident]:
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
        raise NotImplementedError()

    # returns self.name
    def readName(self):
        return self.name

    def __update(self, args):
        raise NotImplementedError()

    def update(self, ident, data):
        raise NotImplementedError()

    def __checkpoint(self):
        self.__log({'op': 'MKCHKPT'})

    def __clearCheckpoint(self):
        for i in range(len(self.journal)-1, 0, -1):
            if self.journal[i]["op"] == 'MKCHKPT':
                self.journal.pop(i)
                self.journalIndex -= 1
                break

    def __changelog(self):
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
        raise NotImplementedError()

    def redo(self, uchkpt):
        raise NotImplementedError()

    def __restoreCheckpoint(self):
        while len(self.journal) > 0:
            step = self.journal.pop()
            if step["op"] == 'MKCHKPT':
                break
            else:
                self.__undo(step, 'DONTLOG')
        self.journalIndex = len(self.journal)

    def __setStepCheckpoint(self):
        self.undoredoJournal = None
        if len(self.journal) == 0 or self.journal[-1]['op'] != 'MKSTPCHKPT':
            self.__log({'op': 'MKSTPCHKPT'})

    def setUserCheckpoint(self, name):
        raise NotImplementedError()

    def __undo(self, step, log):
        raise NotImplementedError()

    def undo(self, uchkpt):
        raise NotImplementedError()

    def __chattr__(self, ident, attr, new_val, log):
        raise NotImplementedError()

    def __dumpmm__(self, name, log):
        raise NotImplementedError()

    def __loadmm__(self, name, mm, log=None):
        self.metamodels[name] = json.loads(mm)
        if name not in self.model.metamodels:
            self.model.metamodels.append(name)
        self.__log(
            {'op': 'LOADMM',
             'name': name,
             'mm': mm},
            log)

    def __mkedge__(self, ident1, ident2, i=None, log=None):
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
        self.model.nodes[ident] = node
        self.__log(
            {
                'op': 'MKNODE',
                'id': ident,
                'node': json.dumps(node).replace(" ","")
            },
            log
        )

    def __resetm__(self, new_name, new_model, insert, log=None):
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

        #HACK: Remove spaces to match Javascript mmmk implementation exactly
        old_model = old_model.replace(" ", "")

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

    def __rmedge__(self, i, log):
        raise NotImplementedError()

    def __rmnode__(self, ident, log):
        raise NotImplementedError()

    def __getMetamodel(self, fulltype):
        return os.path.dirname(fulltype)

    def __getType(self, fullType):
        return os.path.basename(fullType)