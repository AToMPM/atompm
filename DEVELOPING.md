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

## Debug Messages

To see debug messages of the communication between AToMPM components, run the server with the command `node httpwsd.js --log=DEBUG`. This will command the server to produce debug information in the Mermaid format.

Then, navigate to [https://mermaid.live](https://mermaid.live) and paste in the debug info.

Example:
```mermaid
sequenceDiagram
client  -)  server : http <br/>POST<br/>/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.defaultIcons/ClassIcon.type?wid=2&cid=6b11ef3d-7120-4ec6-9e02-953124be22c4 <br/> httpwsd.js(  47)
server  ->>  session_mngr : fcn call _ 'message' <br/> session_manager.js( 280)
client  -)  server : http <br/>POST<br/>/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram/Class.type?wid=3 <br/> httpwsd.js(  47)
server  ->>  session_mngr : fcn call _ 'message' <br/> session_manager.js( 280)
Note right of /asworker3 : socketio _ 'sending chglg'+ <br/>{"changelog":[{"op":"MKNODE"}],"hitchhiker":["pos"]} <br/> session_manager.js( 379)
client  -)  server : http <br/>POST<br/>/GET//Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram/Class/1.instance.mappings?wid=3 <br/> httpwsd.js(  47)
server  ->>  session_mngr : fcn call _ 'message' <br/> session_manager.js( 280)
Note right of /csworker2 : socketio _ 'sending chglg'+ <br/>{"changelog":[{"op":"MKNODE"},{"op":"CHATTR"},{"op":"CHATTR"},{"op":"CHATTR"}],"hitchhiker":[]} <br/> session_manager.js( 379)
```
