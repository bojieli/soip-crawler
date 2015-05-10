var MongoDb = require('mongodb').Db;
var MongoServer = require('mongodb').Server;

exports.dbConnect = function(dbconf) {
    var db = new MongoDb(dbconf.name, new MongoServer(dbconf.host, dbconf.port, {auto_reconnect: true}, {}), {w:0, native_parser: false});
    db.open(function(err, dbh){
        if (typeof dbconf.user == "string")
            dbh.authenticate(dbconf.user, dbconf.pass, function(){});
    });
    return db;
};
