// Description:
//   Track and report information about Kidizen Android and iOS apps.
//
// Dependencies:
//   None
//
// Configuration:
//   None
//
// Commands:
//   hubot set android version to X - Set the current Kidizen Android app version
//   hubot set ios version to X - Set the current Kidizen iOS app version
//   hubot ios [version|release] - Get the current Kidizen iOS app version
//   hubot android [version|release] - Get the current Kidizen Android app version

let dateFormat = require('dateformat');
let time = require('time-ago')();

module.exports = function(robot) {

    function getTagInstructions(version) {
        return '\n\n_Did you remember to tag the release?_\n```\n$ git checkout main\n$ git pull\n$ git tag v' + version + '\n$ git push origin v' + version + '\n```';
    }

    function androidVersion(reply) {
        let version = robot.brain.get('androidVersion');
        let lastReleaseDate = new Date(robot.brain.get('androidReleaseDate') || Date.now());
        let lastRelease = time.ago(lastReleaseDate) + ' on ' + dateFormat(lastReleaseDate, 'dddd, mmmm dS');
        reply.send(version + ' (released ' + lastRelease + ')');
    }

    function iOSVersion(reply) {
        let version = robot.brain.get('iosVersion');
        let lastReleaseDate = new Date(robot.brain.get('iosReleaseDate') || Date.now());
        let lastRelease = time.ago(lastReleaseDate) + ' on ' + dateFormat(lastReleaseDate, 'dddd, mmmm dS');
        reply.send(version + ' (released ' + lastRelease + ')');
    }

    robot.respond(/set android version to (.*)/i, function(reply) {
        var version = reply.match[1];
        robot.brain.set('androidVersion', version);
        robot.brain.set('androidReleaseDate', Date.now());
        reply.send('Version now set to ' + version + getTagInstructions(version));
    });

    robot.respond(/set ios version to (.*)/i, function(reply) {
        var version = reply.match[1];
        robot.brain.set('iosVersion', version);
        robot.brain.set('iosReleaseDate', Date.now());
        reply.send('Version now set to ' + version + getTagInstructions(version));
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
