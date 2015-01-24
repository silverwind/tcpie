#!/usr/bin/env node
"use strict";

var pkg    = require("./package.json");

process.name = pkg.name;

var cmd    = require("commander"),
    chalk  = require("chalk"),
    net    = require("net"),
    dns    = require("dns"),
    stdev  = require("compute-stdev"),
    tcpie  = require("./");

var DIGITS_LINE  = 1,
    DIGITS_STATS = 3,
    DIGITS_PERC  = 0;

cmd
    .version(pkg.version)
    .usage("[options] host [port]")
    .option("-c, --count <n>", "number of connects (default: infinite)", parseInt)
    .option("-i, --interval <n>", "wait n seconds between connects (default: 1)", parseFloat)
    .option("-t, --timeout <n>", "connection timeout in seconds (default: 3)", parseFloat)
    .option("-f, --flood", "flood mode, connect as fast as possible")
    .option("--color", "enable color output")
    .on("--help", function () {
        writeLine("  Note: port defaults to 80");
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
    port    = parseInt(cmd.args[1], 10) || 80,
    printed = false,
    rtts    = [],
    stats;

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
                writeLine(chalk.red("ERROR:"), "Domain", host, "not found.");
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
            chalk.red("error connecting to"),
            chalk.red(data.target.host + ":" + data.target.port),
            chalk.yellow("seq=") + chalk.green(data.sent),
            chalk.yellow("error=") + chalk.red(err.code)
        );
    });

    pie.on("connect", function (data) {
        stats = data;
        rtts.push(data.rtt);
        writeLine(
            chalk.green("connected to"),
            chalk.green(data.target.host + ":" + data.target.port),
            chalk.yellow("seq=") + chalk.green(data.sent),
            chalk.yellow("srcport=") + chalk.green(data.socket.localPort),
            chalk.yellow("time=") + colorRTT(data.rtt.toFixed(DIGITS_LINE))
        );
    });

    pie.on("timeout", function (data) {
        stats = data;
        writeLine(
              chalk.red("timeout connecting to"),
              chalk.red(data.target.host + ":" + data.target.port),
              chalk.yellow("seq=") + chalk.green(data.sent),
              data.socket.localPort && chalk.yellow("srcport=") + chalk.green(data.socket.localPort)
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
    if (rtt >= 150)
        return chalk.red(rtt + " ms");
    else if (rtt >= 75)
        return chalk.yellow(rtt + " ms");
    else
        return chalk.green(rtt + " ms");
}

function writeLine() {
    var args = Array.prototype.slice.call(arguments), stream;
    args = args.filter(function (string) { return Boolean(string); });
    args.push("\n");
    stream = (process.stdout._type === "pipe" && printed) ? process.stderr : process.stdout;
    stream.write(args.join(" "));
}

// convert seconds to milliseconds
function secondsToMs(s) {
    return (parseFloat(s) * 1000);
}
