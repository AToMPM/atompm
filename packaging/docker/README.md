# Student Workflow

## Do Once: Creating the VM

1. Create the VM:
   1. `docker create --name atompmrun -p 8124:8124 -ti atompmvm` 
2. Open your browser and navigate to `http://localhost:8124/atompm`
   1. If there is a problem in this step, it might be because you are running docker on windows. In that case, use the machine IP instead of `localhost` in the above address. Find the host's IP address by running `docker-machine ip`.

## Starting and Stopping VM

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

## Moving files in/out of VM

*You can run docker commands from different terminals.*

From VM to host (backup).
```
docker cp atompmrun:/opt/atompm/users/. ./atompmusers/
```

From host to VM (restore):
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

