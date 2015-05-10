# tcpie [![NPM version](https://img.shields.io/npm/v/tcpie.svg?style=flat)](https://www.npmjs.org/package/tcpie) [![Dependency Status](http://img.shields.io/david/silverwind/tcpie.svg?style=flat)](https://david-dm.org/silverwind/tcpie) [![Downloads per month](http://img.shields.io/npm/dm/tcpie.svg?style=flat)](https://www.npmjs.org/package/tcpie)
> ping-like tool to test a TCP connection

tcpie is a tool to measure latency and verify the reliabilty of a TCP connection. It does so by initiating a handshake followed by an immediately termination of the socket. While many existing tools require raw socket access, tcpie runs fine in user space. An API for use as a module is also provided.

## Installation
```
$ [sudo] npm install -g tcpie
```
### Example
```
$ tcpie -c 5 google.com
TCPIE google.com (188.21.9.116) port 80
connected to google.com:80 seq=1 srcport=3238 time=25.8 ms
connected to google.com:80 seq=2 srcport=3239 time=31.9 ms
connected to google.com:80 seq=3 srcport=3240 time=29.1 ms
connected to google.com:80 seq=4 srcport=3241 time=28.9 ms
connected to google.com:80 seq=5 srcport=3242 time=28.5 ms

--- google.com tcpie statistics ---
5 handshakes attempted, 5 succeeded, 0% failed
rtt min/avg/max/stdev = 25.757/28.835/31.908/2.184 ms
```
## Usage
```
Usage: tcpie [options] host[:port] [port|80]

Options:

  -v, --version       output version
  -c, --count <n>     number of connects (default: infinite)
  -i, --interval <n>  wait n seconds between connects (default: 1)
  -t, --timeout <n>   connection timeout in seconds (default: 3)
  -T, --timestamp     add timestamps to output
  -f, --flood         flood mode, connect as fast as possible
  -C, --no-color      disable color output
```

## Module API
### Installation
```
$ npm install --save tcpie
```
### Example
```js
var tcpie = require('tcpie');
var pie = tcpie('google.com', 80, {count: 10, interval: 500, timeout: 2000});

pie.on('connect', function(data) {
  console.info('connect', data);
}).on('error', function(data, err) {
  console.error(err, data);
}).on('timeout', function(data) {
  console.info('timeout', data);
}).on('end', function(stats) {
  console.info(stats);
  // -> {
  // ->   sent: 10,
  // ->   success: 10,
  // ->   failed: 0,
  // ->   target: { host: 'google.com', port: 80 }
  // -> }
}).start();
```
#### tcpie(host, [port], [options])
- `host` *string* : the destination host name or IP address. Required.
- `port` *number* : the destination port. Default: `80`.
- `opts` *object* : options for count, interval and timeout. Defaults: `Infinity`, `1000`, `3000`.

#### *options* object
- `count`    *number* : the number of connection attempts in milliseconds (default: Infinity).
- `interval` *number* : the interval between connection attempts in milliseconds (default: 1000).
- `timeout`  *number* : the connection timeout in milliseconds (default: 3000).

#### Events
- `connect` : Arguments: `data`. Connection attempt succeeded.
- `timeout` : Arguments: `data`. Connection attempt ran into the timeout.
- `error`   : Arguments: `data`, `err`. Connection attempt failed.
- `end`     : Arguments: `stats`. All connection attempts have finished.

#### *data* argument properties
- `sent`    *number* : number of total attempts made.
- `success` *number* : number of successfull attempts.
- `failed`  *number* : number of failed attempts.
- `rtt`     *number* : roundtrip time in milliseconds. *undefined* if failed.
- `target`  *object* : target details: `host` and `port`.
- `socket`  *object* : socket details: `localAddress`, `localPort`, `remoteAddress`, `remotePort`.

#### *stats* argument properties
- `sent`    *number* : number of total attempts made.
- `success` *number* : number of successfull attempts.
- `failed`  *number* : number of failed attempts.
- `target`  *object* : target details: `host` and `port`.

© 2015 [silverwind](https://github.com/silverwind), distributed under BSD licence
