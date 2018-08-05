==========================================================================================

AToMPM - A Tool for Multi-Paradigm Modelling

Copyright (c) 2017 Khady FALL
(khady.fall@umontreal.ca)

==========================================================================================

EXPORTING AToMPM's METAMODELS AND MODELS TO ECORE

This implementation allows you to export metamodels and models from AToMPM to Ecore.

==========================================================================================

INSTALLATION :

In the \implementation folder, there are two folders : \Ecore and \Plugins.

To install the exporting files, do the following :

1- Copy and paste the \Ecore folder in your AToMPM installation at \atompm\users

\[your_username]\Toolbars.

2- Copy and paste the two files ExportMM2Ecore.js and ExportM2Ecore.js located in \Plugins

in your AToMPM installation at \atompm\plugins.

All the files have been properly installed.



UTILISATION :

To export metamodels or models in AToMPM, follow these steps :

1- Open a new session in AToMPM.

2- Click on the "(re-)load a toolbar" button.

3- In the \Toolbars\Ecore folder, choose "Export2Ecore.buttons.model" then click the "ok"

button.

4- Load your metamodel or model in the current canvas.

5- If you want to export a metamodel, click on the "MM -> Ecore" button of the loaded

toolbar (the first button). If you want to export a model, rather click on the "M ->

Ecore" button (the second button).

6- If you want to export a model, you will be asked to enter the name of the model, the

name of the metamodel and its URI. Also, you will be asked if you want a dynamic instance

or a static one. There are default values : the model's name will be the current model

name, the metamodel's name and URI will be composed as follow :

"[name_of_current_model]Metamodel" and "http://[name_of_current_model]", respectively.

7- If you want to export a metamodel, you will be asked to enter the name of the metamodel

and its URI. There are default values : the name of the current metamodel and a URI

composed as follow : "http://[name_of_(meta)model]".

8- After entering those informations, click the "ok" button.

9- A file .ecore for a metamodel, or a file .xmi for a model, has been created. That file

is in a folder \exported_to_ecore located in the \atompm folder of your AToMPM

installation.

10- If you want to use the exported file in Eclipse, you have to register the metamodel.

==========================================================================================
