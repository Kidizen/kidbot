module.exports = function(robot) {

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

    var QUERY = "select distinct d.date as date, coalesce(pbs.order_amount,0) + coalesce(kl.label_amount,0) as total, pbs.order_amount as order, coalesce(kl.label_amount,0) as label, pbs.ios_amount as ios, pbs.android_amount as android, pbs.kb_amount as kidbucks, pbs.ss_amount as selfship, pbs.ppl_amount as ppl, round(pbs.ios_amount::decimal/pbs.order_amount, 4) as ios_percent, round(pbs.android_amount::decimal/pbs.order_amount, 4) as android_percent, round(pbs.kb_amount::decimal/pbs.order_amount, 4) as kidbucks_percent from(select date_trunc('day', dd)::timestamp as date from generate_series(now() AT TIME ZONE 'CDT' - interval '7 days', CURRENT_TIMESTAMP AT TIME ZONE 'CDT', '1 day'::interval) dd) as d left join (select tmp.order_date, sum(tmp.amount) as order_amount, sum(case when tmp.created_through = 'ios' then tmp.amount else 0 end) as ios_amount, sum(case when tmp.created_through = 'android' then tmp.amount else 0 end) as android_amount, sum(case when tmp.seller_fee_strategy = 'Percentage' then tmp.amount else 0 end) as kb_amount, sum(case when tmp.seller_fee_strategy = 'PaypalSelfship' then tmp.amount else 0 end) as ss_amount, sum(case when tmp.seller_fee_strategy = 'PaypalPpl' then tmp.amount else 0 end) as ppl_amount from (select date_trunc('day',(o.purchase_date::TIMESTAMP WITH TIME ZONE) AT TIME ZONE 'CDT') as order_date, o.id, o.user_id, o.seller_id, case when o.created_through is null then case when u.created_through = 'android' then u.created_through else 'ios' end else o.created_through end as created_through, o.fee_strategy_info->>'strategy_name' as seller_fee_strategy, round(pay.amount_cents/100.0,2) as amount from orders o inner join (select p.order_id, sum(p.amount_cents) as amount_cents from payments as p where p.aasm_state = 'successful' group by p.order_id) pay on pay.order_id = o.id left join users u on o.user_id = u.id where (o.purchase_date::TIMESTAMP WITH TIME ZONE) AT TIME ZONE 'CDT' >= NOW() - interval '14 days' and o.aasm_state = 'completed' and o.user_id <> 0 order by (o.purchase_date::TIMESTAMP WITH TIME ZONE) AT TIME ZONE 'CDT') tmp group by tmp.order_date) pbs on pbs.order_date = d.date left join (select date_trunc('day',(kl.created_at::TIMESTAMP WITH TIME ZONE) AT TIME ZONE 'CDT') as date, round(sum(kl.amount_cents)/100.0,2) as label_amount from kid_labels kl left join shipments sh on sh.id = kl.shipment_id where sh.aasm_state not in ('canceled','failed') and kl.payment_method_type is NOT NULL group by date_trunc('day',(kl.created_at::TIMESTAMP WITH TIME ZONE) AT TIME ZONE 'CDT')) kl on kl.date = d.date order by 1 desc";

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
        reply('One sec...');
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
                    var total = '$' + row.total.toFixed(2);
                    var order = '$' + row.order.toFixed(2);
                    var label = '$' + row.label.toFixed(2);
                    var ios = '$' + row.ios.toFixed(2);
                    var android = '$' + row.android.toFixed(2);
                    var iosPercent = (Math.round(row.ios_percent * 100) % 100) + '%';
                    var androidPercent = (Math.round(row.android_percent * 100) % 100) + '%';
                    reply.send(':moneybag: ' + total + '\n:dress: ' + order + '\n :label: ' + label + '\n :ios: ' + iosPercent + '\n :android: ' + androidPercent);
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