# We See

## Server setup

First, create a VPS and ssh into it.

Install Node 6.x and npm:

```
$ cd ~
$ sudo bash nodesource_setup.sh
$ curl -sL https://deb.nodesource.com/setup_6.x -o nodesource_setup.sh
$ sudo bash nodesource_setup.sh
$ sudo apt-get install nodejs
$ rm nodesource_setup.sh
```

Install pm2:

```
$ npm install pm2 -g 
```