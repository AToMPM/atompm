# AToMPM - A Tool for Multi-Paradigm Modelling
AToMPM is an open-source research framework for generating domain-specific modeling web-based tools that run on the cloud. AToMPM facilitates designing DSML environments, performing model transformations, and manipulating and managing models. It runs completely over the web, making it independent from any operating system, platform, or device it may execute on. AToMPM follows the philosophy of modeling everything explicitly, at the right level of abstraction(s), using the most appropriate formalism(s) and process(es), as it is completely modeled by itself.

## Documentation
Documentation for AToMPM can be found here: [https://atompm.readthedocs.io/en/latest/](https://atompm.readthedocs.io/en/latest/). It includes an overview of AToMPM and a guide to creating and using modelling languages. 

## Obtaining AToMPM

### Portable Zip File

A portable .zip version of AToMPM is available for Windows. This portable version is intended for those users with limited installation capabilities. With this portable version, users can skip the below installation instructions.

Please check [https://github.com/AToMPM/atompm/releases](https://github.com/AToMPM/atompm/releases) for the newest release, and download the `atompm-portable.zip` file.

To run the portable version:
* Extract it to a directory on your machine
* Double-click on the `AToMPM.bat` file within the directory.

### Docker Container

At [https://github.com/AToMPM/atompm](https://github.com/AToMPM/atompm) on the right-hand side under the heading "Packages", there should be a Docker container named `atompm`. This container is automatically built when new AToMPM versions are created.

Usage instructions for connecting to this Docker container are in the `packaging/docker` folder. There is also a `Dockerfile` in that directory to build the container yourself. 

### Installation

To install AToMPM, follow these steps:
1. Download and install the latest Python
    * Python 2 is unsupported. Please use Python 3.
    * Use a package manager on Linux or visit [http://python.org/download/](http://python.org/download/)
2. Download and install `python-igraph`
    * Use the pip package manager (comes with Python)
        * `pip3 install python-igraph`
    * For Windows, you may need to install the compiled igraph core
        * [http://www.lfd.uci.edu/~gohlke/pythonlibs/#python-igraph](http://www.lfd.uci.edu/~gohlke/pythonlibs/#python-igraph)
3. Download and install the required libraries
    * Use the pip package manager (comes with Python)
        * `pip3 install six requests python-socketio "python-socketio[client]" websocket-client`
4. Download and install `node.js`
    * Required version: >= 18.0
    * Use a package manager on Linux or visit [https://nodejs.org/en/download/](https://nodejs.org/en/download/)
5. Download and extract the source files for the newest AToMPM release from [https://github.com/AToMPM/atompm/releases](https://github.com/AToMPM/atompm/releases)
6. Ensure your terminal is in the root AToMPM folder (containing `httpwsd.js`)
7. Run the command `npm install`
    * If you do not need to run tests on AToMPM, you can run `npm install --production`

## Usage

The commands below are for starting the AToMPM server. Note that the default port is 8124.

Once started, the server can be connected to by accessing [http://localhost:8124/atompm](http://localhost:8124/atompm) in either the Firefox or Chrome browsers.

### Windows
To run AToMPM on Windows, double-click on the `run.bat` script inside of the main AToMPM folder.

### Mac or Linux
1. Execute `node httpwsd.js` in one terminal
2. Execute `python3 mt/main.py` in another terminal
3. Open a browser (Firefox or Chrome) and navigate to [http://localhost:8124/atompm](http://localhost:8124/atompm)

* The above steps are automated by the `run_AToMPM_local.sh` script

## Bug Reporting/Feedback
Please create an issue for your bug or feedback here: [https://github.com/AToMPM/atompm/issues](https://github.com/AToMPM/atompm/issues). Pull requests are also welcome.

## Developing and Testing AToMPM

See DEVELOPING.md in this directory.

## LICENSING
The AToMPM project is licensed under the LGPL as stated in COPYING.lesser.

AToMPM is copyright of the AToMPM team, which includes Raphael Mannadiar, Conner Hansen, Eugene Syriani, Hans Vangheluwe, Simon Van Mierlo, Huseyin Ergin, Jonathan Corley, Yentl Van Tendeloo, Vasco Sousa, and Bentley James Oakes
