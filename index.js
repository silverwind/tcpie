import {EventEmitter} from "node:events";
import {Socket} from "node:net";
import {inherits} from "node:util";

const Tcpie = function(host, port, opts) {
  if (!(this instanceof Tcpie)) return new Tcpie();
  if (typeof host !== "string") throw new Error("host is required");
  if (port === undefined) port = 80;

  this.host = host;
  this.port = port;

  this.opts = {interval: 1000,
    timeout: 3000,
    count: Infinity, ...opts};

  this.stats = {
    sent: 0,
    success: 0,
    failed: 0
  };
};

inherits(Tcpie, EventEmitter);

Tcpie.prototype.start = function start(subsequent) {
  if (!subsequent) {
    this.stats.sent = 0;
    this.stats.success = 0;
    this.stats.failed = 0;
  }

  this._next = setTimeout(start.bind(this, true), this.opts.interval);
  this._done = false;
  this._abort = false;
  this._socket = new Socket();
  this._startTime = performance.now();

  this._socket.setTimeout(this.opts.timeout);
  this._socket.on("timeout", () => {
    if (!this._done) {
      this._done = true;
      this.stats.sent++;
      this.stats.failed++;
      this.emit("timeout", addDetails(this, this));
      this._socket.destroy();
      checkEnd(this);
    }
  });

  this._socket.on("error", err => {
    if (!this._done) {
      this._done = true;
      this.stats.sent++;
      this.stats.failed++;
      this.emit("error", err, addDetails(this, this));
      this._socket.destroy();
      checkEnd(this);
    }
  });

  this._socket.connect(this.port, this.host, () => {
    if (!this._done) {
      this._done = true;
      this.stats.sent++;
      this.stats.success++;
      this.stats.rtt = (performance.now() - this._startTime);
      this.emit("connect", addDetails(this, this));
      this._socket.end();
      checkEnd(this);
    }
  });

  return this;
};

Tcpie.prototype.stop = function stop() {
  this._abort = true;
  this._socket.end();
  checkEnd(this);
  return this;
};

export function tcpie(...args) {
  return new Tcpie(...args);
}

// add details to stats object
function addDetails(that, socket) {
  const ret = that.stats;

  ret.target = {
    host: that.host,
    port: that.port
  };

  ret.socket = {
    localAddress: socket.localAddress,
    localPort: socket.localPort,
    remoteAddress: socket.remoteAddress,
    remotePort: socket.remotePort
  };

  return ret;
}

// check end condition
function checkEnd(that) {
  if (that._abort || ((that.stats.failed + that.stats.success) >= that.opts.count)) {
    if (that._next) clearTimeout(that._next);

    that.emit("end", {
      sent: that.stats.sent,
      success: that.stats.success,
      failed: that.stats.failed,
      target: {
        host: that.host,
        port: that.port
      }
    });
  }
}
