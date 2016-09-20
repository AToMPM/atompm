.. _troubleshooting:

Troubleshooting
===============

#. I'm stuck in edge editing mode!

It sometimes happens you are stuck in edge editing mode and cannot get out. This is frustrating because you cannot save your model. There is, however, the possibility to call client functions from the console directly. Simply type *_saveModel()* in the console and you save the current state of the model.

If for some reason this did not work, restart AToMPM. **Do not load your model**. Instead, load the *.autosave.<model-name>.model* file, which is AToMPM's way of backing up your work. It will contain a recent version of your model, but not necessarily the latest.