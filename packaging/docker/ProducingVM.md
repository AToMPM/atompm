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

1. Note the host's ip address by running: 

   1. `docker-machine ip`. 
   1. Let us denote it by `MACHINE_IP`
1. Run the docker container (one of the following)
   1. `docker run --name atompmrun -p 8124:8124 -ti atompmvm` 
1. Open your browser and navigate to `http://MACHINE_IP:8888/`
# Stopping and Cleaning

These commands can be run from a second docker terminal.

Stop and remove container:

```
docker stop atompmrun 
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

# Moving files in and out of the VM

```
docker cp ./atompmuser/** atompmrun:/opt/atompm/users/atompmuser/
docker cp atompmrun:/opt/atompm/users/atompmuser/** ./atompmuser/
```

