'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import logging
import argparse
from platform import python_version

from httpd import HTTPServerThread


'''
	init and launch http server + set logging level for mt/*
'''
def main(args) :
	logging.basicConfig(format='%(levelname)s - %(message)s', level=logging.INFO)

	print("Starting model transformation server... ")
	print("Python version: " + str(python_version()))

	httpd = HTTPServerThread()

	if args.exit_early:
	    print("Exiting early due to flag...")
	else:
	    httpd.start()

if __name__ == "__main__" :
    parser = argparse.ArgumentParser(description='Run the model transformation server.')
    parser.add_argument('--exit_early', dest = 'exit_early', default = False, action = 'store_true',
                        help = 'Option to only create the server thread, but do not run it. For quick testing of imports')
    args = parser.parse_args()

    main(args)



