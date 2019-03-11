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

    const TIMEZONE = 'CDT';
    const HOUR_OFFSET = TIMEZONE == 'CDT' ? 5 : 6;
    const MILLESECOND_OFFSET = (HOUR_OFFSET*60*60*1000);
    const QUERY = "select distinct d.date as date, coalesce(pbs.order_amount, 0) + coalesce(kl.label_amount, 0) as total, pbs.order_amount as order, coalesce(kl.label_amount, 0) as label, coalesce(cashouts.cashout_fee_amount, 0) as cashout_fees_collected, pbs.ios_amount as ios, pbs.android_amount as android, pbs.web_amount as web, round(pbs.ios_amount :: decimal / pbs.order_amount, 4) as ios_percent, round(pbs.android_amount :: decimal / pbs.order_amount, 4) as android_percent, round(pbs.web_amount :: decimal / pbs.order_amount, 4) as web_percent from (select date_trunc('day', dd) :: timestamp as date from generate_series(now() AT TIME ZONE '" + TIMEZONE + "' - interval '7 days', CURRENT_TIMESTAMP AT TIME ZONE '" + TIMEZONE + "', '1 day' :: interval) dd) as d left join (select tmp.order_date, sum(tmp.amount) as order_amount, sum(case when tmp.created_through = 'ios' then tmp.amount else 0 end) as ios_amount, sum(case when tmp.created_through = 'android' then tmp.amount else 0 end) as android_amount, sum(case when tmp.created_through = 'web' then tmp.amount else 0 end) as web_amount from (select date_trunc('day', (o.purchase_date :: TIMESTAMP WITH TIME ZONE) AT TIME ZONE '" + TIMEZONE + "') as order_date, o.id, o.user_id, o.seller_id, case when o.created_through is null then case when u.created_through = 'android' then u.created_through else 'ios' end else o.created_through end as created_through, o.fee_strategy_info->>'strategy_name' as seller_fee_strategy, round(pay.amount_cents / 100.0, 2) as amount from orders o inner join (select p.order_id, sum(p.amount_cents) as amount_cents from payments as p where p.aasm_state = 'successful' group by p.order_id) pay on pay.order_id = o.id left join users u on o.user_id = u.id where (o.purchase_date :: TIMESTAMP WITH TIME ZONE) AT TIME ZONE '" + TIMEZONE + "' >= NOW() - interval '14 days' and o.aasm_state = 'completed' and o.user_id <> 0 order by (o.purchase_date :: TIMESTAMP WITH TIME ZONE) AT TIME ZONE '" + TIMEZONE + "') tmp group by tmp.order_date) pbs on pbs.order_date = d.date left join (select date_trunc('day', (kl.created_at :: TIMESTAMP WITH TIME ZONE) AT TIME ZONE '" + TIMEZONE + "') as date, round(sum(kl.amount_cents) / 100.0, 2) as label_amount from kid_labels kl left join shipments sh on sh.id = kl.shipment_id where sh.aasm_state not in ('canceled', 'failed') and kl.payment_method_type is NOT NULL group by date_trunc('day', (kl.created_at :: TIMESTAMP WITH TIME ZONE) AT TIME ZONE '" + TIMEZONE + "')) kl on kl.date = d.date left join (select date_trunc('day', (cashouts.completed_at :: TIMESTAMP WITH TIME ZONE) AT TIME ZONE '" + TIMEZONE + "') as date, round(sum(cashouts.fee_amount_cents) / 100.0, 2) as cashout_fee_amount from cashouts where cashouts.kidbucks_moved = TRUE group by date_trunc('day', (cashouts.completed_at :: TIMESTAMP WITH TIME ZONE) AT TIME ZONE '" + TIMEZONE + "')) cashouts on cashouts.date = d.date order by 1 desc"

    Number.prototype.format = function(n, x) {
        var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\.' : '$') + ')';
        return this.toFixed(Math.max(0, ~~n)).replace(new RegExp(re, 'g'), '$&,');
    };

    function getLocalTime() {
        var now = new Date();
        now.setHours(0,0,0,0); // beginning of the day, UTC
        return new Date(now.getTime() + MILLESECOND_OFFSET);
    }

    function getLabelsQuery() {
        return "SELECT \
                    round((tmp.gross_labels - tmp.refunded_labels - tmp.refunded_label_fees) / 100.0, 2) AS label \
                FROM (SELECT  \
                        SUM(COALESCE(l.amount_cents,0)) AS gross_labels, \
                        SUM(COALESCE(l.refunded_amount_cents,0)) AS refunded_labels, \
                        SUM(COALESCE(l.refunded_marketplace_fee_cents ,0)) AS refunded_label_fees \
                    FROM kid_labels l \
                    WHERE l.created_at >= '" + getLocalTime() + "') AS tmp";
    }

    function getOrdersQuery() {
        return "SELECT \
                    round((tmp.gross_sales_cents - tmp.refunded_sales_cents) / 100.0, 2) AS order, \
                    round((tmp.gross_ios_cents - tmp.refunded_ios_cents) / 100.0, 2) AS ios, \
                    round((tmp.gross_android_cents - tmp.refunded_android_cents) / 100.0, 2) AS android, \
                    round((tmp.gross_web_cents - tmp.refunded_web_cents) / 100.0, 2) AS web, \
                    round((tmp.gross_ios_cents - tmp.refunded_ios_cents)/(tmp.gross_sales_cents - tmp.refunded_sales_cents * 1.0), 2) AS ios_percent, \
                    round((tmp.gross_android_cents - tmp.refunded_android_cents)/(tmp.gross_sales_cents - tmp.refunded_sales_cents * 1.0), 2) AS android_percent, \
                    round((tmp.gross_web_cents - tmp.refunded_web_cents)/(tmp.gross_sales_cents - tmp.refunded_sales_cents * 1.0), 2) AS web_percent \
                FROM (SELECT  \
                        SUM(p.amount_cents) AS gross_sales_cents, \
                        SUM(p.refunded_amount_cents) AS refunded_sales_cents, \
                        SUM(CASE WHEN o.created_through = 'ios' THEN p.amount_cents ELSE 0 END) AS gross_ios_cents, \
                        SUM(CASE WHEN o.created_through = 'ios' THEN p.refunded_amount_cents ELSE 0 END) AS refunded_ios_cents, \
                        SUM(CASE WHEN o.created_through = 'android' THEN p.amount_cents ELSE 0 END) AS gross_android_cents, \
                        SUM(CASE WHEN o.created_through = 'android' THEN p.refunded_amount_cents ELSE 0 END) AS refunded_android_cents, \
                        SUM(CASE WHEN o.created_through = 'web' THEN p.amount_cents ELSE 0 END) as gross_web_cents, \
                        SUM(CASE WHEN o.created_through = 'web' THEN p.refunded_amount_cents ELSE 0 END) AS refunded_web_cents \
                    FROM payments p \
                    INNER JOIN orders o ON o.id = p.order_id \
                    WHERE o.aasm_state = 'completed' \
                    AND o.created_at >= '" + getLocalTime() + "') AS tmp";
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

    function getSalesInfo2(reply, onSuccess) {
        pool.connect(function(err, client, done) {

            if (err) {
                reply.send('Poop. I fail: ' + err);
                return;
            }

            // get orders data first
            client.query(getOrdersQuery(), function(err, result) {

                if (err) {
                    done();
                    reply.send('Poop. I fail: ' + err);
                } else {

                    // success! now get labels data
                    var ordersRow = result.rows[0];
                    client.query(getLabelsQuery(), function(err, result) {

                        done();

                        if (err) {
                            reply.send('Poop. I fail: ' + err);
                        } else {
                            var labelsRow = result.rows[0];
                            var total = parseFloat(ordersRow.order).format(2) + parseFloat(labelsRow.label).format(2);

                            onSuccess({
                                total: toMoney(total),
                                order: toMoney(ordersRow.order),
                                label: toMoney(labelsRow.label),
                                ios: toMoney(ordersRow.ios),
                                android: toMoney(ordersRow.android),
                                web: toMoney(ordersRow.web),
                                iosPercent: toPercent(ordersRow.ios_percent),
                                androidPercent: toPercent(ordersRow.android_percent),
                                webPercent: toPercent(ordersRow.web_percent)
                            });
                        }
                    });
                }
            });
        });
    }

    function getSalesInfo(reply, onSuccess) {
        pool.connect(function(err, client, done) {

            if (err) {
                reply.send('Poop. I fail: ' + err);
                return;
            }

            client.query(QUERY, function(err, result) {

                done();

                if (err) {
                    reply.send('Poop. I fail: ' + err);
                } else {
                    var row = result.rows[0];
                    onSuccess({
                        total:                  toMoney(row.total),
                        order:                  toMoney(row.order),
                        label:                  toMoney(row.label),
                        cashout_fees_collected: toMoney(row.cashout_fees_collected),
                        ios:                    toMoney(row.ios),
                        android:                toMoney(row.android),
                        web:                    toMoney(row.web),
                        iosPercent:             toPercent(row.ios_percent),
                        androidPercent:         toPercent(row.android_percent),
                        webPercent:             toPercent(row.web_percent)
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

    robot.respond(/timezone time/, function(reply) {
        reply.send(dateFormat(getLocalTime(), "yyyy-mm-dd'T'HH:MM:ss"));
    });

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
            reply.send(
              ':moneybag: ' + res.total +
              '\n:dress: ' + res.order +
              '\n:label: ' + res.label +
              '\n:bank: ' + res.cashout_fees_collected +
              '\n:ios: ' + res.iosPercent + ' (' + res.ios + ')' +
              '\n:android: ' + res.androidPercent + ' ('+ res.android + ')' +
              '\n:desktop_computer: ' + res.webPercent + ' (' + res.web + ')' );
            checkForRecord(reply, res);
        });
    });

}
