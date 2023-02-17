#!/bin/bash

#Steps when making a new release:

#1. Update version number:
#   i. In AToMPM - client/constants.js
#   ii. In documentation - doc/conf.py
#   iii. In Node - package.json
#2. Create a new tag like v0.8.0 `git tag v0.8.0`
#3. Push these changes to GitHub
#4. Create a new release on GitHub
#5. The packaging action (on GitHub) should have made an atompm-portable.zip file. Attach this to the release.

#platform

winpython_url="https://github.com/winpython/winpython/releases/download/4.3.20210620/Winpython32-3.9.5.0dot.exe"
nodejs_zip_url="https://nodejs.org/dist/v16.13.0/node-v16.13.0-win-x64.zip"
chrome_url="https://github.com/portapps/ungoogled-chromium-portable/releases/download/92.0.4515.107-11/ungoogled-chromium-portable-win64-92.0.4515.107-11.7z"
manual_url="https://media.readthedocs.org/pdf/atompm/latest/atompm.pdf"

#$(curl --silent "https://api.github.com/repos/AToMPM/atompm/releases/latest" | grep -Po '"tag_name": "\K.*?(?=")')


#exit on errors
set -e

echo "Packaging AToMPM"

#echo $nodejs_zip_url
#echo $portable_python_url
#echo $igraph_whl_url

# STEPS
# 1. Download Python

function get_WP() {
    echo "Downloading WinPython"
    
    WP_file=$(basename $winpython_url)
    echo $WP_file

    if [ ! -f $WP_file ]; then
        echo "Downloading $winpython_url" 
        curl -O $winpython_url -L
    fi

    #   c. Install WinPython
    7z x Winpython*.exe
    
    mkdir atompm-portable/platform/WinPython
    mv WPy*/* ./atompm-portable/platform/WinPython/
    
    #   d. Install dependencies
    wine atompm-portable/platform/WinPython/python*/python.exe -m pip install requests python-igraph six python-socketio python-socketio[client] websocket-client
    
}

function get_nodejs() {
    echo "Downloading NodeJS"
    # 2. Download node.js https://nodejs.org/en/download/
    #   a. Choose Windows Binary (.zip)

    nodejs_file=$(basename $nodejs_zip_url)
    echo $nodejs_file

    if [ ! -f $nodejs_file ]; then
        echo "Downloading $nodejs_zip_url" 
        curl -O $nodejs_zip_url
    fi

    unzip -o $nodejs_file -d atompm-portable/platform/
    mv atompm-portable/platform/node-v* atompm-portable/platform/NodeJS
}

# 3. Add ChromePortable

function get_chrome() {
    echo "Downloading PortableChrome"
    chrome_file=$(basename $chrome_url)
    echo $chrome_file

    if [ ! -f $chrome_file ]; then
        echo "Downloading $chrome_url" 
        curl -O $chrome_url -L
    fi
    
    mkdir ./atompm-portable/platform/ChromiumPortable
    7z x ungoogled-chromium-*.7z -o./atompm-portable/platform/ChromiumPortable
    
    mv ./atompm-portable/platform/ChromiumPortable/ungoogled-chromium* ./atompm-portable/platform/ChromiumPortable/ChromiumPortable.exe

}

# 4. Add AToMPM files
function add_atompm () {

    echo "Adding AToMPM"
    
    rm -rf atompm-portable/atompm
    cd atompm-portable
    git clone --depth 1 https://github.com/AToMPM/atompm.git
    cd atompm
    rm -rf .git
    
    npm install --production
    
    cd ../..
}


# 5. Add Windows batch scripts

function add_batch_scripts (){
    echo "Adding batch scripts"
    cp ./windows_scripts/*.bat atompm-portable/
}
# 6. Add manual

function add_manual(){
        echo "Adding manual"
        manual_filename="atompm-userguide.pdf"
        
        curl $manual_url -o $manual_filename
        cp $manual_filename atompm-portable/
        rm $manual_filename
}

###MAIN######

mkdir ./atompm-portable
mkdir ./atompm-portable/platform

if [ ! -d ./atompm-portable/platform/WinPython ]; then
    get_WP
fi

if [ ! -d ./atompm-portable/platform/NodeJS ]; then
    get_nodejs
fi

if [ ! -d ./atompm-portable/platform/ChromiumPortable ]; then
    get_chrome
fi

add_atompm
add_batch_scripts
#add_manual

#rm ./atompm-portable.zip

#zip -r ./atompm-portable.zip atompm-portable/

