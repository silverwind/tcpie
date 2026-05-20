#!/usr/bin/env node
import {red, yellow, green, disableColor} from "glowie";
import {isIP} from "node:net";
import {lookup} from "node:dns";
import process, {exit, argv, stdin, stdout, stderr} from "node:process";
import stdev from "compute-stdev";
import {tcpie} from "./index.ts";
import type {EndStats, Stats, TcpieOpts} from "./index.ts";
import minimist from "minimist";
import supportsColor from "supports-color";
import pkg from "./package.json" with {type: "json"};

const args = minimist(argv.slice(2), {
  boolean: [
    "color", "C",
    "timestamp", "T",
    "flood", "f",
    "version", "v",
  ],
});

const packageVersion = pkg.version || "0.0.0";
const DIGITS_LINE = 1;
const DIGITS_STATS = 3;
const DIGITS_PERC = 0;
const DEFAULT_PORT = 22;

const usage = [
  "",
  "    Usage: tcpie [options] host[:port] [port|22]",
  "",
  "    Options:",
  "",
  "      -v, --version       output version",
  "      -c, --count <n>     number of connects (default: infinite)",
  "      -i, --interval <n>  wait n seconds between connects (default: 1)",
  "      -t, --timeout <n>   connection timeout in seconds (default: 3)",
  "      -T, --timestamp     add timestamps to output",
  "      -f, --flood         flood mode, connect as fast as possible",
  "      -C, --no-color      disable color output",
  "",
  "    Examples:",
  "",
  "      $ tcpie google.com",
  "      $ tcpie -i .1 8.8.8.8:53",
  "      $ tcpie -c5 -t.05 aspmx.l.google.com 25",
  "",
  "",
].join("\n");

if (args.v) {
  console.info(packageVersion);
  exit(0);
}

if (!args._.length || args._.length > 2 || (args._[1] && Number.isNaN(Number.parseInt(args._[1])))) {
  help();
}

let host = args._[0];
const opts: TcpieOpts = {};
let port = Number.parseInt(args._[1]);
let printed = false;
const rtts: Array<number> = [];
let stats: Stats | EndStats | undefined;

if (typeof host !== "string") {
  help();
}

// host:port syntax
const matches = /^(.+):(\d+)$/.exec(host);
if (matches?.length === 3 && !port) {
  host = matches[1];
  port = Number.parseInt(matches[2]);
}

if (!port) port = DEFAULT_PORT;
if (args.count || args.c) opts.count = Number.parseInt(args.count || args.c);
if (args.interval || args.i) opts.interval = secondsToMs(args.interval || args.i);
if (args.timeout || args.t) opts.timeout = secondsToMs(args.timeout || args.t);
if (args.flood || args.f) opts.interval = 0;
if (args.C || !supportsColor.stdout) disableColor();

// Do a DNS lookup and start the connects
if (!isIP(host)) {
  lookup(host, (err, address) => {
    if (!err) {
      printStart(host, address, port);
      run(host, port, opts);
    } else {
      if (err.code === "ENOTFOUND") writeLine(red("ERROR:"), `Host '${host}' not found`);
      else writeLine(red("ERROR:"), err.code || "", err.syscall || "");
      exit(1);
    }
  });
} else {
  printStart(host, host, port);
  run(host, port, opts);
}

function run(host: string, port: number, opts: TcpieOpts): void {
  const pie = tcpie(host, port, opts);

  pie.on("error", (err: NodeJS.ErrnoException, data: Stats) => {
    stats = data;
    writeLine(
      red("error connecting to", `${data.target!.host}:${data.target!.port}`),
      `seq=${data.sent}`,
      `error=${red(err.code!)}`,
    );
  }).on("connect", (data: Stats) => {
    stats = data;
    rtts.push(data.rtt!);
    writeLine(
      green("connected to", `${data.target!.host}:${data.target!.port}`),
      `seq=${data.sent}`,
      (data.socket!.localPort !== undefined) ? `srcport=${data.socket!.localPort}` : "",
      `time=${colorRTT(Number(data.rtt!.toFixed(DIGITS_LINE)))}`,
    );
  }).on("timeout", (data: Stats) => {
    stats = data;
    writeLine(
      red("timeout connecting to", `${data.target!.host}:${data.target!.port}`),
      `seq=${data.sent}`,
      data.socket!.localPort ? `srcport=${data.socket!.localPort}` : "",
    );
  });

  if (stdin.isTTY) {
    stdin.setRawMode(true);
    stdin.on("data", (bytes: Buffer) => {
      // http://nemesis.lonestar.org/reference/telecom/codes/ascii.html
      const exitCodes = [
        3,  // SIGINT
        4,  // EOF
        26, // SIGTSTP
        28, // SIGQUIT
      ];
      for (const byte of bytes) {
        if (exitCodes.includes(byte)) printEnd();
      }
    });
  } else {
    process.on("SIGINT", exit);
    process.on("SIGQUIT", exit);
    process.on("SIGTERM", exit);
    process.on("SIGTSTP", exit);
  }

  process.on("exit", printEnd);
  pie.on("end", printEnd).start();
}

function printStart(host: string, address: string, port: number): void {
  writeLine("TCPIE", host, `(${address})`, "port", String(port));
}

function printEnd(): void {
  let sum = 0, min = Infinity, max = 0;
  let avg = "0", dev = "0";

  if (printed) exit(stats!.success === 0 ? 1 : 0);

  if (stats && stats.sent > 0) {
    for (const rtt of rtts) {
      if (rtt <= min) min = Number(rtt.toFixed(DIGITS_STATS));
      if (rtt >= max) max = Number(rtt.toFixed(DIGITS_STATS));
      sum += rtt;
    }

    avg = (sum / rtts.length).toFixed(DIGITS_STATS);
    dev = stdev(rtts).toFixed(DIGITS_STATS);

    if (min === Infinity) min = 0;
    if (Number.isNaN(Number(avg))) avg = "0";

    printed = true;

    writeLine(
      "\n---", host, `tcpie statistics`, "---",
      `\n${stats.sent}`, "handshakes attempted,", String(stats.success || "0"), "succeeded,",
      `${((stats.failed / stats.sent) * 100).toFixed(DIGITS_PERC)}% failed`,
      "\nrtt min/avg/max/stdev =", `${min}/${avg}/${max}/${dev}`, "ms",
    );

    exit(stats.success === 0 ? 1 : 0);
  } else {
    exit(1);
  }
}

function colorRTT(rtt: number): string {
  if (rtt >= 150) {
    return `${red(String(rtt))} ms`;
  } else if (rtt >= 75) {
    return `${yellow(String(rtt))} ms`;
  } else {
    return `${green(String(rtt))} ms`;
  }
}

function writeLine(...arg: Array<string>): void {
  arg = arg.filter(Boolean);
  if ((args.timeout || args.T) && arg[0][0] !== "\n") arg.unshift(timestamp());
  arg.push("\n");
  const stream = ((stdout as unknown as {_type?: string})._type === "pipe" && printed) ? stderr : stdout;
  stream.write(arg.join(" "));
}

function help(): void {
  stdout.write(usage);
  exit(1);
}

function secondsToMs(s: string): number {
  return (Number.parseFloat(s) * 1000);
}

function timestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  let month = String(now.getMonth() + 1);
  let day = String(now.getDate());
  let hrs = String(now.getHours());
  let mins = String(now.getMinutes());
  let secs = String(now.getSeconds());

  if (Number(month) < 10) month = `0${month}`;
  if (Number(day) < 10) day = `0${day}`;
  if (Number(hrs) < 10) hrs = `0${hrs}`;
  if (Number(mins) < 10) mins = `0${mins}`;
  if (Number(secs) < 10) secs = `0${secs}`;
  return `${year}-${month}-${day} ${hrs}:${mins}:${secs}`;
}
