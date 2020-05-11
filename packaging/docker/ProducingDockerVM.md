# Do Once: Creating the VM

1. Create the VM:
   1. `docker create --name atompmrun -p 8124:8124 -ti atompmvm` 
2. Open your browser and navigate to `http://localhost:8124/atompm`
   1. If there is a problem in this step, it might be because you are running docker on Windows. In that case, use the machine IP instead of `localhost` in the above address. Find the host's IP address by running `docker-machine ip`.
   
# Exporting the VM

1. Install [Docker](https://www.docker.com/).

1. Using docker's console, navigate to the root of this repository.

1. Build the docker image. This will download all dependencies you need to run the examples. You might need root access.

1. ```
   docker build -t atompmvm .
   ```

1. Export the docker vm:

   1. `docker save atompmvm | gzip > atompmvm.tar.gz`

# Loading the VM

```
docker load < atompmvm.tar.gz
```

# Running the VM

1. Note the host's IP address by running: 

   1. `docker-machine ip`. 
   1. Let us denote it by `MACHINE_IP`
1. Run the docker container (one of the following)
   1. `docker run --name atompmrun -p 8124:8124 -ti atompmvm` 
1. Open your browser and navigate to `http://MACHINE_IP:8124/`

# Starting and Stopping VM

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

# Moving files in/out of VM

*You can run docker commands from different terminals.*

From VM to host (backup).
```
docker cp atompmrun:/opt/atompm/users/. ./atompmusers/
```

From host to VM (restore):
```
docker cp ./atompmusers/. atompmrun:/opt/atompm/users/
```

# Do Once: Cleaning Up (!)

These commands can be run from a second docker terminal.

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

