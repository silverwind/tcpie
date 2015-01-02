"use strict";

var defaults = require("defaults"),
    events   = require("events"),
    net      = require("net"),
    util     = require("util");

var Tcpie = function (host, port, opts) {
    if (typeof host !== "string")
        throw new Error("host is required");

    if (typeof port === "undefined")
        port = 80;

    this.host = host;
    this.port = port;
    this.opts = defaults(opts, {
        interval: 1000,
        timeout : 3000,
        count   : Infinity
    });
    this.stats = {
        sent   : 0,
        success: 0,
        failed : 0
    };
};

util.inherits(Tcpie, events.EventEmitter);

Tcpie.prototype.start = function start() {
    var instance  = this,
        stats     = this.stats,
        opts      = this.opts;

    if (stats.sent >= stats.count) return;

    setTimeout(start.bind(this), opts.interval);

    var socket    = new net.Socket(),
        startTime = now(),
        seq       = stats.sent + 1;

    socket.setTimeout(opts.timeout);

    socket.on("timeout", function () {
        socket.destroy();
        stats.failed++;
        instance.emit("timeout", seq, stats);
        checkEnd(instance);
    });

    socket.on("error", function(err) {
        socket.destroy();
        stats.failed++;
        instance.emit("error", seq, stats, err);
        checkEnd(instance);
    });

    instance.stats.sent++;

    socket.connect(instance.port, instance.host, function () {
        socket.end();
        stats.success++;
        instance.emit("connect", seq, stats, ms(now() - startTime));
        checkEnd(instance);
    });
};

module.exports = function(host, port, opts) {
    return new Tcpie(host, port, opts);
};

// check end condition
function checkEnd(instance) {
    if ((instance.stats.failed + instance.stats.success) >= instance.opts.count)
        instance.emit("end", instance.stats);
}

// get current timestamp in nanoseconds
function now() {
    var hrtime = process.hrtime();
    return hrtime[0] * 1e9 + hrtime[1];
}

// convert nanoseconds to milliseconds
function ms(ns) {
    return (ns / 1e6);
}
