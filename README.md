# AToMPM - A Tool for Multi-Paradigm Modelling
AToMPM is an open-source research framework for generating domain-specific modeling web-based tools that run on the cloud. AToMPM facilitates designing DSML environments, performing model transformations, and manipulating and managing models. It runs completely over the web, making it independent from any operating system, platform, or device it may execute on. AToMPM follows the philosophy of modeling everything explicitly, at the right level of abstraction(s), using the most appropriate formalism(s) and process(es), as it is completely modeled by itself.

## Installation
A portable .zip version of AToMPM is available for Windows. This portable version is intended for those users with limited installation capabilities, such that they can skip these installation instructions. Please check https://msdl.uantwerpen.be/git/simon/AToMPM/releases for the newest release.

To install AToMPM, follow these steps:
* Download and install the latest Python (2.7.X or 3.X.X)
    * Use a package manager on Linux
    * Or visit http://python.org/download/
* Download and install python-igraph
    * Use the pip package manager (comes with Python)
        * For Python2: `pip install python-igraph`
        * For Python3: `pip3 install python-igraph`
    * For Windows, you may need to install the compiled igraph core
        * `http://www.lfd.uci.edu/~gohlke/pythonlibs/#python-igraph`
* Download and install six
    * Use the pip package manager (comes with Python)
        * For Python2: `pip install six`
        * For Python3: `pip3 install six`
* Download and install node.js
    * Required version: >= 8.0
    * Use a package manager on Linux
    * Or visit https://nodejs.org/en/download/
* Download and unzip the source files for the newest AToMPM release from https://msdl.uantwerpen.be/git/simon/AToMPM/releases
* In the AToMPM folder, run the command `npm install`
    * If you do not need to run tests on AToMPM, you can run `npm install --production`

## Usage

The commands below are for starting the ATOMPM server. Note that the default port is 8124.

Once started, the server can be connected to by accessing http://localhost:8124/atompm in either the Firefox or Chrome browsers.

### Windows
To run AToMPM on Windows, execute the `run.bat` script inside of the main AToMPM folder.

### Mac or Linux
* Execute commands in different terminals
    1. Execute `node httpwsd.js` in the main AToMPM folder
    2. Execute `python mt\main.py` in the main AToMPM folder
    3. Open a browser (Firefox or Chrome) and navigate to http://localhost:8124/atompm

* The above steps are automated by the `run_AToMPM_local.sh` script

## Documentation
Documentation for AToMPM can be found here: https://msdl.uantwerpen.be/documentation/AToMPM/index.html

## Bug Reporting/Comments
Please create an issue for your bug or comments here: https://msdl.uantwerpen.be/git/simon/AToMPM/issues

## Testing
To run tests on AToMPM, run `npm test'. Ensure that your resolution of your screen is set quite high, as elements cannot be placed by the script off-screen.

## LICENSING
The AToMPM project is licensed under the LGPL as stated in COPYING.lesser.

AToMPM is copyright of the AToMPM team, which includes Raphael Mannadiar, Conner Hansen, Eugene Syriani, Hans Vangheluwe, Simon Van Mierlo, Huseyin Ergin, Jonathan Corley, Yentl Van Tendeloo, Vasco Sousa, and Bentley James Oakes
