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

    function getTransactionHistoryFor(userId, reply) {
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
                    var row, report = ['```'];
                    for (row in result.rows) {
                        report.push(row['total']);
                        report.push(row.total);
                        report.push(row['order']);
                        report.push(row.order);
                    }
                    report.push('```');
                    reply.send(report.join('\n'));
                }
            });
        });
    }

    robot.respond(/get kidbucks export/i, function(reply) {
        getTransactionHistoryFor(1, reply);
    });
}
