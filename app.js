var dotenv = require('dotenv');
dotenv.load();

var _ = require('lodash');
var Promise = require('bluebird');
var Client = require('instagram-private-api').V1;
var device = new Client.Device(process.env.USERNAME);
var storage = new Client.CookieFileStorage(__dirname + '/cookies/' + process.env.USERNAME + '.json');
var session;
Client.Session.create(device, storage, process.env.USERNAME, process.env.PASSWORD)
    .then(function(s) {
        session = s;
        console.log('Logged in to Instagram with username ' + process.env.USERNAME);
    })

var express = require('express');
var app = express();

app.use('/', express.static('public'));

// send an error if the instagram session is unavailable
app.use(function (req, res, next) {
    if(typeof(session) === 'undefined') {
        res.sendStatus(500);
    } else {
        next();
    }
})

app.get('/latest', function (req, res) {
    var query = req.query;
    if(typeof(query.tag) === undefined) {
        res.sendStatus(500);
        return;
    }
    if(typeof(query.limit) === undefined) {
        query.limit = 10;
    }
    var feed = new Client.Feed.TaggedMedia(session, query.tag);
    var page = feed.get();
    page.then(function(media) {
        var compiled = _.map(_.range(0, query.limit), function(i) {
            var cur = media[i];
            var params = cur._params;
            var account = cur.account._params;
            return {
                'code': params.code,
                'takenAt': params.takenAt,
                'caption': params.caption,
                'url': params.images[0].url,
                'fullName': account.fullName,
                'username': account.username
            };
        });
        res.send(compiled);
    });
});

var server = app.listen(process.env.PORT || 3000, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Example app listening at http://%s:%s', host, port);
});