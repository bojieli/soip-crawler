var readline = require('readline');
var dbconf = require('../config').db;
var db = require('./dbConnect').dbConnect(dbconf);

console.log('waiting...');

// wait 2 seconds for DB connection
setTimeout(function(){
    db.collection('domains').ensureIndex({domain: 1}, {unique: true, dropDups: true});
    db.collection('domains').ensureIndex({ipLastUpdate: 1, ipSpiderNodes: 1, ipLastCrawl: 1});
    db.collection('domains').ensureIndex({whoisLastUpdate: 1, whoisLastCrawl: 1});
    db.collection('domains').ensureIndex({ip: 1});
    db.collection('domains').ensureIndex({"registrant.Email": 1});
    db.collection('domains').ensureIndex({"whois.createTime": 1});
    db.collection('domains').ensureIndex({"whois.updateTime": 1});
    db.collection('domains').ensureIndex({"whois.expireTime": 1});
}, 2000);

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
});

setTimeout(function(){

console.log('Ready.');
var total = 0;
var domains = [];
rl.on('line', function(line) {
    var domain = line.toLowerCase();
    if (!domain.match(/^[a-z0-9-]+\.[a-z]+$/)) {
        //console.log("Invalid line " + domain);
        return;
    }
    domains.push({domain: domain});

    // bulk insert
    ++total;
    if (total % 10000 == 0) {
        //process.stdout.write(total + "\t");
        db.collection('domains').insert(domains);
        domains = [];
    }
});

}, 5000); // wait 5 seconds for DB connection and index creation
