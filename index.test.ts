import {once} from "node:events";
import {createServer, type AddressInfo} from "node:net";
import {tcpie} from "./index.ts";
import type {EndStats, Stats} from "./index.ts";

const server = createServer(socket => socket.destroy()).listen(0, "127.0.0.1").unref();
await once(server, "listening");
const {port} = server.address() as AddressInfo;

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
  pie.on("connect", (stats: Stats) => {
    connects.push({...stats});
    pie.stop();
  }).start();
  const [end] = await once(pie, "end");
  expect(connects).toMatchObject([{sent: 1, success: 1, failed: 0}]);
  expect(end).toMatchObject({sent: 1, success: 1, failed: 0});
});
