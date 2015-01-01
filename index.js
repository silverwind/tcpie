"use strict";

var tcpie, host, port, opts,
    net      = require("net"),
    events   = require("events"),
    defaults = require("defaults"),
    emitter  = new events.EventEmitter(),
    stats    = {
        sent   : 0,
        success: 0,
        failed : 0
    };

tcpie = function tcpie (h, p, o) {
    if (typeof h !== "string" || typeof p !== "number")
        throw new Error("host and port are required");

    host = h;
    port = p;
    opts = defaults(o, {
        interval: 1000,
        timeout : 3000,
        count   : Infinity
    });

    emitter.start = function start() {
        connect();
    };

    return emitter;
};

module.exports = exports = tcpie;

function connect() {
    if (stats.sent >= opts.count) return;

    setTimeout(connect, opts.interval);

    var socket = new net.Socket(),
        start  = now(),
        seq    = stats.sent + 1;

    socket.setTimeout(opts.timeout);

    socket.on("timeout", function () {
        socket.destroy();
        stats.failed++;
        emitter.emit("timeout", seq, stats);
        if ((stats.failed + stats.success) >= opts.count) emitter.emit("end", stats);
    });

    socket.on("error", function(err) {
        socket.destroy();
        stats.failed++;
        emitter.emit("error", seq, stats, err);
        if ((stats.failed + stats.success) >= opts.count) emitter.emit("end", stats);
    });

    socket.connect(port, host, function () {
        socket.end();
        stats.success++;
        emitter.emit("connect", seq, stats, ms(now() - start));
        if ((stats.failed + stats.success) >= opts.count) emitter.emit("end", stats);
    });

    stats.sent++;
}

// get current timestamp in nanoseconds
function now() {
    var hrtime = process.hrtime();
    return hrtime[0] * 1e9 + hrtime[1];
}

// convert nanoseconds to milliseconds
function ms(ns) {
    return (ns / 1000000);
}
