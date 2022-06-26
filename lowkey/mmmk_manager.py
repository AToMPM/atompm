#  This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
#  Copyright 2011 by the AToMPM team and licensed under the LGPL
#  See COPYING.lesser and README.md in the root of this project for full details

import ast
import json
import argparse
import logging

import zmq

from mmmk import PyMMMK


__author__ = "Bentley James Oakes, Istvan David"
__copyright__ = "Copyright 2022, GEODES"
__credits__ = "Eugene Syriani"
__license__ = "GPL-3.0"

class PyMMMKManager:

    def __init__(self):
        # set up communication
        self.context = zmq.Context()
        self.socket = self.context.socket(zmq.REP)

        self.address = "tcp://127.0.0.1:5555"
        print("Binding to: " + self.address)
        self.socket.bind(self.address)

        self.mmmks = {}
        
    def run(self):
        main_thread = threading.Thread(target=self.main, args=())
        main_thread.daemon = True
        logging.debug("Starting main thread")
        main_thread.start()
        
        logging.debug("Starting mmmk thread")
        self.editorThread()

    def main(self):
        print("Started PyMMMK")
        while True:
            #  Wait for next request from client
            message = bytes(self.socket.recv()).decode()
            #print("Received request: %s" % message)

            msg = json.loads(message)
            print("Msg length: " + str(len(msg)) + ": " + str(msg[:2]))
            if len(self.mmmks.values()) == 1:
                #print(list(self.mmmks.values())[0])
                print("LWW object ID of MMMK root model: {}".format((list(self.mmmks.values())[0]).model.getId()))

            wid = msg[0]
            op = msg[1]

            where_to_call = self
            if wid in self.mmmks:
                where_to_call = self.mmmks[wid]

            #print("OP: " + str(op))
            method_to_call = getattr(where_to_call, op)
            args = msg[2:]
            #res = method_to_call(*args)
            if where_to_call is self:
                res = method_to_call(*args)
            else:
                res = where_to_call.dispatch(op, args)

            #print("RES: " + str(res))

            #  Send reply back to client
            self.sendChangelog(res)

    def sendChangelog(self, result):
        self.socket.send(json.dumps(result).encode("utf-8"))
            
    def create_worker(self, msg):
        pymmmk = PyMMMK()
        worker_type, wid = msg.values()
        worker_name = worker_type + str(wid)
        pymmmk.setName(worker_name)
        pymmmk.setType(worker_type)

        print("Created pymmmk for worker: " + worker_name)
        self.mmmks[worker_name] = pymmmk
        
        logging.debug('pymmmk joining to lowkey')
        pymmmk.join()
        logging.debug('pymmmk joined to lowkey')
        pymmmk.run()

        return "ACK"
    

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "-log",
        "--log",
        default="warning",
        help=("Provide logging level. "
              "Example '--log debug', default='warning'."
              )
        )

    options = parser.parse_args()
    levels = {
        'critical': logging.CRITICAL,
        'error': logging.ERROR,
        'warn': logging.WARNING,
        'warning': logging.WARNING,
        'info': logging.INFO,
        'debug': logging.DEBUG
    }
    level = levels.get(options.log.lower())
    if level is None:
        raise ValueError(
            f"log level given: {options.log}"
            f" -- must be one of: {' | '.join(levels.keys())}")
    
    logging.basicConfig(format='[%(levelname)s] %(message)s', level=level)
    
    mmmk_man = PyMMMKManager()
    mmmk_man.main()