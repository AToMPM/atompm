'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''
import copy
import json
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


    def __setStepCheckpoint(self):
        self.undoredoJournal = None
        if len(self.journal) == 0 or self.journal[-1]['op'] != 'MKSTPCHKPT':
            self.__log({'op': 'MKSTPCHKPT'})

    def __loadmm__(self, name, mm, log=None):
        self.metamodels[name] = json.loads(mm)
        if name not in self.model.metamodels:
            self.model.metamodels.append(name)
        self.__log(
            {'op': 'LOADMM',
             'name': name,
             'mm': mm},
            log)

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
