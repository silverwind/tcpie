"use strict";

const assert = require("assert");
const tcpie = require(".");

tcpie("google.com", 80, {count:1}).on("end", function(stats) {
  assert.equal(stats.sent, 1);
  assert.equal(stats.success, 1);
  assert.equal(stats.failed, 0);
}).start();
