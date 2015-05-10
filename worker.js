var http = require('http');
var querystring = require('querystring');
var whois = require('node-whois');
var dns = require('dns');

var debug = false;
if (debug) {
    var masterHost = '127.0.0.1';
    var masterPort = 62222;
} else {
    var masterHost = "whois.freeshell.ustc.edu.cn";
    var masterPort = 80;
}

function postData(path, post_data) {
    var content = querystring.stringify(post_data);
    var req = http.request({
        host: masterHost,
        port: masterPort,
        method: "POST",
        path: path,
        headers: {
            'Content-Type':'application/x-www-form-urlencoded',
            'Content-Length': content.length
        },
    });
    req.on('error', function(e){
        console.log("request error (" + path + ") " + e.message);
    });
    req.write(content);
    req.end();
}

function getDomain(path, cont) {
    var req = http.request({
        host: masterHost,
        port: masterPort,
        method: "POST",
        path: path,
    }, cont);
    req.on('error', function(e){
        console.log("request error (" + path + ") " + e.message);
    });
    req.end();
}

function getIP() {
    getDomain("/ip/getnext", function(res){
        res.setEncoding('utf8');
        var text = '';
        res.on('data', function(chunk) {
            text += chunk;
        });
        res.on('end', function(){
        try {
            var domains = JSON.parse(text);
            if (!(domains instanceof Array))
                return;
            var pending = domains.length;
            var result = {};
            for (var i in domains) {
                (function(domain){
                dns.resolve4(domain, function(err, addresses){
                    --pending;
                    result[domain] = addresses ? addresses : [];
                    if (pending <= 0) {
                        if (debug)
                            console.log("ip " + JSON.stringify(result));
                        postData("/ip/data", {data: JSON.stringify(result)});
                    }
                });
                })(domains[i]);
            }
        } catch(e){
        }
        });
    });
}

function getWhois() {
    getDomain("/whois/getnext", function(res){
        res.setEncoding('utf8');
        res.on('data', function(domain){
            if (debug)
                console.log("whois " + domain);

            whois.lookup(domain, function(err, data){
                if (err || (typeof data != "string") || data.length == 0)
                    return;
                postData("/whois/registrant", {
                    domain: domain,
                    whois: data
                });
            });

            whois.lookup(domain, {follow:0}, function(err, data){
                if (err || (typeof data != "string") || data.length == 0)
                    return;
                postData("/whois/data", {
                    domain: domain,
                    whois: data
                });
            });
        });
    });
}

setInterval(getWhois, 4000);
setInterval(getIP, 20000);
