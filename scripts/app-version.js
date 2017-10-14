let dateFormat = require('dateformat');
let time = require('time-ago')();

module.exports = function(robot) {

    function androidVersion(reply) {
        let version = robot.brain.get('androidVersion');
        let lastReleaseDate = new Date(robot.brain.get('androidReleaseDate') || Date.now());
        let lastRelease = time.ago(lastReleaseDate) + ' on ' + dateFormat(lastReleaseDate, 'dddd, mmmm dS');
        reply.send(version + ' (released ' + lastRelease + ')');
    }

    function iOSVersion(reply) {
        let version = robot.brain.get('iOSVersion');
        let lastReleaseDate = new Date(robot.brain.get('iOSReleaseDate') || Date.now());
        let lastRelease = time.ago(lastReleaseDate) + ' on ' + dateFormat(lastReleaseDate, 'dddd, mmmm dS');
        reply.send(version + ' (released ' + lastRelease + ')');
    }

    robot.respond(/set android version to (.*)/i, function(reply) {
        var version = reply.match[1];
        robot.brain.set('androidVersion', version);
        robot.brain.set('androidReleaseDate', Date.now());
        reply.send('Version now set to ' + version);
    });

    robot.respond(/set ios version to (.*)/i, function(reply) {
        var version = reply.match[1];
        robot.brain.set('iosVersion', version);
        robot.brain.set('iOSReleaseDate', Date.now());
        reply.send('Version now set to ' + version);
    });

    robot.hear(/.*android (version|release).*/i, function(reply) {
        if (!/set.*version/.test(reply.match[0])) {
            androidVersion(reply);
        }
    });
    robot.hear(/.*ios (version|release).*/i, function(reply) {
        if (!/set.*version/.test(reply.match[0])) {
            iOSVersion(reply);
        }
    });
}
