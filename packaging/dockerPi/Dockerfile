FROM ubuntu:rolling

RUN apt-get update -y
RUN apt-get upgrade -y

RUN apt-get -y --with-new-pkgs upgrade

RUN apt-get -y autoremove
		
RUN apt-get install -y git

#RUN apt-get install -y curl

#RUN DEBIAN_FRONTEND="noninteractive" apt-get -y install tzdata

#RUN apt-get install -y zlib1g-dev libxml2-dev

#RUN apt-get install -y pkg-config

RUN apt-get install -y python3 python3-pip

RUN pip3 install six

RUN pip3 install python-igraph

RUN pip3 install requests python-socketio python-socketio[client] websocket-client

RUN apt-get install -y nodejs npm

RUN mkdir /opt/atompm

WORKDIR /opt/atompm/

RUN git clone https://github.com/AToMPM/atompm.git .

RUN npm install --production

COPY run_AToMPM_local.sh ./run_AToMPM_local.sh

# Port
EXPOSE 8124

CMD ["bash", "run_AToMPM_local.sh"]
#CMD ["bash"]

