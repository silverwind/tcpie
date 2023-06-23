#!/usr/bin/env node
import {red, yellow, green, disableColor} from "glowie";
import {isIP} from "node:net";
import {lookup} from "node:dns";
import process, {exit, argv, stdin, stdout, stderr} from "node:process";
import stdev from "compute-stdev";
import {tcpie} from "./index.js";
import minimist from "minimist";
import {getPort} from "port-numbers";
import supportsColor from "supports-color";

const args = minimist(argv.slice(2), {
  boolean: [
    "color", "C",
    "timestamp", "T",
    "flood", "f",
    "version", "v"
  ]
});

const packageVersion = import.meta.VERSION || "0.0.0";
const DIGITS_LINE = 1;
const DIGITS_STATS = 3;
const DIGITS_PERC = 0;
const DEFAULT_PORT = 22;

const usage = [
  "",
  "    Usage: tcpie [options] host[:port]|url [port|22]",
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
  "      $ tcpie -i.2 https://google.com",
  "",
  ""
].join("\n");

if (args.v) {
  console.info(packageVersion);
  exit(0);
}

if (!args._.length || args._.length > 2 || (args._[1] && Number.isNaN(parseInt(args._[1])))) {
  help();
}

let host = args._[0];
const opts = {};
let port = parseInt(args._[1]);
let printed = false;
const rtts = [];
let stats;

if (typeof host !== "string") {
  help();
}

// host:port syntax
const matches = /^(.+):(\d+)$/.exec(host);
if (matches && matches.length === 3 && !port) {
  host = matches[1];
  port = matches[2];
}

// url syntax
if (/.+:\/\/.+/.test(host)) {
  const {protocol, hostname, port: p} = new URL(host);
  const proto = protocol.replace(":", "");
  host = hostname;
  port = p ?? getPort(proto).port;

  if (!port) {
    writeLine(red("ERROR:"), `Unknown protocol '${proto}'`);
    exit(1);
  }
  if (!host) {
    writeLine(red("ERROR:"), `Missing host in '${host}'`);
    exit(1);
  }
}

if (!port) port = DEFAULT_PORT;
if (args.count || args.c) opts.count = parseInt(args.count || args.c);
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
      else writeLine(red("ERROR:"), err.code, err.syscall || "");
      exit(1);
    }
  });
} else {
  printStart(host, host, port);
  run(host, port, opts);
}

function run(host, port, opts) {
  const pie = tcpie(host, port, opts);

  pie.on("error", (err, data) => {
    stats = data;
    writeLine(
      red("error connecting to", `${data.target.host}:${data.target.port}`),
      `seq=${data.sent}`,
      `error=${red(err.code)}`
    );
  }).on("connect", data => {
    stats = data;
    rtts.push(data.rtt);
    writeLine(
      green("connected to", `${data.target.host}:${data.target.port}`),
      `seq=${data.sent}`,
      (data.socket.localPort !== undefined) ? `srcport=${data.socket.localPort}` : "",
      `time=${colorRTT(data.rtt.toFixed(DIGITS_LINE))}`,
    );
  }).on("timeout", data => {
    stats = data;
    writeLine(
      red("timeout connecting to", `${data.target.host}:${data.target.port}`),
      `seq=${data.sent}`,
      data.socket.localPort && `srcport=${data.socket.localPort}`
    );
  });

  if (stdin.isTTY) {
    stdin.setRawMode(true);
    stdin.on("data", bytes => {
      // http://nemesis.lonestar.org/reference/telecom/codes/ascii.html
      const exitCodes = [
        3,  // SIGINT
        4,  // EOF
        26, // SIGTSTP
        28, // SIGQUIT
      ];
      for (let i = 0; i < bytes.length; i++) {
        if (exitCodes.includes(bytes[i])) printEnd();
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

function printStart(host, address, port) {
  writeLine("TCPIE", host, `(${address})`, "port", String(port));
}

function printEnd() {
  let sum = 0, min = Infinity, max = 0, avg, dev;

  if (printed) exit(stats.success === 0 && 1 || 0);

  if (stats && stats.sent > 0) {
    for (const rtt of rtts) {
      if (rtt <= min) min = rtt.toFixed(DIGITS_STATS);
      if (rtt >= max) max = rtt.toFixed(DIGITS_STATS);
      sum += rtt;
    }

    avg = (sum / rtts.length).toFixed(DIGITS_STATS);
    dev = stdev(rtts).toFixed(DIGITS_STATS);

    if (min === Infinity) min = "0";
    if (Number.isNaN(avg)) avg = "0";

    printed = true;

    writeLine(
      "\n---", host, `tcpie statistics`, "---",
      `\n${stats.sent}`, "handshakes attempted,", stats.success || "0", "succeeded,",
      `${((stats.failed / stats.sent) * 100).toFixed(DIGITS_PERC)}% failed`,
      "\nrtt min/avg/max/stdev =", `${min}/${avg}/${max}/${dev}`, "ms"
    );

    exit(stats.success === 0 && 1 || 0);
  } else {
    exit(1);
  }
}

function colorRTT(rtt) {
  if (rtt >= 150) {
    return `${red(rtt)} ms`;
  } else if (rtt >= 75) {
    return `${yellow(rtt)} ms`;
  } else {
    return `${green(rtt)} ms`;
  }
}

function writeLine(...arg) {
  arg = arg.filter(Boolean);
  if ((args.timeout || args.T) && arg[0][0] !== "\n") arg.unshift(timestamp());
  arg.push("\n");
  const stream = (stdout._type === "pipe" && printed) ? stderr : stdout;
  stream.write(arg.join(" "));
}

function help() {
  stdout.write(usage);
  exit(1);
}

function secondsToMs(s) {
  return (parseFloat(s) * 1000);
}

function timestamp() {
  const now = new Date();
  const year = now.getFullYear();
  let month = now.getMonth() + 1;
  let day = now.getDate();
  let hrs = now.getHours();
  let mins = now.getMinutes();
  let secs = now.getSeconds();

  if (month < 10) month = `0${month}`;
  if (day < 10) day = `0${day}`;
  if (hrs < 10) hrs = `0${hrs}`;
  if (mins < 10) mins = `0${mins}`;
  if (secs < 10) secs = `0${secs}`;
  return `${year}-${month}-${day} ${hrs}:${mins}:${secs}`;
}
