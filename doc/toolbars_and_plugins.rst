.. _toolbars_and_plugins:

Toolbar/Plugin Documentation
============================

This section describes the operation of the add-on toolbars and plugins available within AToMPM.


Exporter of AToMPM's Metamodels and Models to Ecore
---------------------------------------------------

This implementation allows you to export metamodels and models from AToMPM to Ecore.

Copyright (c) 2017 Khady FALL
(khady.fall@umontreal.ca)

.. Installation
.. ^^^^^^^^^^^^

.. In the \\implementation folder, there are two folders: \Ecore and \Plugins.

.. To install the exporting files, do the following :

.. 1. Copy and paste the \Ecore folder in your AToMPM installation at \atompm\users\[your_username]\Toolbars.

.. 2. Copy and paste the two files ExportMM2Ecore.js and ExportM2Ecore.js located in \Plugins in your AToMPM installation at \atompm\plugins.

.. All the files have been properly installed.

Utilisation
^^^^^^^^^^^

To export metamodels or models in AToMPM, follow these steps:

1. Open a new session in AToMPM.

2. Click on the "(re-)load a toolbar" button.

3. In the \\Toolbars\\Ecore folder, choose "Export2Ecore.buttons.model" then click the "ok" button.

4. Load your metamodel or model in the current canvas.

5. If you want to export a metamodel, click on the "MM -> Ecore" button of the loaded toolbar (the first button). If you want to export a model, rather click on the "M -> Ecore" button (the second button).

6. If you want to export a model, you will be asked to enter the name of the model, the name of the metamodel and its URI. Also, you will be asked if you want a dynamic instance or a static one. There are default values:

    * The model's name will be the current model name
    * The metamodel's name and URI will be composed as follows:
        * "[name_of_current_model]Metamodel"
        * "http://[name_of_current_model]"

7. If you want to export a metamodel, you will be asked to enter the name of the metamodel and its URI. There are default values:
    * The name of the current metamodel
    * A URI composed as follows: "http://[name_of_(meta)model]".

8. After entering that information, click the "ok" button.

9. A file .ecore for a metamodel, or a file .xmi for a model, has been created. That file is in a folder \\exported_to_ecore located in the \\atompm folder of your AToMPM installation.

10. If you want to use the exported file in Eclipse, you have to register the metamodel.


ModelVerse Toolbar
------------------

.. warning:: The ModelVerse toolbar is currently in an alpha state. It is only intended as a prototype and should not be used for everyday use, as data loss is certain to occur.

The ModelVerse toolbar is intended to allow for the user to load and save models to/from AToMPM to the Modelverse. 

.. warning:: Currently, only metamodels in the SimpleClassDiagram formalism can be loaded and saved, along with instance models.

The first button on the toolbar connects to a running ModelVerse instance running on the current machine.

The second button loads a model from the ModelVerse into the current AToMPM canvas.

The third button saves the current AToMPM model to the ModelVerse.
