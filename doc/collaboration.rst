.. _collaboration:

Collaboration
=============

AToMPM allows users to work together on the same model. This page details the modes available for sharing and the practicalities of setting it up.

Collaboration Modes
^^^^^^^^^^^^^^^^^^^

AToMPM supports two modes of real-time distributed collaboration, namely, *screenshare* and *modelshare*.

In *screenshare*, all collaborating users share the same concrete and abstract syntax. This means that if one user moves an entity or cycles to another concrete syntax representation, the change will be replicated for all collaborators.

In *modelshare*, only the abstract syntax is shared. This means that all collaborators can have distinct concrete syntax representations and distinct layouts (provided layout and abstract syntax are not intricately related), and are only affected by others' abstract syntax changes (e.g., modifying abstract attribute values).

The Collaboration button is found in the main menu toolbar, and looks like a standard 'share' icon with three connected dots. Click it to open the collaboration menu.

Collaborating Across Networks
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

If the collaboration links provided by start with `localhost`, then this link will have to be modified to share with collaborators.

If you are collaborating with someone on the same network, it may be sufficient to replace 'localhost' with your global IP. Visit a service such as https://www.whatismyip.com/ to find your IP address. Then edit the link before sharing it: 'http://XXX.XX.XXX.XX:8124/atompm?host=YY&cswid=0'.

If the collaboration is across networks, then a tunneling service may be required. One solution is https://ngrok.com/.

#. Sign up for a free ngrok account
#. Download the ngrok binary
#. Run the command './ngrok http 8124'
#. Copy the forwarding address and edit the collaboration link: 'https://YYY-YYY-YYY-YYY.ngrok.io/atompm?host=ZZ&cswid=0'
