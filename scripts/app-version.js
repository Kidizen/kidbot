module.exports = function(robot) {

    var IOS_VERSION = '4.4.9';
    var ANDROID_VERSION = '4.5.783';

    function androidVersion(reply) {
        reply.send(ANDROID_VERSION);
    }

    function iOSVersion(reply) {
        reply.send(IOS_VERSION);
    }

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
