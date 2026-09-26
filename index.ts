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

/** A TCP ping instance. Emits `connect`, `timeout`, `error`, and `end` events. */
export class Tcpie extends EventEmitter { // eslint-disable-line unicorn/prefer-event-target -- public API emits multi-arg events and chains
  host: string;
  port: number;
  opts: Required<TcpieOpts>;
  stats: Stats;
  private next?: ReturnType<typeof setTimeout>;
  private abort = false;
  private ended = false;
  private pending = new Set<Socket>();

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

  private checkEnd(): void {
    if (!this.ended && (this.abort || ((this.stats.failed + this.stats.success) >= this.opts.count))) {
      this.ended = true;
      clearTimeout(this.next);
      for (const socket of this.pending) socket.destroy();
      this.pending.clear();

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
    this.abort = false;
    this.ended = false;
    const socket = new Socket();
    this.pending.add(socket);
    let done = false;
    const fail = (event: "timeout" | "error", ...args: Array<Error>): void => {
      if (done) return;
      done = true;
      this.pending.delete(socket);
      this.stats.sent++;
      this.stats.failed++;
      this.emit(event, ...args, this.addDetails(socket));
      socket.destroy();
      this.checkEnd();
    };
    const startTime = performance.now();

    socket.setTimeout(this.opts.timeout);
    socket.on("timeout", () => fail("timeout"));
    socket.on("error", err => fail("error", err));
    socket.connect(this.port, this.host, () => {
      if (!done) {
        done = true;
        this.stats.sent++;
        this.stats.success++;
        this.stats.rtt = performance.now() - startTime;
        this.pending.delete(socket);
        this.emit("connect", this.addDetails(socket));
        socket.end().resume();
        this.checkEnd();
      }
    });

    return this;
  }

  /** Stop the connection attempts and emit the `end` event. */
  stop(): this {
    this.abort = true;
    this.checkEnd();
    return this;
  }
}

/** Create a new {@link Tcpie} instance. */
export function tcpie(host: string, port?: number, opts?: TcpieOpts): Tcpie {
  return new Tcpie(host, port, opts);
}
