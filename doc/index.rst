.. AToMPM documentation master file, created by
   sphinx-quickstart on Thu Sep 15 10:35:57 2016.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

AToMPM Documentation
====================

AToMPM ("A Tool for Multi-Paradigm Modelling") is a (meta)modelling workbench, which allows language developers to create visual domain-specific languages, and domain experts to use these languages. A language is defined by its *abstract syntax* in a metamodel, its *concrete syntax(es)*, which define(s) how each abstract syntax element is visualized, and its *semantics definition(s)*, either operational (a simulator) or translational (by mapping onto a known semantic domain). AToMPM supports model transformations to model semantics.

This documentation serves to introduce AToMPM to the two main user groups: language developers and language users.

Contents
--------

.. toctree::
   :maxdepth: 3

    Installation <installation>
    Overview <overview>
    Creating a Modelling Language <new_language>
    Using a Modelling Language <using_language>
    Modelling a Model Transformation <modelling_transformation>
    Executing a Model Transformation <executing_transformation>
    Troubleshooting <troubleshooting>