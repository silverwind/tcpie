import {EventEmitter} from "node:events";
import {Socket} from "node:net";

/** Target host and port of a tcpie instance. */
export type Target = {
  host: string,
  port: number,
};

/** Socket address details, present on per-attempt stats. */
export type SocketDetails = {
  localAddress?: string,
  localPort?: number,
  remoteAddress?: string,
  remotePort?: number,
};

/** Statistics emitted on each `connect`, `timeout`, and `error` event. */
export type Stats = {
  /** Number of connection attempts made. */
  sent: number,
  /** Number of successful connections. */
  success: number,
  /** Number of failed connections. */
  failed: number,
  /** Round-trip time in milliseconds of the last successful connection. */
  rtt?: number,
  /** Target host and port. */
  target?: Target,
  /** Socket address details. */
  socket?: SocketDetails,
};

/** Summary emitted on the `end` event. */
export type EndStats = {
  /** Number of connection attempts made. */
  sent: number,
  /** Number of successful connections. */
  success: number,
  /** Number of failed connections. */
  failed: number,
  /** Target host and port. */
  target: Target,
};

/** Options for a tcpie instance. */
export type TcpieOpts = {
  /** Milliseconds to wait between connects. Default: `1000`. */
  interval?: number,
  /** Connection timeout in milliseconds. Default: `3000`. */
  timeout?: number,
  /** Number of connects to perform. Default: `Infinity`. */
  count?: number,
};

type ResolvedOpts = Required<TcpieOpts>;

/** A TCP ping instance. Emits `connect`, `timeout`, `error`, and `end` events. */
export class Tcpie extends EventEmitter { // eslint-disable-line unicorn/prefer-event-target -- public API emits multi-arg events and chains
  host: string;
  port: number;
  opts: ResolvedOpts;
  stats: Stats;
  private next?: ReturnType<typeof setTimeout>;
  private done = false;
  private abort = false;
  private socket?: Socket;
  private startTime = 0;

  constructor(host: string, port?: number, opts?: TcpieOpts) {
    super();
    if (typeof host !== "string") throw new Error("host is required");

    this.host = host;
    this.port = port ?? 80;

    this.opts = {interval: 1000, timeout: 3000, count: Infinity, ...opts};

    this.stats = {
      sent: 0,
      success: 0,
      failed: 0,
    };
  }

  // add details to stats object
  private addDetails(socket: Socket): Stats {
    this.stats.target = {
      host: this.host,
      port: this.port,
    };

    this.stats.socket = {
      localAddress: socket.localAddress,
      localPort: socket.localPort,
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
    };

    return this.stats;
  }

  // check end condition
  private checkEnd(): void {
    if (this.abort || ((this.stats.failed + this.stats.success) >= this.opts.count)) {
      if (this.next) clearTimeout(this.next);

      this.emit("end", {
        sent: this.stats.sent,
        success: this.stats.success,
        failed: this.stats.failed,
        target: {
          host: this.host,
          port: this.port,
        },
      } satisfies EndStats);
    }
  }

  /** Start the connection attempts. */
  start(subsequent?: boolean): this {
    if (!subsequent) {
      this.stats.sent = 0;
      this.stats.success = 0;
      this.stats.failed = 0;
    }

    this.next = setTimeout(this.start.bind(this, true), this.opts.interval);
    this.done = false;
    this.abort = false;
    this.socket = new Socket();
    this.startTime = performance.now();

    this.socket.setTimeout(this.opts.timeout);
    this.socket.on("timeout", () => {
      if (!this.done) {
        this.done = true;
        this.stats.sent++;
        this.stats.failed++;
        this.emit("timeout", this.addDetails(this.socket!));
        this.socket!.destroy();
        this.checkEnd();
      }
    });

    this.socket.on("error", err => {
      if (!this.done) {
        this.done = true;
        this.stats.sent++;
        this.stats.failed++;
        this.emit("error", err, this.addDetails(this.socket!));
        this.socket!.destroy();
        this.checkEnd();
      }
    });

    this.socket.connect(this.port, this.host, () => {
      if (!this.done) {
        this.done = true;
        this.stats.sent++;
        this.stats.success++;
        this.stats.rtt = (performance.now() - this.startTime);
        this.emit("connect", this.addDetails(this.socket!));
        this.socket!.end();
        this.checkEnd();
      }
    });

    return this;
  }

  /** Stop the connection attempts and emit the `end` event. */
  stop(): this {
    this.abort = true;
    this.socket!.end();
    this.checkEnd();
    return this;
  }
}

/** Create a new {@link Tcpie} instance. */
export function tcpie(host: string, port?: number, opts?: TcpieOpts): Tcpie {
  return new Tcpie(host, port, opts);
}
