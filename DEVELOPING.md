# Developing and Testing AToMPM

This document contains instructions and tips for developing and testing AToMPM.

## Setting Up Development Environment

Any Javascript IDE/editor can be used to develop AToMPM. Current options include:
* [https://code.visualstudio.com/](https://code.visualstudio.com/) Free and open-source.
* [https://atom.io/](https://atom.io/) Free and open-source
* [https://www.jetbrains.com/webstorm/](https://www.jetbrains.com/webstorm/) Proprietary and non-free. Can obtain student license for free: [https://www.jetbrains.com/community/education/#students](https://www.jetbrains.com/community/education/#students)

Follow the tool's documentation for setting up a new project and importing AToMPM's files.

Currently, there is no style guide for AToMPM code. In the future, the [Prettier](https://prettier.io/) tool will most likely be used.

## Testing
To run tests on AToMPM, run `npm test`. Ensure that your resolution of your screen is set quite high, as elements cannot be placed by the script off-screen.

## Architecture

An architectural diagram is available in the documentation as `./doc/img/architecture.png`. It describes the major components of the client/server architecture of AToMPM, and indicates the type and pattern of communication.