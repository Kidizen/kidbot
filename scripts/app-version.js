module.exports = function(robot) {

    var IOS_VERSION = '4.3.16';
    var ANDROID_VERSION = '3.20.736';

    function androidVersion(reply) {
        reply.send(ANDROID_VERSION);
    }

    function iOSVersion(reply) {
        reply.send(IOS_VERSION);
    }

    robot.hear(/what is the.*android version.*/i, function(reply) {
        androidVersion(reply);
    });
    robot.hear(/what's the.*android version.*/i, function(reply) {
        androidVersion(reply);
    });
    robot.hear(/what is the.*ios version.*/i, function(reply) {
        iOSVersion(reply);
    });
    robot.hear(/what's the.*ios version.*/i, function(reply) {
        iOSVersion(reply);
    });
}
