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

	let QUERY = 'SELECT COUNT(DISTINCT "collections"."user_id") FROM "collections"';

    function showNumUsersWithCollections(reply) {
 
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
                    let row = result.rows[0];
                    let count = row.count;
                    reply.send('There are ' + count + ' unique users with collections.');
                }
            });
        });
    }

    robot.hear(/.*(how many|number of).*collections.*/i, function(reply) {
        showNumUsersWithCollections(reply);
    });
}
