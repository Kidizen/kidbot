// Description:
//   you know, for kids
//
// Dependencies:
//   None
//
// Configuration:
//   None
//
// Commands:
//   hubot is it whiskey time - well, is it?
//   hubot is time for whiskey - well, is it?
//   hubot sales - show me the money
//   hubot sales detail - show me more info about the money
//   hubot when is whiskey - when will it be whiskey time?
//   hubot set whiskey bar to N - raise/lower the bar to N dollars
//   hubot [total|ios|android|web|order|label] [record|milestone] -
//   hubot set[total|ios|android|web|order|label] [record|milestone] to N

module.exports = function(robot) {

    var dateFormat = require('dateformat');
    var pg = require('pg');

    // env variables read for connection info:
    // PGUSER
    // PGDATABASE
    // PGPASSWORD
    // PGPORT
    var pool = new pg.Pool({
      max: 10,
      ssl: true,
      idleTimeoutMillis: 1000 * 60 * 5
    });

    let TIMEZONE = 'CDT';

    Number.prototype.format = function(n, x) {
        var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\.' : '$') + ')';
        return this.toFixed(Math.max(0, ~~n)).replace(new RegExp(re, 'g'), '$&,');
    };

    function getQuery() {
        var now = new Date();
        return "SELECT \
                round((tmp.gross_sales_cents - tmp.refunded_sales_cents + tmp.gross_labels - tmp.refunded_labels - tmp.refunded_label_fees) / 100.0, 2) AS total, \
                round((tmp.gross_sales_cents - tmp.refunded_sales_cents) / 100.0, 2) AS order, \
                round((tmp.gross_labels - tmp.refunded_labels - tmp.refunded_label_fees) / 100.0, 2) AS label, \
                round((tmp.gross_ios_cents - tmp.refunded_ios_cents) / 100.0, 2) AS ios, \
                round((tmp.gross_android_cents - tmp.refunded_android_cents) / 100.0, 2) AS android, \
                round((tmp.gross_web_cents - tmp.refunded_web_cents) / 100.0, 2) AS web, \
                round((tmp.gross_ios_cents - tmp.refunded_ios_cents)/(tmp.gross_sales_cents - tmp.refunded_sales_cents * 1.0), 2) AS ios_percent, \
                round((tmp.gross_android_cents - tmp.refunded_android_cents)/(tmp.gross_sales_cents - tmp.refunded_sales_cents * 1.0), 2) AS android_percent, \
                round((tmp.gross_web_cents - tmp.refunded_web_cents)/(tmp.gross_sales_cents - tmp.refunded_sales_cents * 1.0), 2) AS web_percent \
            FROM (SELECT \
                    SUM(p.amount_cents) AS gross_sales_cents, \
                    SUM(p.refunded_amount_cents) AS refunded_sales_cents, \
                    SUM(CASE WHEN o.created_through = 'ios' THEN p.amount_cents ELSE 0 END) AS gross_ios_cents, \
                    SUM(CASE WHEN o.created_through = 'ios' THEN p.refunded_amount_cents ELSE 0 END) AS refunded_ios_cents, \
                    SUM(CASE WHEN o.created_through = 'android' THEN p.amount_cents ELSE 0 END) AS gross_android_cents, \
                    SUM(CASE WHEN o.created_through = 'android' THEN p.refunded_amount_cents ELSE 0 END) AS refunded_android_cents, \
                    SUM(CASE WHEN o.created_through = 'web' THEN p.amount_cents ELSE 0 END) as gross_web_cents, \
                    SUM(CASE WHEN o.created_through = 'web' THEN p.refunded_amount_cents ELSE 0 END) AS refunded_web_cents, \
                    SUM(COALESCE(l.amount_cents,0)) AS gross_labels, \
                    SUM(COALESCE(l.refunded_amount_cents,0)) AS refunded_labels, \
                    SUM(COALESCE(l.refunded_marketplace_fee_cents ,0)) AS refunded_label_fees \
                FROM payments p \
                INNER JOIN orders o ON o.id = p.order_id \
                LEFT OUTER JOIN shipments s ON o.id = s.order_id \
                LEFT OUTER JOIN kid_labels l ON s.id = l.shipment_id \
                WHERE o.aasm_state = 'completed' \
                AND o.created_at >= '" + dateFormat(now, TIMEZONE + ":yyyy-mm-dd'T'HH:MM:ss")  + "') AS tmp";
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

    function getSalesInfo(reply, onSuccess) {
        pool.connect(function(err, client, done) {

            if (err) {
                reply.send('Poop. I fail: ' + err);
                return;
            }

            client.query(getQuery(), function(err, result) {

                done();

                if (err) {
                    reply.send('Poop. I fail: ' + err);
                } else {
                    var row = result.rows[0];
                    onSuccess({
                        total: toMoney(row.total),
                        order: toMoney(row.order),
                        label: toMoney(row.label),
                        ios: toMoney(row.ios),
                        android: toMoney(row.android),
                        web: toMoney(row.web),
                        iosPercent: toPercent(row.ios_percent),
                        androidPercent: toPercent(row.android_percent),
                        webPercent: toPercent(row.web_percent)
                    });
                }
            });
        });
    }

    function timeForWhiskey(reply) {
        getSalesInfo(reply, function(res) {
            var total = parseFloat(res.total.replace( /[^0-9\.]/g, ''));
            if (total >= robot.brain.get('whiskeyBar')) {
                reply.send('YES! (' + res.total + ')');
                reply.send(':whiskey:');
            } else {
                reply.send('Not yet (' + res.total + ')');
            }
            checkForRecord(reply, res);
        });
    }

    function toNum(str) {
        return parseFloat((str || '').trim().replace('$', '').replace(',', '')) || 0;
    }

    function checkForRecord(reply, res) {
        if (toNum(res.total) > toNum(robot.brain.get('totalRecord'))) {
            reply.send(':trophy: New record! ' + res.total);
            robot.brain.set('totalRecord', res.total);
        }
        if (toNum(res.ios) > toNum(robot.brain.get('iosRecord'))) {
            reply.send(':ios: New record! ' + res.ios);
            robot.brain.set('iosRecord', res.ios);
        }
        if (toNum(res.android) > toNum(robot.brain.get('androidRecord'))) {
            reply.send(':android: New record! ' + res.android);
            robot.brain.set('androidRecord', res.android);
        }
        if (toNum(res.web) > toNum(robot.brain.get('webRecord'))) {
            reply.send(':desktop_computer: New record! ' + res.web);
            robot.brain.set('webRecord', res.web);
        }
        if (toNum(res.order) > toNum(robot.brain.get('orderRecord'))) {
            reply.send(':dress: New record! ' + res.order);
            robot.brain.set('orderRecord', res.order);
        }
        if (toNum(res.label) > toNum(robot.brain.get('labelRecord'))) {
            reply.send(':label: New record! ' + res.label);
            robot.brain.set('labelRecord', res.label);
        }
    }

    robot.respond(/.*(total|ios|android|web|order|label) (?:record|milestone).*/i, function(reply) {
        var record = reply.match[1].toLowerCase();
        reply.send(robot.brain.get(record + 'Record'));
    });

    robot.respond(/.*set (total|ios|android|web|order|label) (?:record|milestone) to (.*)/i, function(reply) {
        var record = reply.match[1];
        var value = reply.match[2];
        robot.brain.set(record + 'Record', value);
        reply.send('Set ' + record + ' to ' + value + '!');
    });

    robot.hear(/is it (🥃|whiskey|:whiskey:) time.*/i, function(reply) {
        timeForWhiskey(reply);
    });

    robot.hear(/is it time for (🥃|whiskey|:whiskey:).*/i, function(reply) {
        timeForWhiskey(reply);
    });

    robot.hear(/when is (🥃|whiskey|:whiskey:).*/i, function(reply) {
        var bar = robot.brain.get('whiskeyBar');
        reply.send(reply.match[1] + ' bar set to ' + bar);
    });

    robot.respond(/set (🥃|whiskey|:whiskey:) bar to (.*)/i, function(reply) {
        var whiskey = reply.match[1];
        var bar = reply.match[2];
        bar = parseInt(bar.trim().replace('$', '').replace(',', ''));
        robot.brain.set('whiskeyBar', bar);
        reply.send(whiskey + ' bar set to ' + bar);
    });

    robot.hear(/kidbot (sales|:money_mouth_face:|🤑).*/i, function(reply) {
        reply.send('One sec...');
        getSalesInfo(reply, function(res) {
            reply.send(':moneybag: ' + res.total);
            checkForRecord(reply, res);
        });
    });

    robot.hear(/kidbot (sales|:money_mouth_face:|🤑) detail.*/i, function(reply) {
        reply.send('One sec...');
        getSalesInfo(reply, function(res) {
            reply.send(':moneybag: ' + res.total + '\n:dress: ' + res.order + '\n :label: ' + res.label + '\n :ios: ' + res.iosPercent + ' (' + res.ios + ')' + '\n :android: ' + res.androidPercent + ' ('+ res.android + ')' + '\n :desktop_computer: ' + res.webPercent + ' (' + res.web + ')' );
            checkForRecord(reply, res);
        });
    });

}
