# Changelog

All notable changes to AToMPM will be documented in this file.

## [Unreleased]

## [0.8.0] - 2018-06-21

### Added
- Replace Documentation button with About button in main toolbar. About dialog provides information on current and newest versions of AToMPM, and links to website and documentation
- Add explicit 'verify' event for constraints/actions, triggered when the user presses the 'verify model' button
- Add additional information when errors occur during abstract syntax or concrete syntax compilation
- Add a plugin for producing Ecore models from metamodels
- Add tabbing through attributes in editing dialog, as well as in workflow parameter dialog.
- Sort toolbars by name for consistency
- A default icon is loaded for toolbar buttons if the button icon could not be found

### Fixed
- Correctly open toolbars in the CreateDSL Workflow
- Add Firefox detection of mouse wheel, so that geometry controls work
- Reset key state when window gains focus, to avoid input issues
- Fix crash where alternate concrete syntax for an abstract syntax would not be loaded 

### Removed
- Merged information in manual into the AToMPM documentation

## Other
- Extended tests to load all toolbars, and to programmatically create a domain-specific language


## [0.7.0] - 2018-05-16

### Added

- Add extension info when loading/saving

### Fixed

- Fixed workflows such that they now execute

### Removed

- Removed guest directory from users
- Removed autosave files from default directory

## Other
- Moved project to GitHub
- Added continuous integration
