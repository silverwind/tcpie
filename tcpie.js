#!/usr/bin/env node
"use strict";

var pkg = require("./package.json");

// set process name
process.title = pkg.name;

// avoid EPIPE on partially consumed streams
require("epipebomb")();

var cmd    = require("commander"),
    chalk  = require("chalk"),
    net    = require("net"),
    dns    = require("dns"),
    stdev  = require("compute-stdev"),
    tcpie  = require("./");

var DIGITS_LINE  = 1,
    DIGITS_STATS = 3,
    DIGITS_PERC  = 0,
    DEFAULT_PORT = 80;

cmd
    .usage("[options] host [port]")
    .option("-v, --version", "output the version number", function () {
        writeLine(pkg.version);
        process.exit(0);
    })
    .option("-c, --count <n>", "number of connects (default: infinite)", parseInt)
    .option("-i, --interval <n>", "wait n seconds between connects (default: 1)", parseFloat)
    .option("-t, --timeout <n>", "connection timeout in seconds (default: 3)", parseFloat)
    .option("-T, --timestamp", "add timestamps to output")
    .option("-f, --flood", "flood mode, connect as fast as possible")
    .option("-C, --no-color", "disable color output")
    .on("--help", function () {
        writeLine("  Notes:");
        writeLine("");
        writeLine("    -  host:port syntax is supported");
        writeLine("    -  port defaults to 80");
        writeLine();
        writeLine("  Examples:");
        writeLine();
        writeLine("    $", pkg.name, "-c 5 google.com");
        writeLine("    $", pkg.name, "-c 10 aspmx.l.google.com 25");
        writeLine();
    })
    .parse(process.argv);

if (!cmd.args.length || cmd.args.length > 2 || (cmd.args[1] && isNaN(parseInt(cmd.args[1], 10)))) {
    cmd.outputHelp();
    process.exit(1);
}

var host    = cmd.args[0],
    opts    = {},
    port    = parseInt(cmd.args[1], 10),
    printed = false,
    rtts    = [],
    stats;

// host:port syntax
var matches = host.match(/^(.+):(.+)$/);
if (matches && matches.length === 3 && !port) {
    host = matches[1];
    port = matches[2];
}

if (!port) port = DEFAULT_PORT;
if (cmd.count) opts.count = parseInt(cmd.count, 10);
if (cmd.interval) opts.interval = secondsToMs(cmd.interval);
if (cmd.timeout) opts.timeout = secondsToMs(cmd.timeout);
if (cmd.flood) opts.interval = 0;
if (!cmd.color) chalk.enabled = false;

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
    process.on("SIGINT", process.exit);
    process.on("SIGQUIT", process.exit);
    process.on("SIGTERM", process.exit);
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
    var args = [].slice.call(arguments), stream;
    args = args.filter(function (string) { return Boolean(string); });
    if (cmd.timestamp && args[0][0] !== "\n") args.unshift(timestamp());
    args.push("\n");
    stream = (process.stdout._type === "pipe" && printed) ? process.stderr : process.stdout;
    stream.write(args.join(" "));
}

// convert seconds to milliseconds
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
};
