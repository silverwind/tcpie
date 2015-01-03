#tcpie [![NPM version](https://img.shields.io/npm/v/tcpie.svg?style=flat)](https://www.npmjs.org/package/tcpie) [![Dependency Status](http://img.shields.io/david/silverwind/tcpie.svg?style=flat)](https://david-dm.org/silverwind/tcpie)
> 'ping'-like utility to repeatedly test a remote TCP port for connectivity

tcpie is an simple tool to verify the reliabilty of a network connection to a remote server. It does so by initiating a handshake and immediately terminating the connection afterwards. It was created because similar tools like `hping` require raw socket access (usually only granted to root), while tcpie runs fine in userspace. Further, an API is provided for use as a module.

##Installation
```
$ [sudo] npm install -g tcpie
```
###Example
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
##Usage
```
Usage: tcpie [options] host [port]

Options:

  -h, --help          output usage information
  -V, --version       output the version number
  -c, --count <n>     number of connects (default: Infinte)
  -i, --interval <n>  wait n seconds between connects (default: 1)
  -t, --timeout <n>   connection timeout in seconds (default: 3)
  -f, --flood         flood mode, connect as fast as possible
  --color             enable color output
```

##Module API
###Installation
```
$ npm install --save tcpie
```
###Example
```js
var tcpie = require("tcpie");
var pie = tcpie("google.com", 80, {count: 10, interval: 500, timeout: 2000});

pie.on("connect", function(seq) {
    console.log("connect", seq);
}).on("end", function(stats) {
    console.log(stats);
    // -> { sent: 10, success: 10, failed: 0 }
}).start();
```
#### tcpie(host, [port], [options])
- `host` *string* : the destination host name or IP address. Required.
- `port` *number* : the destination port. Default: `80`.
- `opts` *object* : options for count, interval and timeout. Defaults: `Infinity`, `1`, `3000`.

#### Events
- `connect` : Arguments: `seq`, `stats`, `details`, `rtt`. Connection attempt succeeded.
- `error`   : Arguments: `seq`, `stats`, `details`, `err`. Connection attempt failed.
- `timeout` : Arguments: `seq`, `stats`, `details`. Connection attempt ran into the timeout.
- `end`     : Arguments: `stats`. All connection attempts have finished.

#### Event arguments
- `seq`     *number* : current sequence number. Starting at 1.
- `stats`   *object* : stats object descibed below.
- `details` *object* : socket details, `localAddress`, `localPort`, `remoteAddress`, `remotePort`.
- `rtt`     *number* : total time to establish handshake in milliseconds (not rounded).
- `err`     *error*  : connection error on the `error` event.

#### *options* object
- `count`    *number* : the number of connection attempts in milliseconds (default: Infinity).
- `interval` *number* : the interval between connection attempts in milliseconds (default: 1000).
- `timeout`  *number* : the connection timeout in milliseconds (default: 3000).

#### *stats* object
- `sent`     *number* : total number of attempts made.
- `success`  *number* : number of successfull attempts.
- `failed`   *number* : number of failed attempts.

© 2015 [silverwind](https://github.com/silverwind), distributed under BSD licence
