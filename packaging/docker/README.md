# Instructions for AToMPM and Docker

 
## Building the Image

1. Install [Docker](https://www.docker.com/).

1. Using docker's console, navigate to the root of this repository.

1. Build the docker image. This will download all dependencies you need to run AToMPM. You might need root access for this and the following commands.

1. `docker build -t atompmvm .`

1. Export the docker image:

   1. `docker save atompmvm | gzip > atompmvm.tar.gz`

## Loading the Image

```
docker load < atompmvm.tar.gz
```

## Running the Container

1. Run the docker container (one of the following)
   1. `docker run --name atompmrun -p 8124:8124 -ti atompmvm` 
1. Open your browser and navigate to `http://localhost:8124/`

## Starting and Stopping the Container

*You can run docker commands from different terminals.*

To start the container (and attach):
```
docker start -a atompmrun 
```

To attach to a container:
```
docker attach atompmrun
```

Stop container:
```
docker stop atompmrun
```

List container status
```
docker container ls -a
```

## Moving files in/out of the Container

*You can run docker commands from different terminals.*

From container to host (backup).
```
docker cp atompmrun:/opt/atompm/users/. ./atompmusers/
```

From host to container (restore):
```
docker cp ./atompmusers/. atompmrun:/opt/atompm/users/
```

## Do Once: Cleaning Up (!)

Delete container:
**Danger: you will lose all the files modified inside the VM. This includes all models created in atompm!**
```
docker rm atompmrun
```

Delete image:
```
docker image rm atompmvm
```

Delete dangling caches:
```
docker system prune
```

