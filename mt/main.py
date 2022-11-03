'''This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
Copyright 2011 by the AToMPM team and licensed under the LGPL
See COPYING.lesser and README.md in the root of this project for full details'''

import logging
from httpd import HTTPServerThread


'''
	init and launch http server + set logging level for mt/*
'''
def main() :
	logging.basicConfig(format='%(levelname)s - %(message)s', level=logging.INFO)

	httpd = HTTPServerThread()
	httpd.start()
	print("Started Model Transformation Server")

if __name__ == "__main__" :
	main()



