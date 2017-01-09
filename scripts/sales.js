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

    var QUERY = "select distinct d.date as date, coalesce(pbs.order_amount,0) + coalesce(kl.label_amount,0) as total, pbs.order_amount as order, coalesce(kl.label_amount,0) as label, pbs.ios_amount as ios, pbs.android_amount as android, pbs.kb_amount as kidbucks, pbs.ss_amount as selfship, pbs.ppl_amount as ppl, round(pbs.ios_amount::decimal/pbs.order_amount, 4) as ios_percent, round(pbs.android_amount::decimal/pbs.order_amount, 4) as android_percent, round(pbs.kb_amount::decimal/pbs.order_amount, 4) as kidbucks_percent from(select date_trunc('day', dd)::timestamp as date from generate_series(now() AT TIME ZONE 'CST' - interval '7 days', CURRENT_TIMESTAMP AT TIME ZONE 'CST', '1 day'::interval) dd) as d left join (select tmp.order_date, sum(tmp.amount) as order_amount, sum(case when tmp.created_through = 'ios' then tmp.amount else 0 end) as ios_amount, sum(case when tmp.created_through = 'android' then tmp.amount else 0 end) as android_amount, sum(case when tmp.seller_fee_strategy = 'Percentage' then tmp.amount else 0 end) as kb_amount, sum(case when tmp.seller_fee_strategy = 'PaypalSelfship' then tmp.amount else 0 end) as ss_amount, sum(case when tmp.seller_fee_strategy = 'PaypalPpl' then tmp.amount else 0 end) as ppl_amount from (select date_trunc('day',(o.purchase_date::TIMESTAMP WITH TIME ZONE) AT TIME ZONE 'CST') as order_date, o.id, o.user_id, o.seller_id, case when o.created_through is null then case when u.created_through = 'android' then u.created_through else 'ios' end else o.created_through end as created_through, o.fee_strategy_info->>'strategy_name' as seller_fee_strategy, round(pay.amount_cents/100.0,2) as amount from orders o inner join (select p.order_id, sum(p.amount_cents) as amount_cents from payments as p where p.aasm_state = 'successful' group by p.order_id) pay on pay.order_id = o.id left join users u on o.user_id = u.id where (o.purchase_date::TIMESTAMP WITH TIME ZONE) AT TIME ZONE 'CST' >= NOW() - interval '14 days' and o.aasm_state = 'completed' and o.user_id <> 0 order by (o.purchase_date::TIMESTAMP WITH TIME ZONE) AT TIME ZONE 'CST') tmp group by tmp.order_date) pbs on pbs.order_date = d.date left join (select date_trunc('day',(kl.created_at::TIMESTAMP WITH TIME ZONE) AT TIME ZONE 'CST') as date, round(sum(kl.amount_cents)/100.0,2) as label_amount from kid_labels kl left join shipments sh on sh.id = kl.shipment_id where sh.aasm_state not in ('canceled','failed') and kl.payment_method_type is NOT NULL group by date_trunc('day',(kl.created_at::TIMESTAMP WITH TIME ZONE) AT TIME ZONE 'CST')) kl on kl.date = d.date order by 1 desc";

    Number.prototype.format = function(n, x) {
        var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\.' : '$') + ')';
        return this.toFixed(Math.max(0, ~~n)).replace(new RegExp(re, 'g'), '$&,');
    };

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

            client.query(QUERY, function(err, result) {

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
                        iosPercent: toPercent(row.ios_percent),
                        androidPercent: toPercent(row.android_percent)
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
        if (toNum(res.order) > toNum(robot.brain.get('orderRecord'))) {
            reply.send(':dress: New record! ' + res.order);
            robot.brain.set('orderRecord', res.order);
        }
        if (toNum(res.label) > toNum(robot.brain.get('labelRecord'))) {
            reply.send(':label: New record! ' + res.label);
            robot.brain.set('labelRecord', res.label);
        }
    }

    robot.respond(/.*(total|ios|android|order|label) (?:record|milestone).*/i, function(reply) {
        var record = reply.match[1].toLowerCase();
        reply.send(robot.brain.get(record + 'Record'));
    });

    robot.respond(/.*set (total|ios|android|order|label) (?:record|milestone) to (.*)/i, function(reply) {
        var record = reply.match[1];
        var value = reply.match[2];
        robot.brain.set(record + 'Record', value);
        reply.send('Set ' + record + ' to ' + value + '!');
    });

    robot.hear(/is it whiskey time.*/i, function(reply) {
        timeForWhiskey(reply);
    });

    robot.hear(/is it time for whiskey.*/i, function(reply) {
        timeForWhiskey(reply);
    });

    robot.hear(/kidbot sales$/i, function(reply) {
        reply.send('One sec...');
        getSalesInfo(reply, function(res) {
            reply.send(':moneybag: ' + res.total);
            checkForRecord(reply, res);
        });
    });

    robot.hear(/kidbot sales detail.*/i, function(reply) {
        reply.send('One sec...');
        getSalesInfo(reply, function(res) {
            reply.send(':moneybag: ' + res.total + '\n:dress: ' + res.order + '\n :label: ' + res.label + '\n :ios: ' + res.iosPercent + '\n :android: ' + res.androidPercent);
            checkForRecord(reply, res);
        });
    });

    robot.hear(/when is whiskey.*/, function(reply) {
        var bar = robot.brain.get('whiskeyBar');
        reply.send('Whiskey bar set to ' + bar);
    });

    robot.respond(/set whiskey bar to (.*)/i, function(reply) {
        var bar = reply.match[1];
        bar = parseInt(bar.trim().replace('$', '').replace(',', ''));
        robot.brain.set('whiskeyBar', bar);
        reply.send('Whiskey bar set to ' + bar); 
    });
}
