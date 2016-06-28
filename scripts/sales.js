module.exports = function(robot) {

    Number.prototype.format = function(n, x) {
        var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\.' : '$') + ')';
        return this.toFixed(Math.max(0, ~~n)).replace(new RegExp(re, 'g'), '$&,');
    };

    function getTimeForWhiskeyAuth() {
        var username = process.env['TIMEFORWHISKEY_USERNAME'];
        var password = process.env['TIMEFORWHISKEY_PASSWORD'];
        return new Buffer(username + ':' + password).toString('base64');
    }

    function toMoney(str) {
        try {
            return '$' + parseFloat(str).format(2);
        } catch(e) {
            return '$0.00';
        }
    }

    function toPercent(str) {
        try {
            return Math.round(parseFloat(str) * 100) + '%';
        } catch(e) {
            return e.message;
        }
    }

    function getSalesInfo(reply) {

        var pg, pool;
        try {
            pg = require('pg');

            // env variables read for connection info:
            // PGUSER
            // PGDATABASE
            // PGPASSWORD
            // PGPORT
            pool = new pg.Pool({
              max: 10,
              ssl: true,
              idleTimeoutMillis: 1000 * 60 * 5
            });

        } catch(e) {
            reply.send('I FAIL: ' + e.message);
            return;
        }
        pool.connect(function(err, client, done) {

            if (err) {
                reply.send('Poop. I fail: ' + err);
                return;
            }

            client.query('SELECT COUNT(*) FROM orders', function(err, result) {

                done();

                if (err) {
                    reply.send('Poop. I fail: ' + err);
                } else {
                  reply.send('WIN: ' + result.rows[0].count);
                }
            });
        });
    }

    function timeForWhiskey(reply) {
        robot.http('http://timeforwhiskey.kidizen.com/sales')
            .header('Authorization', 'Basic ' + getTimeForWhiskeyAuth())
            .header('Accept', 'application/json')
            .get()(function(err, res, body) {
                res = res || {};
                if (!err && body) {
                    body = JSON.parse(body);
                    if (body.success) {
                        reply.send('Yes! :whiskey:');
                    } else {
                        reply.send('Not yet. (' + toMoney(body.total)  + ')');
                    }
                }
           });
    }

    robot.respond(/will it work/i, function(reply) {
      getSalesInfo(reply);
    });
    robot.hear(/is it whiskey time.*/i, function(reply) {
        timeForWhiskey(reply);
    });
    robot.hear(/is it time for whiskey.*/i, function(reply) {
        timeForWhiskey(reply);
    });

    robot.respond(/sales/i, function(reply) {

        robot.http('http://timeforwhiskey.kidizen.com/sales')
            .header('Authorization', 'Basic ' + getTimeForWhiskeyAuth())
            .header('Accept', 'application/json')
            .get()(function(err, res, body) {
                res = res || {};
                if (!err && body) {
                    body = JSON.parse(body);
                    reply.send(':moneybag: ' + toMoney(body.total) + ' ( :kidbucks: ' + toPercent(body.kidbucks_percent) + ')');
                }
            });
    });

    robot.respond(/sales detail/i, function(reply) {

        robot.http('http://timeforwhiskey.kidizen.com/sales')
            .header('Authorization', 'Basic ' + getTimeForWhiskeyAuth())
            .header('Accept', 'application/json')
            .get()(function(err, res, body) {
                res = res || {};
                if (!err && body) {
                    body = JSON.parse(body);
                    reply.send(':moneybag: ' + toMoney(body.total) + '\n:dress: ' + toMoney(body.order) + '\n :label: ' + toMoney(body.label) + '\n :ios: ' + toPercent(body.ios_percent) + '\n :android: ' + toPercent(body.android_percent) + '\n :kidbucks: ' + toPercent(body.kidbucks_percent));
                }
            });
    });
}