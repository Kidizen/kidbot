module.exports = function(robot) {

    function androidVersion(reply) {
        reply.send(robot.brain.get('androidVersion'));
    }

    function iOSVersion(reply) {
        reply.send(robot.brain.get('iosVersion'));
    }

    robot.respond(/set android version to (.*)/i, function(reply) {
        var version = reply.match[1];
        robot.brain.set('androidVersion', version);
        reply.send('Set Android version to ' + version);
    });

    robot.respond(/set ios version to (.*)/i, function(reply) {
        var version = reply.match[1];
        robot.brain.set('iosVersion', version);
        reply.send('Set iOS version to ' + version);
    });

    robot.hear(/.*android version.*/i, function(reply) {
        androidVersion(reply);
    });
    robot.hear(/.*ios version.*/i, function(reply) {
        iOSVersion(reply);
    });
    robot.hear(/.*android release.*/i, function(reply) {
        androidVersion(reply);
    });
    robot.hear(/.*ios release.*/i, function(reply) {
        iOSVersion(reply);
    });
}
