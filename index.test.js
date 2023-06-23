import {tcpie} from "./index.js";

test("first", () => {
  let runs = 0;
  const pie = tcpie("google.com", 443, {count: 2});
  pie.on("end", stats => {
    runs++;
    expect(stats.sent).toEqual(2);
    expect(stats.success).toEqual(2);
    expect(stats.failed).toEqual(0);
    if (runs < 5) pie.start(); // run 5 times
  }).start();
});

test("second", () => {
  const pie = tcpie("google.com", 443, {count: 2});
  pie.on("connect", stats => {
    expect(stats.sent).toEqual(1);
    expect(stats.success).toEqual(1);
    expect(stats.failed).toEqual(0);
    pie.stop();
  }).on("end", stats => {
    expect(stats.sent).toEqual(1);
    expect(stats.success).toEqual(1);
    expect(stats.failed).toEqual(0);
  }).start();
});
