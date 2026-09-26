import {once} from "node:events";
import {createServer, Socket, type AddressInfo} from "node:net";
import {tcpie} from "./index.ts";
import type {EndStats, Stats} from "./index.ts";

async function listen(): Promise<number> {
  const server = createServer(socket => socket.destroy()).listen(0, "127.0.0.1").unref();
  await once(server, "listening");
  return (server.address() as AddressInfo).port;
}

const port = await listen();

test("first", async () => {
  const pie = tcpie("127.0.0.1", port, {count: 2, interval: 10});
  const ends = await new Promise<Array<EndStats>>(resolve => {
    const ends: Array<EndStats> = [];
    pie.on("end", (stats: EndStats) => {
      ends.push(stats);
      if (ends.length < 5) pie.start();
      else resolve(ends);
    }).start();
  });
  for (const stats of ends) expect(stats).toMatchObject({sent: 2, success: 2, failed: 0});
});

test("second", async () => {
  const pie = tcpie("127.0.0.1", port, {count: 2});
  const connects: Array<Stats> = [];
  const ends: Array<EndStats> = [];
  pie.on("connect", (stats: Stats) => {
    connects.push({...stats});
    pie.stop();
  }).on("end", (stats: EndStats) => {
    ends.push(stats);
  }).start();
  await once(pie, "end");
  expect(connects).toMatchObject([{sent: 1, success: 1, failed: 0}]);
  expect(ends).toMatchObject([{sent: 1, success: 1, failed: 0}]);
});

test("overlapping attempts measure their own rtt", async () => {
  const slowPort = await listen();
  const {connect} = Socket.prototype;
  const spy = vi.spyOn(Socket.prototype, "connect").mockImplementation(function(this: Socket, ...args: Array<unknown>) {
    if (args[0] === slowPort) setTimeout(() => this.destroyed || Reflect.apply(connect, this, args), 100);
    else Reflect.apply(connect, this, args);
    return this;
  });
  const rtts: Array<number> = [];
  const pie = tcpie("127.0.0.1", slowPort, {count: 3, interval: 10});
  pie.on("connect", (stats: Stats) => {
    rtts.push(stats.rtt!);
  }).start();
  await once(pie, "end");
  spy.mockRestore();
  expect(rtts).toHaveLength(3);
  for (const rtt of rtts) expect(rtt).toBeGreaterThan(50);
});
