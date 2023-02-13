# Instructions for AToMPM and Docker

 
## Building the Image

1. Install [Docker](https://www.docker.com/).

1. Using docker's console, navigate to the root of this repository.

1. Build the docker image. This will download all dependencies you need to run AToMPM. You might need root access for this and the following commands.

1. `docker build -t atompm:latest .`

1. Export the docker image:

   1. `docker save atompm:latest | gzip > atompmvm.tar.gz`

## Loading the Image

```
docker load < atompmvm.tar.gz
```

## Running the Container with Docker Compose

1. The first time you want to run the container you need to update the docker-compose.yml
   1. replace the <id> in the `user: <id>:<id>` entry with the user id that will run the container
      1. you can get the user id by runing `id -u` in a console
1. In the folder with the docker-compose.yml file
   1. `docker compose up -d`
1. Open your browser and navigate to `http://localhost:8124/`

this will create all log files in ./files from the location of the docker-compose.yml file

## Stoping the Container

1. if you started the container with the -d option to run it in the background you can stop it with
   1. `docker compose down` 



