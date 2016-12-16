# We See

"We See" by Man Bartlett, for [Person of the Crowd](http://www.barnesfoundation.org/exhibitions/upcoming/person-of-the-crowd) at The Barnes Foundation.

## Todo

- Implement design for text.
- Move to a daemonized setup and start on server restart?
- Better whitelist situation?

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

Clone this repo:

```
$ git clone https://github.com/kylemcdonald/wesee.git
```

Run the app:

```
$ cd wesee
$ npm install
$ node -r dotenv/config app.js
```