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
//   hubot [mark|move] KID-[0-9] as X - Change the status of a "KID-" Jira ticket to X
//   hubot create X for [baseservice|ios|android|design] Y - Create a Jira ticket with type X for a platform with Y description
module.exports = function(robot) {

    function getJIRAAuth() {
        var username = process.env['JIRA_USERNAME'];
        var password = process.env['JIRA_PASSWORD'];
        return new Buffer(username + ':' + password).toString('base64');
    }

    function transitionStory(reply) {

        var transition;
        var key = (reply.match[1] || '').toLowerCase().trim();
        var rawTransition = (reply.match[2] || '').toLowerCase().trim();
        var sanitized = rawTransition.split(' ').join('');

        if (sanitized === 'todo') {
            transition = 11;
        } else if (sanitized === 'inprogress') {
            transition = 21;
        } else if (sanitized === 'readyfortest') {
            transition = 41;
        } else if (sanitized === 'done') {
            transition = 31;
        }

        if (!transition) {
            reply.send("Sorry, I don't know about the state '" + rawTransition + "'");
            return;
        }

        reply.send('One sec...');
        robot.http('https://itizen.atlassian.net/rest/api/2/issue/KID-' + key + '/transitions')
            .header('Authorization', 'Basic ' + getJIRAAuth())
            .header('Content-Type', 'application/json')
            .post(JSON.stringify({
                transition: {id: transition}
            }))(function(err, res, body) {
                res = res || {};
                if (!err && res.statusCode === 204) {
                    reply.send('Success! https://itizen.atlassian.net/browse/KID-' + key);
                } else {
                    reply.send("I failed. I couldn't move that issue.");
                }
            });
    }

    robot.respond(/mark (?:KID\-)?([0-9]+) as (.*)/i, function(reply) {
        transitionStory(reply);
    });
    robot.respond(/move (?:KID\-)?([0-9]+) to (.*)/i, function(reply) {
        transitionStory(reply);
    });

    robot.respond(/create ([A-Za-z]+) for ([A-Za-z]+) (.*)/i, function(reply) {

        var type, component;
        var rawType = (reply.match[1] || '').toLowerCase().trim();
        var rawComponent = (reply.match[2] || '').toLowerCase().trim();
        var text = (reply.match[3] || '').toLowerCase().trim();

        var DIRECTIONS = ' Try:\n_kidbot create `bug|story` for `baseservice|ios|android|design` your description goes here_\n\n';

        if (rawType === 'story') {
            type = 'Story';
        } else if (rawType === 'bug') {
            type = 'Bug';
        }

        if (!type) {
            reply.send("Sorry, I don't know how to create a '" + rawType + "'." + DIRECTIONS);
            return;
        }

        if (rawComponent === 'baseservice') {
            component = 'Base Service';
        } else if (rawComponent === 'ios') {
            component = 'iOS';
        } else if (rawComponent === 'android') {
            component = 'Android';
        } else if (rawComponent === 'design') {
            component = 'Design';
        }

        if (!component) {
            reply.send("Sorry, I don't know the component '" + rawComponent + "'." + DIRECTIONS);
            return;
        }

        reply.send('One sec...');
        robot.http('https://itizen.atlassian.net/rest/api/2/issue/')
            .header('Authorization', 'Basic ' + getJIRAAuth())
            .header('Content-Type', 'application/json')
            .post(JSON.stringify({
                fields: {
                    project: {key: 'KID'},
                    summary: text,
                    issuetype: {name: type},
                    components:[{name: component}]
                }
            }))(function(err, res, body) {
                res = res || {};
                if (!err && res.statusCode === 201 && body) {
                    body = JSON.parse(body);
                    reply.send('https://itizen.atlassian.net/browse/' + body.key);
                } else {
                    reply.send("I failed. I couldn't create that story.");
                }
            });
    });
}
