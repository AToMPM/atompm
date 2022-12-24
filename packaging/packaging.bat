@echo off
cls

set winpython_url="https://github.com/winpython/winpython/releases/download/4.3.20210620/Winpython32-3.9.5.0dot.exe"
set nodejs_zip_url="https://nodejs.org/dist/v16.13.0/node-v16.13.0-win-x64.zip"
set chrome_url="https://github.com/portapps/ungoogled-chromium-portable/releases/download/92.0.4515.107-11/ungoogled-chromium-portable-win64-92.0.4515.107-11.7z"
set manual_url="https://media.readthedocs.org/pdf/atompm/latest/atompm.pdf"

echo "Packaging AToMPM"
CALL :get7Zip
CALL :getWP
CALL :getNode
CALL :getChrome
CALL :addATOMPM
CALL :addBatchScripts
@REM CALL :addManual

EXIT /B %ERRORLEVEL%

:get7Zip
    set szip_url="https://www.7-zip.org/a/7zr.exe"
    echo "Downloading 7Zip"

    for /F %%i in (%szip_url%) do set  SZ_file=%%~nxi
    echo %SZ_file%

    if NOT exist %SZ_file% (
        echo "Downloading %szip_url%"
        curl -O %szip_url% -L
    )
    
EXIT /B 0

:getWP
    if exist %~dp0atompm-portable\platform\WinPython (
        echo "Python already installed"
        EXIT /B 0
    )

    echo "Downloading WinPython"

    for /F %%i in (%winpython_url%) do set  WP_file=%%~nxi
    echo %WP_file%

    if NOT exist %WP_file% (
        echo "Downloading %winpython_url%"
        curl -O %winpython_url% -L
    ) else (
        echo "Skiping Download %winpython_url%"
    )
    if exist %WP_file% (
        %SZ_file% x %WP_file% -Oatompm-portable\platform -y
        @REM .\%WP_file% -Oatompm-portable\platform -y
        cd %~dp0atompm-portable\platform\
        for /d %%i in (WPy*) do ren "%%i" WinPython
        cd %~dp0
    ) else (
        EXIT /B 0
    )

    powershell -command ".\atompm-portable\platform\WinPython\scripts\python.bat -m pip install requests python-igraph six python-socketio python-socketio[client] websocket-client"
EXIT /B 0

:getNode
    if exist %~dp0atompm-portable\platform\NodeJS (
        echo "Node already installed"
        EXIT /B 0
    )
    echo "Downloading NodeJS"

    for /F %%i in (%nodejs_zip_url%) do set  nodejs_file=%%~nxi
    echo %nodejs_file%

    if NOT exist %nodejs_file% (
        echo "Downloading %nodejs_zip_url%"
        curl -O %nodejs_zip_url% -L
    ) else (
        echo "Skiping Download %nodejs_zip_url%"
    )

    if exist %nodejs_file% (
        powershell -command "Expand-Archive %nodejs_file% '.\atompm-portable\platform\'"
        cd %~dp0atompm-portable\platform\
        for /d %%i in (node-v*) do ren "%%i" NodeJS
        cd %~dp0
    ) else (
        EXIT /B 0
    )
EXIT /B 0

:getChrome
    if exist %~dp0atompm-portable\platform\ChromiumPortable (
        echo "Chrome already installed"
        EXIT /B 0
    )

    echo "Downloading PortableChrome"
    for /F %%i in (%chrome_url%) do set  chrome_file=%%~nxi
    echo %chrome_file%

    if NOT exist %chrome_file% (
        echo "Downloading %chrome_url%"
        curl -O %chrome_url% -L
    ) else (
        echo "Skiping Download %chrome_url%"
    )
    
    %SZ_file% x %chrome_file% -Oatompm-portable\platform\ChromiumPortable -y
    
    @REM cd %~dp0atompm-portable\platform\ChromiumPortable
    @REM for /d %%i in (ungoogled-chromium*) do ren "%%i" ChromiumPortable.exe
    @REM cd %~dp0
EXIT /B 0

:addATOMPM
    echo "Adding AToMPM"

    cd %~dp0atompm-portable
    @REM git clone --depth 1 https://github.com/AToMPM/atompm.git
    cd %~dp0atompm-portable\atompm
    del /s /q .git*
    rmdir /s /q .git
    rmdir /s /q .github
    powershell -command "..\platform\NodeJS\npm install --production"
    cd %~dp0
EXIT /B 0

:addBatchScripts
    cd %~dp0
    echo "Adding batch scripts" 
    copy atompm-portable\atompm\packaging\windows_scripts\*.bat atompm-portable\
EXIT /B 0

:addManual
    echo "Adding manual"
    set manual_filename="atompm-userguide.pdf"
    curl $manual_url -o atompm-portable\%manual_filename%
EXIT /B 0