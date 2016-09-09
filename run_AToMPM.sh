#!/bin/bash
# Author: Yentl Van Tendeloo

set -e
working_dir=`pwd`

if [ ! -d "dependencies" ]; then
    mkdir dependencies

    # Install socket.IO first
    curl -L -O https://msdl.uantwerpen.be/AToMPM/socketIO.tgz
    tar -xvzf socketIO.tgz

    cd dependencies
    # First fetch Node.JS
    curl -L -O http://msdl.uantwerpen.be/AToMPM/node-v0.10.46.tar.gz
    tar -xvzf node*
    cd node*
    ./configure --prefix=$working_dir/dependencies/node.js
    make -j5
    make install
    cd ..

    # Install Python with development headers
    # Install zlib seperately
    curl -L -O http://msdl.uantwerpen.be/AToMPM/zlib-1.2.8.tar.gz
    tar -xvzf zlib-1.2.8.tar.gz
    cd zlib-1.2.8
    ./configure --prefix=$working_dir/dependencies/localPython
    make
    make install
    cd ..
    curl -L -O http://msdl.uantwerpen.be/AToMPM/Python-2.7.8.tgz
    tar -xvzf Python-2.7.8.tgz
    cd Python-2.7.8
    ./configure --prefix=$working_dir/dependencies/localPython
    sed -i "s/^#zlib/zlib/g" Modules/Setup
    make -j5
    make install
    export PATH=$working_dir/dependencies/localPython/bin:$PATH
    cd ..

    # Remove previous builds
    rm -rf python-igraph || true
    mkdir python-igraph
    cd python-igraph

    # Install igraph C core
    curl -L -O http://msdl.uantwerpen.be/AToMPM/igraph-0.6.5.tar.gz
    tar -xvzf igraph-0.6.5.tar.gz
    cd igraph-0.6.5
    ./configure
    make -j5

    # Install python-igraph binding
    curl -L -O http://msdl.uantwerpen.be/AToMPM/python-igraph-0.6.5.tar.gz
    tar -xvzf python-igraph-0.6.5.tar.gz
    cd python-igraph-0.6.5
    rm setup.cfg
    echo "[build_ext]" > setup.cfg
    echo "include_dirs = ../../../localPython/include/python2.7:../../build/include:../include:../../include:/usr/local/include:/usr/include" >> setup.cfg
    echo "library_dirs = ../../../localPython/lib:../../build/src/.libs:../lib/:../src/.libs:../../src/.libs:/usr/local/lib:/usr/lib" >> setup.cfg
    echo "" >> setup.cfg
    echo "[egg_info]" >> setup.cfg
    echo "tag_build = " >> setup.cfg
    echo "tag_date = 0" >> setup.cfg
    echo "tag_svn_revision = 0" >> setup.cfg
    python setup.py install --user
    cd ..

    echo "INSTALLATION SUCCESSFUL"
    echo "Continuing to start up AToMPM!"
    cd ..
fi

# Set PATHs correctly
export PATH=$working_dir/dependencies/localPython/bin:$working_dir/dependencies/node.js/bin:$PATH
export LD_LIBRARY_PATH="$working_dir/dependencies/python-igraph/igraph-0.6.5/src/.libs/:$working_dir/dependencies/localPython/lib"

node httpwsd.js &
sleep 3
python mt/main.py
