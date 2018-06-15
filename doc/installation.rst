Installation and Usage
======================

Installation
------------

To install AToMPM, follow these steps:
* Download and install the latest Python 2.7.X
    * Use a package manager on Linux
    * Or visit http://python.org/download/
* Download and install python-igraph
    * Use the pip package manager (comes with Python)
        * ``pip install python-igraph``
    * For Windows, you may need to install the compiled igraph core
        * http://www.lfd.uci.edu/~gohlke/pythonlibs/#python-igraph
* Download and install node.js
    * Use a package manager on Linux
    * Or visit https://nodejs.org/en/download/
* Download and unzip the newest AToMPM release from https://github.com/AToMPM/atompm/releases
* In the AToMPM folder, run the command ``npm install``
    * If you do not need to run tests on AToMPM, you can run ``npm install --production``

Usage
-----

Windows
^^^^^^^

To run AToMPM on Windows, execute the ``run.bat`` script inside of the main AToMPM folder.

Mac or Linux
^^^^^^^^^^^^

* Execute commands in different terminals
    1. Execute ``node httpwsd.js`` in the main AToMPM folder
    2. Execute ``python2 mt\main.py`` in the main AToMPM folder
    3. Open a browser (preferably Chrome) and navigate to http://localhost:8124/atompm

* The above steps are automated by the ``run_AToMPM_local.sh`` script
* Note that the ``run_AToMPM.sh`` script can automate the installation and usage of AToMPM
    * The first time you run this script, all dependencies are automatically downloaded and installed in the ``dependencies/`` folder.
    * If, for any reason, the download process is interrupted or you experience problems with AToMPM, remove the ``dependencies/`` folder and run the script again.
    
Tests
-----
To run tests on AToMPM, run ``npm test``

