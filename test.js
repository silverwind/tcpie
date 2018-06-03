"use strict";

const assert = require("assert");
const tcpie = require(".");

const pie = tcpie("google.com", 443, {count:2});
let runs = 0;
pie.on("end", stats => {
  runs++;
  assert.equal(stats.sent, 2);
  assert.equal(stats.success, 2);
  assert.equal(stats.failed, 0);
  if (runs < 5) pie.start(); // run 5 times
}).start();
