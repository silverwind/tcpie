# tcpie
[![](https://img.shields.io/npm/v/tcpie.svg?style=flat)](https://www.npmjs.org/package/tcpie) [![](https://img.shields.io/npm/dm/tcpie.svg)](https://www.npmjs.org/package/tcpie) [![](https://api.travis-ci.org/silverwind/tcpie.svg?style=flat)](https://travis-ci.org/silverwind/tcpie)
> Ping any TCP port

tcpie is a tool to measure latency and verify the reliabilty of a TCP connection. It does so by initiating a handshake followed by an immediately termination of the socket. While many existing tools require raw socket access, tcpie runs fine in user space. An API for use as a module is also provided.

## CLI
### Installation
Install [Node.js](https://nodejs.org) and then do:
```
$ npm install -g tcpie
```
### Example
```
$ tcpie -c 5 google.com 443
TCPIE google.com (188.21.9.120) port 443
connected to google.com:443 seq=1 srcport=59053 time=12.9 ms
connected to google.com:443 seq=2 srcport=59054 time=10.0 ms
connected to google.com:443 seq=3 srcport=59055 time=10.1 ms
connected to google.com:443 seq=4 srcport=59056 time=11.4 ms
connected to google.com:443 seq=5 srcport=59057 time=10.4 ms

--- google.com tcpie statistics ---
5 handshakes attempted, 5 succeeded, 0% failed
rtt min/avg/max/stdev = 10.012/10.970/12.854/1.190 ms
```
## Usage
```
Usage: tcpie [options] host[:port]|url [port|22]

Options:

  -v, --version       output version
  -c, --count <n>     number of connects (default: infinite)
  -i, --interval <n>  wait n seconds between connects (default: 1)
  -t, --timeout <n>   connection timeout in seconds (default: 3)
  -T, --timestamp     add timestamps to output
  -f, --flood         flood mode, connect as fast as possible
  -C, --no-color      disable color output

Examples:

  $ tcpie google.com
  $ tcpie -i .1 8.8.8.8:53
  $ tcpie -c5 -t.05 aspmx.l.google.com 25
  $ tcpie -i.2 https://google.com

```

## Module API
### Installation
```
$ npm install --save tcpie
```
### Example
```js
var tcpie = require('tcpie');
var pie = tcpie('google.com', 443, {count: 10, interval: 500, timeout: 2000});

pie.on('connect', function(stats) {
  console.info('connect', stats);
}).on('error', function(err, stats) {
  console.error(err, stats);
}).on('timeout', function(stats) {
  console.info('timeout', stats);
}).on('end', function(stats) {
  console.info(stats);
  // -> {
  // ->   sent: 10,
  // ->   success: 10,
  // ->   failed: 0,
  // ->   target: { host: 'google.com', port: 443 }
  // -> }
}).start();
```
#### tcpie(host, [port], [options])
- `host` *string* : the destination host name or IP address. Required.
- `port` *number* : the destination port. Default: `22`.
- `opts` *object* : options for count, interval and timeout. Defaults: `Infinity`, `1000`, `3000`.

#### *options* object
- `count`    *number* : the number of connection attempts in milliseconds (default: Infinity).
- `interval` *number* : the interval between connection attempts in milliseconds (default: 1000).
- `timeout`  *number* : the connection timeout in milliseconds (default: 3000).

#### Events
- `connect` : Arguments: `stats`. Connection attempt succeeded.
- `timeout` : Arguments: `stats`. Connection attempt ran into the timeout.
- `error`   : Arguments: `err`, `stats`. Connection attempt failed.
- `end`     : Arguments: `stats`. All connection attempts have finished.

#### *stats* argument properties
- `sent`    *number* : number of total attempts made.
- `success` *number* : number of successfull attempts.
- `failed`  *number* : number of failed attempts.
- `target`  *object* : target details: `host` and `port`.

The following properties are present on all events except `end`:
- `rtt`     *number* : roundtrip time in milliseconds. *undefined* if failed.
- `socket`  *object* : socket details: `localAddress`, `localPort`, `remoteAddress`, `remotePort`.

© [silverwind](https://github.com/silverwind), distributed under BSD licence
