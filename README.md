# AToMPM - A Tool for Multi-Paradigm Modelling

## Installation and Usage

### Windows

To install AToMPM on Windows, follow these steps:
* Download and install the latest Python 2.7.X (32-bit) from http://python.org/download/
* Download and install python-igraph from http://www.lfd.uci.edu/~gohlke/pythonlibs/#python-igraph
* Download and install node.js version 4.5.0 from https://nodejs.org/en/
* Download and unzip the AToMPM sources from https://msdl.uantwerpen.be/git/simon/AToMPM/archive/master.zip.
* In the AToMPM folder, run the command 'npm install'.

To run AToMPM on Windows, execute the `run.bat` script inside of the main AToMPM folder.

### Linux

Download and unzip the AToMPM sources from https://msdl.uantwerpen.be/git/simon/AToMPM/archive/master.zip.

To run AToMPM, execute the `run_AToMPM.sh` script inside of the main AToMPM folder. The first time you run this script, all dependencies are automatically downloaded and installed in the `dependencies/` folder. If, for any reason, the download process is interrupted or you experience problems with AToMPM, remove the `dependencies/` folder and run the script again.

### Mac

To install AToMPM on Mac, follow these steps:
* Download and install the latest Python 2.7.X (32-bit) from http://python.org/download/
* Download and install python-igraph from http://www.lfd.uci.edu/~gohlke/pythonlibs/#python-igraph
* Download and install node.js version 4.5.0 from https://nodejs.org/en/
* Download and unzip the AToMPM sources from https://msdl.uantwerpen.be/git/simon/AToMPM/archive/master.zip.
* In the AToMPM folder, run the command 'npm install'.

To run AToMPM on Mac, follow these steps:
* Execute `node httpwsd.js` in the main AToMPM folder
* Execute `python mt\main.py` in the main AToMPM folder
* Open a browser (preferably Chrome) and navigate to http://localhost:8124/atompm

## Documentation

Documentation can be found here: https://msdl.uantwerpen.be/documentation/AToMPM/index.html