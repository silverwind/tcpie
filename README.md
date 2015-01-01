#tcpie [![NPM version](https://img.shields.io/npm/v/tcpie.svg?style=flat)](https://www.npmjs.org/package/tcpie) [![Dependency Status](http://img.shields.io/david/silverwind/tcpie.svg?style=flat)](https://david-dm.org/silverwind/tcpie)
> 'ping'-like utility to repeatedly test a remote TCP port for connectivity

##Installation
```
$ [sudo] npm install -g tcpie
```
###Example
```
$ tcpie -c 5 google.com
TCPIE google.com (188.21.9.20) port 80
connected to google.com:80 seq=1 time=30.3
connected to google.com:80 seq=2 time=30.5
connected to google.com:80 seq=3 time=29.9
connected to google.com:80 seq=4 time=29.7
connected to google.com:80 seq=5 time=30.2

--- google.com tcpie statistics ---
5 handshakes attempted, 5 succeeded, 0% failed
rtt min/avg/max = 29.691/30.105/30.452 ms
```
##Usage
```
tcpie [options] host [port]
```
##Options
```
    -h, --help          output usage information
    -V, --version       output the version number
    -c, --count <n>     Number of connects (default: Infinte)
    -i, --interval <n>  Wait n seconds between connects (default: 1)
    -t, --timeout <n>   Connection timeout in seconds (default: 3)
    -f, --flood         Flood Mode, Connect as fast as possible
```

##Module API
###Example
```js
var tcpie = require("tcpie"),
    pie   = tcpie("google.com", 80, {count: 10, interval: 500, timeout: 2000});

pie.on("end", function(stats) {
    console.log(stats);
    // -> { sent: 10, success: 10, failed: 0 }
});

pie.start(); // Starts connecting
```
### tcpie(host, port, options)
*Creates a new connector.*
- `host`: *string* the destination hostname or IP address.
- `port`: *number* the destination port.
- `opts`: *object* options for count, interval and timeout.

### Events
- `error`   : Arguments: `seq`, `stats`, `err`. Emmited when an connection error happens.
- `connect` : Arguments: `seq`, `stats`, `ttl`. Emmited when an connection attempt succeeds.
- `timeout` : Arguments: `seq`, `stats`. Emmited when an connection attempt runs into the timeout.
- `end`     : Arguments: `stats`. Emmitted when all attempts (defined by `count`) are finished.

### `options` Object
- `count`   : *number* the number of connection attempts in milliseconds.
- `interval`: *number* the interval between connection attempts in milliseconds.
- `timeout` : *number* the connection timeout in milliseconds.

### `stats` Object
- `sent`    : *number* total number of attempts made.
- `success` : *number* number of successfull attempts.
- `failed`  : *number* number of failed attempts.

© 2015 [silverwind](https://github.com/silverwind), distributed under BSD licence
