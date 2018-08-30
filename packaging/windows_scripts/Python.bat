@ECHO OFF
TITLE AToMPM
CD ".\atompm"

IF EXIST "..\platform\WinPython" (
"..\platform\WinPython\python-3.6.5\python.exe" mt\main.py
) ELSE (
"..\platform\PortablePython27\Python-Portable.exe" mt\main.py
)


