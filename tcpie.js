#!/usr/bin/env node
"use strict";

var pkg = require("./package.json");

// set process title
process.title = pkg.name;

// avoid EPIPE on partially consumed streams
require("epipebomb")();

var args   = require("minimist")(process.argv.slice(2)),
    chalk  = require("chalk"),
    net    = require("net"),
    dns    = require("dns"),
    stdev  = require("compute-stdev"),
    tcpie  = require("./");


var DIGITS_LINE  = 1,
    DIGITS_STATS = 3,
    DIGITS_PERC  = 0,
    DEFAULT_PORT = 80;

var usage = [
    "",
    "    Usage: tcpie [options] host[:port] [port|80]",
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
    "      $ tcpie www.google.com",
    "      $ tcpie -i .1 8.8.8.8:53",
    "      $ tcpie -c 10 -t .05 aspmx.l.google.com 25",
    "",
    ""].join("\n");

if (args.v) {
    return process.stdout.write(pkg.version + "\n");
}

if (!args._.length || args._.length > 2 || (args._[1] && isNaN(parseInt(args._[1], 10)))) {
    help();
}

var host    = args._[0],
    opts    = {},
    port    = parseInt(args._[1], 10),
    printed = false,
    rtts    = [],
    stats;

if (typeof host !== "string") {
    help();
}

// host:port syntax
var matches = /^(.+):(\d+)$/.exec(host);
if (matches && matches.length === 3 && !port) {
    host = matches[1];
    port = matches[2];
}

if (!port) port = DEFAULT_PORT;
if (args.count || args.c) opts.count = parseInt(args.count || args.c, 10);
if (args.interval || args.i) opts.interval = secondsToMs(args.interval || args.i);
if (args.timeout || args.t) opts.timeout = secondsToMs(args.timeout || args.t);
if (args.flood || args.f) opts.interval = 0;
if (args.C || args.color === false) chalk.enabled = false;

// Do a DNS lookup and start the connects
if (!net.isIP(host)) {
    dns.lookup(host, function (err, address) {
        if (!err) {
            printStart(host, address, port);
            run(host, port, opts);
        } else {
            if (err.code === "ENOTFOUND")
                writeLine(chalk.red("ERROR:"), "Host '" + host + "' not found");
            else
                writeLine(chalk.red("ERROR:"), err.code, err.syscall || "");
            process.exit(1);
        }
    });
} else {
    printStart(host, host, port);
    run(host, port, opts);
}

function run(host, port, opts) {
    var pie = tcpie(host, port, opts);

    pie.on("error", function (data, err) {
        stats = data;
        writeLine(
            chalk.red("error connecting to", data.target.host + ":" + data.target.port),
            "seq=" + data.sent,
            "error=" + chalk.red(err.code)
        );
    });

    pie.on("connect", function (data) {
        stats = data;
        rtts.push(data.rtt);
        writeLine(
            chalk.green("connected to", data.target.host + ":" + data.target.port),
            "seq=" + data.sent,
            "srcport=" + data.socket.localPort,
            "time=" + colorRTT(data.rtt.toFixed(DIGITS_LINE))
        );
    });

    pie.on("timeout", function (data) {
        stats = data;
        writeLine(
            chalk.red("timeout connecting to", data.target.host + ":" + data.target.port),
            "seq=" + data.sent,
            data.socket.localPort && "srcport=" + data.socket.localPort
        );
    });

    process.on("exit", printEnd);
    process.stdin.setRawMode(true);
    process.stdin.on("data", function (bytes) {
        if (bytes[0] === 3 || bytes[0] === 4) process.exit();
    });
    pie.on("end", printEnd).start();
}

function printStart(host, address, port) {
    writeLine(pkg.name.toUpperCase(), host, "(" + address + ")", "port", String(port));
}

function printEnd() {
    var sum = 0, min = Infinity, max = 0, avg, dev;

    if (printed)
        process.exit(0);

    if (stats && stats.sent > 0) {
        rtts.forEach(function (rtt) {
            if (rtt <= min) min = rtt.toFixed(DIGITS_STATS);
            if (rtt >= max) max = rtt.toFixed(DIGITS_STATS);
            sum += rtt;
        });

        avg = (sum / rtts.length).toFixed(DIGITS_STATS);
        dev = stdev(rtts).toFixed(DIGITS_STATS);

        if (min === Infinity) min = "0";
        if (isNaN(avg)) avg = "0";

        printed = true;

        writeLine("\n---", host, pkg.name + " statistics", "---",
                  "\n" + stats.sent, "handshakes attempted,", stats.success || "0", "succeeded,",
                  ((stats.failed / stats.sent) * 100).toFixed(DIGITS_PERC) + "% failed",
                  "\nrtt min/avg/max/stdev =", min + "/" + avg + "/" + max + "/" + dev, "ms");
    }
    process.exit(0);
}

function colorRTT(rtt) {
    return chalk[rtt >= 150 ? "red" : rtt >= 75 ? "yellow" : "green"](rtt) + " ms";
}

function writeLine() {
    var arg = [].slice.call(arguments), stream;
    arg = arg.filter(function (string) { return Boolean(string); });
    if ((args.timeout || args.t) && arg[0][0] !== "\n") arg.unshift(timestamp());
    arg.push("\n");
    stream = (process.stdout._type === "pipe" && printed) ? process.stderr : process.stdout;
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
    var now = new Date(), day = now.getDate(), month = now.getMonth() + 1,
        year = now.getFullYear(), hrs = now.getHours(), mins = now.getMinutes(),
        secs = now.getSeconds();

    if (month < 10) month = "0" + month;
    if (day   < 10) day   = "0" + day;
    if (hrs   < 10) hrs   = "0" + hrs;
    if (mins  < 10) mins  = "0" + mins;
    if (secs  < 10) secs  = "0" + secs;
    return year + "-"  + month + "-" + day + " " + hrs + ":" + mins + ":" + secs;
}
