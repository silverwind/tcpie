"use strict";

const assert = require("assert");
const tcpie = require(".");

let runs = 0;
const pie = tcpie("google.com", 443, {count: 2});
pie.on("end", stats => {
  runs++;
  assert.equal(stats.sent, 2);
  assert.equal(stats.success, 2);
  assert.equal(stats.failed, 0);
  if (runs < 5) pie.start(); // run 5 times
}).start();

const pie2 = tcpie("google.com", 443, {count: 2});
pie2.on("connect", stats => {
  assert.equal(stats.sent, 1);
  assert.equal(stats.success, 1);
  assert.equal(stats.failed, 0);
  pie2.end();
}).on("end", stats => {
  assert.equal(stats.sent, 1);
  assert.equal(stats.success, 1);
  assert.equal(stats.failed, 0);
}).start();
