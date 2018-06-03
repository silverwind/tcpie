#!/usr/bin/env node
"use strict";

const pkg = require("./package.json");

// avoid EPIPE on partially consumed streams
require("epipebomb")();

const chalk = require("chalk");
const net = require("net");
const dns = require("dns");
const stdev = require("compute-stdev");
const tcpie = require(".");

const args = require("minimist")(process.argv.slice(2), {
  boolean: [
    "color", "C",
    "timestamp", "T",
    "flood", "f",
    "version", "v"
  ]
});

const DIGITS_LINE = 1;
const DIGITS_STATS = 3;
const DIGITS_PERC = 0;
const DEFAULT_PORT = 80;

const usage = [
  "",
  "    Usage: tcpie [options] host[:port]|url [port|80]",
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
  process.stdout.write(pkg.version + "\n");
  process.exit(0);
}

if (!args._.length || args._.length > 2 || (args._[1] && isNaN(parseInt(args._[1])))) {
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
  const url = require("url").parse(host);
  const proto = url.protocol.replace(":", "");
  host = url.host;
  port = url.port || require("port-numbers").getPort(proto).port;
  if (!port) {
    writeLine(chalk.red("ERROR:"), "Unknown protocol '" + proto + "'");
    process.exit(1);
  }
  if (!host) {
    writeLine(chalk.red("ERROR:"), "Missing host in '" + host + "'");
  }
}

if (!port) port = DEFAULT_PORT;
if (args.count || args.c) opts.count = parseInt(args.count || args.c);
if (args.interval || args.i) opts.interval = secondsToMs(args.interval || args.i);
if (args.timeout || args.t) opts.timeout = secondsToMs(args.timeout || args.t);
if (args.flood || args.f) opts.interval = 0;
if (args.C) chalk.enabled = false;

// Do a DNS lookup and start the connects
if (!net.isIP(host)) {
  dns.lookup(host, (err, address) => {
    if (!err) {
      printStart(host, address, port);
      run(host, port, opts);
    } else {
      if (err.code === "ENOTFOUND") writeLine(chalk.red("ERROR:"), "Host '" + host + "' not found");
      else writeLine(chalk.red("ERROR:"), err.code, err.syscall || "");
      process.exit(1);
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
      chalk.red("error connecting to", data.target.host + ":" + data.target.port),
      "seq=" + data.sent,
      "error=" + chalk.red(err.code)
    );
  }).on("connect", data => {
    stats = data;
    rtts.push(data.rtt);
    writeLine(
      chalk.green("connected to", data.target.host + ":" + data.target.port),
      "seq=" + data.sent,
      "srcport=" + data.socket.localPort,
      "time=" + colorRTT(data.rtt.toFixed(DIGITS_LINE))
    );
  }).on("timeout", data => {
    stats = data;
    writeLine(
      chalk.red("timeout connecting to", data.target.host + ":" + data.target.port),
      "seq=" + data.sent,
      data.socket.localPort && "srcport=" + data.socket.localPort
    );
  });

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.on("data", bytes => {
      // http://nemesis.lonestar.org/reference/telecom/codes/ascii.html
      const exitCodes = [
        3,  // SIGINT
        4,  // EOF
        26, // SIGTSTP
        28, // SIGQUIT
      ];
      for (let i = 0; i < bytes.length; i++) {
        if (exitCodes.indexOf(bytes[i]) !== -1) printEnd();
      }
    });
  } else {
    process.on("SIGINT", process.exit);
    process.on("SIGQUIT", process.exit);
    process.on("SIGTERM", process.exit);
    process.on("SIGTSTP", process.exit);
  }

  process.on("exit", printEnd);
  pie.on("end", printEnd).start();
}

function printStart(host, address, port) {
  writeLine(pkg.name.toUpperCase(), host, "(" + address + ")", "port", String(port));
}

function printEnd() {
  let sum = 0, min = Infinity, max = 0, avg, dev;

  if (printed) process.exit(stats.success === 0 && 1 || 0);

  if (stats && stats.sent > 0) {
    rtts.forEach(rtt => {
      if (rtt <= min) min = rtt.toFixed(DIGITS_STATS);
      if (rtt >= max) max = rtt.toFixed(DIGITS_STATS);
      sum += rtt;
    });

    avg = (sum / rtts.length).toFixed(DIGITS_STATS);
    dev = stdev(rtts).toFixed(DIGITS_STATS);

    if (min === Infinity) min = "0";
    if (isNaN(avg)) avg = "0";

    printed = true;

    writeLine(
      "\n---", host, pkg.name + " statistics", "---",
      "\n" + stats.sent, "handshakes attempted,", stats.success || "0", "succeeded,",
      ((stats.failed / stats.sent) * 100).toFixed(DIGITS_PERC) + "% failed",
      "\nrtt min/avg/max/stdev =", min + "/" + avg + "/" + max + "/" + dev, "ms"
    );

    process.exit(stats.success === 0 && 1 || 0);
  } else {
    process.exit(1);
  }
}

function colorRTT(rtt) {
  return chalk[rtt >= 150 ? "red" : rtt >= 75 ? "yellow" : "green"](rtt) + " ms";
}

function writeLine(...arg) {
  arg = arg.filter(string => Boolean(string));
  if ((args.timeout || args.T) && arg[0][0] !== "\n") arg.unshift(timestamp());
  arg.push("\n");
  const stream = (process.stdout._type === "pipe" && printed) ? process.stderr : process.stdout;
  stream.write(arg.join(" "));
}

function help() {
  process.stdout.write(usage);
  process.exit(1);
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

  if (month < 10) month = "0" + month;
  if (day < 10) day = "0" + day;
  if (hrs < 10) hrs = "0" + hrs;
  if (mins < 10) mins = "0" + mins;
  if (secs < 10) secs = "0" + secs;
  return year + "-" + month + "-" + day + " " + hrs + ":" + mins + ":" + secs;
}
