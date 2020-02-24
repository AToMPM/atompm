FROM ubuntu:18.04

RUN apt-get update -y && \
		apt-get upgrade -y
		
RUN apt-get install -y git

RUN apt-get install -y curl

RUN apt-get install -y zlib1g-dev libxml2-dev

RUN apt-get install -y pkg-config

RUN apt-get install -y python3 python3-pip

RUN pip3 install python-igraph

RUN apt-get install -y nodejs npm

RUN mkdir /opt/atompm

WORKDIR /opt/atompm/

RUN git clone http://msdl.uantwerpen.be/git/simon/AToMPM.git .

RUN npm install

COPY run_AToMPM_local.sh ./run_AToMPM_local.sh

# Port
EXPOSE 8124

CMD ["bash", "run_AToMPM_local.sh"]