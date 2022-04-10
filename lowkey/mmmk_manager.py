#  This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
#  Copyright 2011 by the AToMPM team and licensed under the LGPL
#  See COPYING.lesser and README.md in the root of this project for full details

import ast
import json

import zmq

from mmmk import PyMMMK


class PyMMMKManager:

    def __init__(self):
        # set up communication
        self.context = zmq.Context()
        self.socket = self.context.socket(zmq.REP)

        self.address = "tcp://127.0.0.1:5555"
        print("Binding to: " + self.address)
        self.socket.bind(self.address)

        self.mmmks = {}

    def main(self):
        print("Started PyMMMK")
        while True:
            #  Wait for next request from client
            message = bytes(self.socket.recv()).decode()
            #print("Received request: %s" % message)

            msg = json.loads(message)
            print("Msg length: " + str(len(msg)) + ": " + str(msg[:2]))

            wid = msg[0]
            op = msg[1]

            where_to_call = self
            if wid in self.mmmks:
                where_to_call = self.mmmks[wid]

            print("OP: " + str(op))
            method_to_call = getattr(where_to_call, op)
            args = msg[2:]
            res = method_to_call(*args)

            #print("RES: " + str(res))

            #  Send reply back to client
            self.socket.send(json.dumps(res).encode("utf-8"))

    def create_worker(self, msg):
        pymmmk = PyMMMK()
        worker_type, wid = msg.values()
        worker_name = worker_type + str(wid)

        print("Created pymmmk for worker: " + worker_name)
        self.mmmks[worker_name] = pymmmk

        return "ACK"


if __name__ == "__main__":
    mmmk_man = PyMMMKManager()
    mmmk_man.main()
