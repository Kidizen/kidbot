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

    robot.hear(/is it whiskey time.*/i, function(reply) {
        timeForWhiskey(reply);
    });
    robot.hear(/is it time for whiskey.*/i, function(reply) {
        timeForWhiskey(reply);
    });

    robot.hear(/(kidbot sales|kidbot sales.)$/i, function(reply) {

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

        robot.hear(/kidbot sales detail/i, function(reply) {

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