"use strict";

var tcpie, host, port, opts,
    net      = require("net"),
    events   = require("events"),
    defaults = require("defaults"),
    emitter  = new events.EventEmitter(),
    stats = {
        sent   : 0,
        success: 0,
        failed : 0
    },
    def = {
        interval: 1000,
        timeout : 3000,
        count   : Infinity
    };

tcpie = function tcpie (h, p, o) {
    if (typeof h !== "string")
        throw new Error("host is required");

    host = h;
    port = typeof p === "number" ? p : 80;
    opts = defaults(typeof o === "object" ? o : p, def);

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

    stats.sent++;
    socket.connect(port, host, function () {
        socket.end();
        stats.success++;
        emitter.emit("connect", seq, stats, ms(now() - start));
        if ((stats.failed + stats.success) >= opts.count) emitter.emit("end", stats);
    });
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
