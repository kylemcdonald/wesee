// load all requirements and create express app
var _ = require('lodash');
var fs = require('fs');
var http = require('http');
var requestIp = require('request-ip');
var express = require('express');
var touch = require('touch');
var app = express();

// load whitelist from env in format:
// WHITELIST='["::1", "127.0.0.1"]'
var whitelist = JSON.parse(process.env.WHITELIST);
console.log('Loaded whitelist:');
whitelist.forEach(function (ip) {
	console.log(" - " + ip);
})

// load database of captioned content from DB_FILE
console.log('Loading from database ' + process.env.DB_FILE);
var precaption = [];
var postcaption = [];
touch(process.env.DB_FILE); // make sure it exists
var rawdb = fs.readFileSync(process.env.DB_FILE, 'utf8');
rawdb.split(/\r?\n/).forEach((line) => {
	line = line.replace(/\r?\n/, '');
	if(line.length > 0) {
		try {
			var cur = JSON.parse(line);
			precaption.push(cur);
			postcaption.push(cur);
		} catch (e) {
			console.log('Error in database: ' + line);
		}
	}
})
console.log('Loaded ' + postcaption.length + ' records.');

function getDescription(url, cb, err) {
	var postData = JSON.stringify({
	 	'url' : url
	});

	var options = {
		hostname: 'api.projectoxford.ai',
		port: 80,
		path: '/vision/v1.0/describe',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Ocp-Apim-Subscription-Key': process.env.OCP_API_KEY
		}
	};

	var req = http.request(options, (res) => {
		if(res.statusCode == 200) {
			res.setEncoding('utf8');
			res.on('data', (chunk) => {
				var data = JSON.parse(chunk);
				console.log(data);
				var caption = data.description.captions[0].text;
				if(typeof caption !== "undefined") {
					cb(caption);
				} else {
					console.log("Caption is undefined.");
				}
			});
		} else {
			err(res.statusCode);
		}
	});

	req.on('error', (e) => {
		err(e.message);
	});

	req.write(postData);
	req.end();
}

// create instagram private api connection
var Promise = require('bluebird');
var Client = require('instagram-private-api').V1;
var device = new Client.Device(process.env.USERNAME);
var storage = new Client.CookieFileStorage(__dirname + '/cookies/' + process.env.USERNAME + '.json');
var session;
Client.Session.create(device, storage, process.env.USERNAME, process.env.PASSWORD)
	.then(function(s) {
		session = s;
		console.log('Logged in to Instagram with username ' + process.env.USERNAME);
		regularCheck();
	})

// routes
app.use(requestIp.mw());
app.get('/', (req, res, next) => {
	if(whitelist.indexOf(req.clientIp) != -1) {
		next();
	} else {
		res.status(403).end('Forbidden: ' + req.clientIp);
	}
});

app.use('/', express.static('public'));

// send an error if the instagram session is unavailable
app.use(function (req, res, next) {
	if(typeof(session) === 'undefined') {
		res.sendStatus(500);
	} else {
		next();
	}
})

function getTaggedMedia(query, cb, err) {
	if(typeof(query.limit) === 'undefined' || !query.limit) {
		query.limit = 0;
	}
	try {
		var feed = new Client.Feed.TaggedMedia(session, query.tag);
		var page = feed.get();
		page.then(function(media) {
			query.limit = Math.min(query.limit, media.length) || media.length;
			var compiled = _.map(_.range(0, query.limit), function(i) {
				var cur = media[i];
				var params = cur._params;
				var account = cur.account._params;
				var url = params.images[0].url;
				url = url.replace(/\?.*/, ''); // remove ig_cache_key
				return {
					'timestamp': params.takenAt,
					'url': url
				};
			});
			cb(compiled);
		});
	} catch (e) {
		if(typeof(err) !== 'undefined') {
			err(e);
		} else {
			console.error('Error in getTaggedMedia: ' + e);
		}
	}
}

app.get('/search', function (req, res) {
	var query = req.query;
	if(typeof(query.tag) === undefined) {
		res.sendStatus(500);
		return;
	}
	if(typeof(query.limit) === undefined) {
		query.limit = 10;
	}
	getTaggedMedia(query, function(data) {
		res.send(data);
	});
});

app.get('/all.json', (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.json(postcaption);
});

app.get('/recent.json', (req, res) => {
	var limit = req.query.limit || 10;

	res.setHeader('Content-Type', 'application/json');
	if(postcaption.length < 1) {
		res.json({});
		return;
	}
	var sorted = _.sortBy(postcaption, 'timestamp');
	var last = sorted.slice(-limit); // send 10 most recent
	res.json(last);
});

function add(img) {
	if(typeof(img.url) === 'undefined') {
		console.error('No url for image:');
		console.error(img);
		return;
	}
	if(typeof(img.timestamp) === 'undefined') {
		console.error('No timestamp for image:');
		console.error(img);
		return;
	}

	if(_.findLast(precaption, {'url': img.url})) {
		// ignore duplicates
		// console.log('duplicate ' + img.url);
		return false;
	}

	// console.log('adding ' + img.url);
	precaption.push(img);
	
	getDescription(img.url, (description) => {
		img.text = description;
		postcaption.push(img);
		fs.appendFileSync(process.env.DB_FILE, JSON.stringify(img) + '\n');
		console.log(img);
	}, (err) => {
		console.log('Error: ' + err);
	});

	return true;
}

app.get('/add', (req, res) => {
	res.end();

	var i = req.url.indexOf('?');
	var url = req.url.substr(i + 1);

	var img = {
		timestamp: new Date().getTime(),
		url: url
	};
	console.log(img);

	add(img);
});

function regularCheck() {
	console.log(new Date() + ' Checking Instagram.');
	getTaggedMedia({
		tag: process.env.HASHTAG,
		limit: process.env.LIMIT
	}, function(data) {
		// console.log(new Date() + ' Success:');
		// console.log(data);
		var total = _.sum(data.map(add));
		console.log('Added ' + total + '/' + data.length + ' urls.')
	}, function(err) {
		console.log(new Date() + ' Error:');
		console.log(err);
	})
	setTimeout(regularCheck, process.env.REFRESH_RATE * 1000);
}

var server = app.listen(process.env.PORT || 3000, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log('Example app listening at http://%s:%s', host, port);
});