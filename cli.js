#!/usr/bin/env node
"use strict";

var cmd    = require("commander"),
    chalk  = require("chalk"),
    net    = require("net"),
    dns    = require("dns"),
    pkg    = require("./package.json"),
    tcpie  = require("./");

cmd
    .version(pkg.version)
    .usage("[options] host [port]")
    .option("-c, --count <n>", "number of connects (default: Infinte)", parseInt)
    .option("-i, --interval <n>", "wait n seconds between connects (default: 1)", parseFloat)
    .option("-t, --timeout <n>", "connection timeout in seconds (default: 3)", parseInt)
    .option("-f, --flood", "flood mode, connect as fast as possible")
    .on("--help", function() {
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

var opts   = {},
    host   = cmd.args[0],
    port   = parseInt(cmd.args[1], 10) || 80,
    rtts   = [],
    stats;

if (cmd.count) opts.count = parseInt(cmd.count);
if (cmd.interval) opts.interval = secondsToMs(cmd.interval);
if (cmd.timeout) opts.count = secondsToMs(cmd.timeout);
if (cmd.flood) opts.interval = 0;

// Do a DNS lookup and start the connects
if (!net.isIP(host)) {
    dns.lookup(host, function (err, address) {
        if (!err) {
            printStart(host, address, port);
            run(host, port, opts, host);
        } else {
            if (err.code === "ENOTFOUND")
                writeLine(chalk.red("ERROR:"), "Domain", host, "not found.");
            else
                writeLine(chalk.red("ERROR:"), err.code, err.syscall || "");
            process.exit(1);
        }
    });
}

function run(host, port, opts, hostname) {
    var pie = tcpie(host, port, opts);

    pie.on("error", function(seq, st, details, err) {
        stats = st;
        writeLine("error connecting to", (hostname || host) + ":" + port, "seq=" + seq,
            "srcport=" + details.localPort, err.code || "");
    });

    pie.on("connect", function(seq, st, details, rtt) {
        stats = st;
        rtts.push(rtt);
        writeLine("connected to", (hostname || host) + ":" + port, "seq=" + seq,
            "srcport=" + details.localPort, "time=" + rtt.toFixed(1));
    });

    pie.on("timeout", function(seq, st, details) {
        stats = st;
        writeLine("timeout connecting to", (hostname || host) + ":" + port, "seq=" + seq,
                  "srcport=" + details.localPort);
    });

    pie.on("end", function(st) {
        stats = st;
        printEnd();
    });

    process.on("SIGINT", printEnd);
    process.on("SIGQUIT", printEnd);
    process.on("SIGTERM", printEnd);

    pie.start();
}

function printStart(host, address, port) {
    writeLine(pkg.name.toUpperCase(), host , "(" + address + ")", "port", String(port));
}

function printEnd() {
    var sum = 0, min = Infinity, max = 0, avg;

    if (rtts.length) {
        rtts.forEach(function(rtt) {
            if (rtt <= min) min = rtt.toFixed(3);
            if (rtt >= max) max = rtt.toFixed(3);
            sum += rtt;
        });

        avg = (sum / rtts.length).toFixed(3);
        if (isNaN(avg)) avg = 0;

        writeLine("\n---", host, pkg.name + " statistics", "---");
        writeLine(stats.sent, "handshakes attempted,", stats.success, "succeeded,",
                  (stats.failed / stats.sent).toFixed(0) * 100 + "% failed");
        writeLine("rtt min/avg/max =", min + "/" + avg + "/" + max, "ms");
    }
    process.exit(0);
}

function writeLine() {
    var args = Array.prototype.slice.call(arguments);
    args.push("\n");
    process.stdout.write(args.join(" "));
}

// convert seconds to milliseconds
function secondsToMs(s) {
    return (parseFloat(s) * 1000);
}
