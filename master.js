var express = require('express');
var app = express();

app.use(express.bodyParser());

var config = require('../config');
if (!config.master || !config.db)
    console.log("config file error!");

var dbConnect = require('./dbConnect').dbConnect;
var db = dbConnect(config.db);
var dbFullText = dbConnect(config.dbFullText);

function debugPrint(msg) {
    if (config.master.debug)
        console.log(msg);
}

function getResponseTimeout() {
    return (new Date((new Date()) - config.master.responseTimeout));
}

var numreqs = 0;
function reqCount() {
    ++numreqs;
    if (numreqs % 1000 == 0)
        process.stdout.write(numreqs + "\t");
}

app.post('/ip/getnext', function(req, res){
    reqCount();
    var expireTime = new Date();
    expireTime.setDate(expireTime.getDate() - 7);
    db.collection('domains').findAndModify(
        { // query
            $or: [
                // when ipLastUpdate exists, ipSpiderNodes and ipLastCrawl should exist
                {ipLastUpdate: null},
                {
                    ipLastUpdate: {$lt: expireTime},
                    ipSpiderNodes: {$lt: 10},
                    ipLastCrawl: {$lt: getResponseTimeout()},
                },
            ],
        },
        [], // sort
        {$set: {ipLastCrawl: new Date()}}, // update
        {}, // options
        function(err, data){
            if (err) {
                res.send(500);
                debugPrint(err);
            }
            else {
                if (!data || typeof data.domain != "string")
                    res.send(404);
                else {
                    res.send(data.domain);
                    debugPrint('/ip/getnext ' + data.domain);
                }
            }
        });
});

app.post('/ip/data', function(req, res){
    reqCount();
    if (typeof req.body.domain == "string" && typeof req.body.ip == "string") {
        var ip = JSON.parse(req.body.ip);
        if (!(ip instanceof Array)) {
            res.send(400);
            return;
        }
        debugPrint('/ip/data ' + req.body.domain);
        db.collection('domains').update(
            {domain: req.body.domain},
            {
                $set: {ipLastUpdate: new Date()},
                $inc: {ipSpiderNodes: 1},
                $addToSet: {ip: {$each: ip }},
            }
        );
        res.send(200);
    }
    else {
        res.send(400);
    }
});

app.post('/whois/getnext', function(req, res){
    reqCount();
    var expireTime = new Date();
    expireTime.setMonth(expireTime.getMonth() - 1);
    db.collection('domains').findAndModify(
        {
            $or: [
                {whoisLastUpdate: null},
                {
                    whoisLastUpdate: {$lt: expireTime},
                    whoisLastCrawl: {$lt: getResponseTimeout()},
                },
            ],
        },
        [],
        {$set: {whoisLastCrawl: new Date()}},
        {},
        function(err, data){
            if (err)
                res.send(500);
            else {
                if (!data || typeof data.domain != "string")
                    res.send(404);
                else {
                    res.send(data.domain);
                    debugPrint("/whois/getnext " + data.domain);
                }
            }
        });
});

function parseStandardRegistrant(text) {
    var fields = ['Name', 'Organization', 'Street', 'City', 'State/Province',
        'Postal Code', 'Country', 'Phone', 'Fax', 'Email'];
    var data = {};
try {
    var captureexp = new RegExp(":[ \t]*([^\r\n]+)");
    for (var i in fields) {
        var regexp = new RegExp("Registrant " + fields[i] + "[^:]*:[ \t]*([^\r\n]+)", "gi");
        var match = text.match(regexp);
        if (match instanceof Array) {
            var values = [];
            for (var j in match) {
                var capture = match[j].match(captureexp);
                if (capture && capture[1])
                    values.push(capture[1]);
            }
            data[fields[i]] = values.join(' ');
        }
        else
            data[fields[i]] = '';
    }
} catch(e) {
    console.log(e);
}
    return data;
}

function parseRegistrant(text) {
try {
    var data = parseStandardRegistrant(text);
    for (var i in data) {
        if (data[i]) // as long as one field is extracted, it is considered standard
            return data;
    }

    data = {};
    var capture = text.match(/[a-z0-9.+_-]@[a-z0-9.-]+/i);
    data['Email'] = capture[0];
    capture = text.match(/(Tel|Phone|Mobile)(^[0-9.+])*([0-9.+ -]+)/i);
    data['Phone'] = capture[3];
    capture = text.match(/(Fax)(^[0-9.+])*([0-9.+ -]+)/i);
    data['fax'] = capture[3];
    return data;
} catch(e) {
    return {};
}
}

function parseWhois(domain, text) {
    if (domain.substr(-4) == ".org") {
        var fields = {
            createTime: 'Created',
            updateTime: 'Updated',
            expireTime: 'Expiration',
            registrar: 'Registrar',
        }
    }
    else { // .com, .net, .info
        var fields = {
            createTime: 'Creation',
            updateTime: 'Updated',
            expireTime: 'Expiration',
            whoisServer: 'Whois Server',
            registrar: 'Registrar',
        }
    }

    var data = {};
try {
    var realText = text.substr(text.indexOf(domain.toUpperCase()));
    if (!realText)
        return {};
    for (var key in fields) {
        var regexp = new RegExp("[a-z0-9 _-]*" + fields[key] + "[a-z0-9 _-]*:[ \t]*([^\r\n]+)\r?\n", "i");
        var match = realText.match(regexp);
        if ((match instanceof Array) && match[1])
            data[key] = match[1];
        else
            data[key] = '';
        if (key.indexOf('Time') >= 0) // convert to date object, assume UTC
            data[key] = new Date(data[key] + " UTC");
    }
} catch(e) {
    console.log(e);
}
    return data;
}

app.post('/whois/data', function(req, res){
    reqCount();
    if (typeof req.body.domain == "string" && typeof req.body.whois == "string") {
        debugPrint("/whois/data " + req.body.domain);
        var toinsert = {
            registrant: parseRegistrant(req.body.whois),
            whois: parseWhois(req.body.domain, req.body.whois),
            whoisLastCrawl: new Date(),
        }
        db.collection('domains').update(
            {domain: req.body.domain},
            {$set: toinsert}
        );
        dbFullText.collection('whois').update(
            {domain: req.body.domain},
            {$set: {whoisText: req.body.whois}},
            {upsert: true}
        );
        res.send(200);
    }
    else {
        res.send(400);
    }
});

var port = 62222;
app.listen(port, '127.0.0.1');
console.log('Listening on port ' + port);
