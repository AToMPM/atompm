# How to use AToMPM with lowkey

### Install lowkey

- Clone the lowkey repository from [https://github.com/geodes-sms/lowkey](https://github.com/geodes-sms/lowkey).
- Install requirements via ```pip install -r requirements.txt```.
- Install the framework as an editable local package via ```pip install -e [path_to_the_project]```. (Use ```pip uninstall lowkey``` if not needed anymore.)

### Start the lowkey server

- Open a terminal and start the server from the /lowkey/network folder of the lowkey repository: ```python Server.py -log debug```.


### Run AToMPM
- Start the PyMMMK manager from the /lowkey folder of this repository: ```python mmmk_manager -log debug```.
- Run AToMPM from the root folder of this reporistory Start the PyMMMK in this repository's /lowkey folder: ```run.bat```. (Or follow the instructions in the main README file.)