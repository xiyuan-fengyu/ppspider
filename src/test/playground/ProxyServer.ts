/*
模拟一个 proxy server
 */

const net = require('net');

net.createServer(socket => {
    socket.pipe(process.stdout);
}).listen(3000, '127.0.0.1');
