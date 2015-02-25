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
    var self = this;

    if (self.stats.sent >= self.opts.count) return;

    self._next = setTimeout(start.bind(self), self.opts.interval);

    var socket    = new net.Socket(),
        startTime = now(),
        done      = false;

    socket.setNoDelay(true);
    socket.setTimeout(self.opts.timeout);
    socket.on("timeout", function () {
        if (!done) {
            done = true;
            self.stats.sent++;
            self.stats.failed++;
            self.emit("timeout", addDetails(self, this));
            socket.destroy();
            checkEnd(self);
        }
    });

    socket.on("error", function (err) {
        if (!done) {
            done = true;
            self.stats.sent++;
            self.stats.failed++;
            self.emit("error", addDetails(self, this), err);
            socket.destroy();
            checkEnd(self);
        }
    });

    socket.connect(self.port, self.host, function () {
        if (!done) {
            done = true;
            self.stats.sent++;
            self.stats.success++;
            self.stats.rtt = (now() - startTime) / 1e6;
            self.emit("connect", addDetails(self, this));
            socket.end();
            checkEnd(self);
        }
    });

    return self;
};

module.exports = function (host, port, opts) {
    return new Tcpie(host, port, opts);
};

// add details to stats object
function addDetails(self, socket) {
    var ret = self.stats;

    ret.target = {
        host: self.host,
        port: self.port
    };

    ret.socket = {
        localAddress  : socket.localAddress,
        localPort     : socket.localPort,
        remoteAddress : socket.remoteAddress,
        remotePort    : socket.remotePort
    };

    return ret;
}

// check end condition
function checkEnd(self) {
    if ((self.stats.failed + self.stats.success) >= self.opts.count) {
        if (self._next)
            clearTimeout(self._next);

        self.emit("end", {
            sent   : self.stats.sent,
            success: self.stats.success,
            failed : self.stats.failed,
            target : {
                host: self.host,
                port: self.port
            }
        });
    }
}

// get current timestamp in nanoseconds
function now() {
    var hrtime = process.hrtime();
    return hrtime[0] * 1e9 + hrtime[1];
}
