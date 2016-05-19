module.exports = function(robot) {

    var IOS_VERSION = '4.3.19';
    var ANDROID_VERSION = '3.21.744';

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
}
