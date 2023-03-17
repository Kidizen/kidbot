// Description:
//   Get a Kidbucks report
//
// Dependencies:
//   None
//
// Configuration:
//   None
//
// Commands:
//   hubot get kidbucks export
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

    var QUERY = "select je.user_id as \"User ID\", date_trunc('day',je.date) as \"Date\", je.recipe_name as \"Description\", (select rtrim(replace(description,'        ',''),chr(10)) from payments where aasm_state in ('successful', 'refunded') and order_id = je.order_id limit 1) as \"Detail\", sum(case when je.transaction_type = 'Debit' then je.amount else NULL end) as \"Money In\", sum(case when je.transaction_type = 'Credit' then je.amount else NULL end) as \"Money Out\", sum(je.amount) as \"Net Amount\", sum(je.amount) OVER (ORDER BY je.date asc) as \"Balance\" from ((select (je.created_at::TIMESTAMP WITH TIME ZONE) AT TIME ZONE 'CST' as date, je.order_id, je.user_id, a.account_type, je.recipe_name, je.description, 'Debit' as transaction_type, round(je.amount_cents/100.0,2) as amount from journal_entries je left join accounts a on a.id = je.debit_account_id order by je.created_at desc, je.order_id desc, a.account_type asc) UNION ALL (select (je.created_at::TIMESTAMP WITH TIME ZONE) AT TIME ZONE 'CST' as date, je.order_id, je.user_id,  a.account_type, je.recipe_name, je.description, 'Credit' as transaction_type, -round(je.amount_cents/100.0,2) as amount from journal_entries je left join accounts a on a.id = je.credit_account_id order by je.created_at desc, je.order_id desc, a.account_type asc)) je left join orders o on je.order_id = o.id left join users b on o.user_id = b.id left join users s on o.seller_id = s.id left join (select owner_id as order_id, full_name || chr(10) || address || chr(10) || city || ', ' || state || ' '  || zipcode as full_address from addresses where owner_type = 'Order' and type = 'ShippingAddress') sa on sa.order_id = je.order_id where je.user_id = 32436 and je.account_type in ('cash') group by je.user_id, date_trunc('day',je.date), je.date, je.recipe_name, (select rtrim(replace(description,'        ',''),chr(10)) from payments where aasm_state in ('successful', 'refunded') and order_id = je.order_id limit 1), je.amount order by je.date desc, je.recipe_name asc";

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
                    var row, entry, report = ['```'];
                    for (var i = 0; i < Math.min(result.rows.length, 5); i++) {
                        entry = [];
                        row = result.rows[i];
                        entry.push(row['Date']);
                        entry.push(row['Description']);
                        entry.push(row['Detail']);
                        entry.push(row['Money In']);
                        entry.push(row['Money Out']);
                        entry.push(row['Net Amount']);
                        entry.push(row['Balance']);
                        report.push(entry.join(','));
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
