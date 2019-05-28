var url = require('url');
var https = require('https');
var HttpsProxyAgent = require('https-proxy-agent');

// HTTP/HTTPS proxy to connect to
var proxy = process.env.http_proxy || 'http://127.0.0.1:2007';
console.log('using proxy server %j', proxy);

// HTTPS endpoint for the proxy to connect to
var endpoint = process.argv[2] || 'https://www.google.com/';
console.log('attempting to GET %j', endpoint);
var options = url.parse(endpoint);

// create an instance of the `HttpsProxyAgent` class with the proxy server information
var agent = new HttpsProxyAgent(proxy);
options.agent = agent;
options.method = "GET";

// https://stackoverflow.com/questions/13121590/steps-to-send-a-https-request-to-a-rest-service-in-node-js
https.request(options, res => {
    console.log('"response" event!', res.headers);
    res.pipe(process.stdout);
}).end();
