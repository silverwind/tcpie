import {execFile} from "node:child_process";
import {once} from "node:events";
import {createServer, Socket, type AddressInfo} from "node:net";
import {tcpie, type EndStats, type Stats} from "./index.ts";

async function listen(): Promise<number> {
  const server = createServer(socket => socket.end("banner")).listen(0, "127.0.0.1").unref();
  await once(server, "listening");
  return (server.address() as AddressInfo).port;
}

const port = await listen();

test("restarting from the end listener repeats the run", async () => {
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

test("stop from a connect listener ends the run once", async () => {
  const pie = tcpie("127.0.0.1", port, {count: 2});
  const events: Array<[string, Stats | EndStats]> = [];
  pie.on("connect", (stats: Stats) => {
    events.push(["connect", {...stats}]);
    pie.stop();
  }).on("end", (stats: EndStats) => { events.push(["end", stats]); }).start();
  await once(pie, "end");
  const stats = {sent: 1, success: 1, failed: 0};
  expect(events).toMatchObject([["connect", stats], ["end", stats]]);
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
  await once(tcpie("127.0.0.1", slowPort, {count: 3, interval: 10}).on("connect", (stats: Stats) => {
    rtts.push(stats.rtt!);
  }).start(), "end");
  spy.mockRestore();
  expect(rtts.map(rtt => rtt > 50)).toEqual([true, true, true]);
});

test("sockets close after the server sends data and closes", async () => {
  const bannerPort = await listen();
  const spy = vi.spyOn(Socket.prototype, "end");
  await once(tcpie("127.0.0.1", bannerPort, {count: 1}).start(), "end");
  const socket = (spy.mock.contexts as Array<Socket>).find(socket => socket.remotePort === bannerPort)!;
  spy.mockRestore();
  await once(socket, "close");
});

test("cli accepts ipv6 address without port", async () => {
  const stdout = await new Promise<string>(resolve => {
    execFile(process.execPath, ["tcpie.ts", "-c1", "-t.01", "::1"], (_err, stdout) => resolve(stdout));
  });
  expect(stdout).toMatch(/^TCPIE ::1 \(::1\) port 22 /);
});
