// This file is provided to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file
// except in compliance with the License.  You may obtain
// a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

/**
 * Simple Node.js based proxy for ElasticSearch:
 *
 * - it can expose only part of the REST API (can be configure by regular expressions). By default it is configured
 *   to expose only *safe* operations thus clients can not modify, delete and add indices nor they can shutdown and
 *   restart cluster nodes.
 *
 * Example: the following command start the proxy on port 80 and allows only GET requests with '_search' in URL
 *
 * $node node-proxy.js proxyPort=80 allowed='{"GET":["_search"]}'
 *
 */

var http = require('http');

var defaults = {
    seeds : ["localhost:9200"],
    //allowed : { "GET" : [".*"], "POST" : [".*"], "OPTIONS" : [".*"]},
    allowed : { "GET" : ["(_search|_status|_mapping)","/.+/.+/.+/_mlt","/.+/.+/.+]"], "POST" : ["_search","/.+/.+/.+/_mlt"], "OPTIONS" : [".*"]},
    refresh : 10,
    proxyPort : 8124
};
var filters = {
    "GET" : [], "POST" : [], "OPTIONS" : []
};

// verify command line arguments (they override defaults) and pre-compile RegExps
var parseArgs = function() {
    if (process.argv.length > 2) {
        for (i=1;i<process.argv.length;i++) {
            var p = process.argv[i].split("=",2);
            if (defaults[p[0]]) {
                if (p[0] === "refresh") {defaults.refresh=parseInt(p[1])}
                else if (p[0] === "proxyPort") {defaults.proxyPort=parseInt(p[1])}
                else {
                    var o = JSON.parse(p[1]);
                    if (p[0] === "seeds") {
                        if (typeof o === "object" && o["join"] && o.length > 0) {
                           defaults.seeds = o;
                        } else {
                            throw new Error("parameter [seeds] is not a valid non-empty json array");
                        }
                    } else if (p[0] === "allowed") {
                        if (typeof o ==="object" && o["join"] === undefined) {
                           defaults.allowed = o;
                        } else {
                            throw new Error("parameter [allowed] must be valid json object, not array");
    }}}}}}
    if (defaults.allowed.GET) for (i=0;i<defaults.allowed.GET.length;i++) { filters.GET.push(new RegExp(defaults.allowed.GET[i])); }
    if (defaults.allowed.POST) for (i=0;i<defaults.allowed.POST.length;i++) { filters.POST.push(new RegExp(defaults.allowed.POST[i])); }
    if (defaults.allowed.OPTIONS) for (i=0;i<defaults.allowed.OPTIONS.length;i++) { filters.OPTIONS.push(new RegExp(defaults.allowed.OPTIONS[i])); }
}

try { parseArgs(); }
catch(err) {
    console.log(err.name+": "+err.message);
    process.exit(1);
}

var testFilters = function(method, url) {
    if (method && url) {
        for (i=0;i<filters[method.toUpperCase()].length;i++) {
            if (filters[method.toUpperCase()][i].test(url)) {
                return true;
            }
        }
    }
    return false;
}

http.createServer(function (req, res) {
    if (testFilters(req.method, req.url)) {
        var d = "";
        req.on('data', function(chunk) {
            d += chunk; // chunk.length bytes chunk
        });
        req.on('end', function() {
            var es = http.createClient("9200", "localhost"); // TODO get ElasticSearch-js client
            var request = es.request(req.method, req.url);
            request.on('response', function(response) {
                var jres = "";
                response.on('data', function(chunk) {
                    jres += chunk;
                });
                response.on('end', function() {
                    var jsource;
                    if (jres.length > 0) {
                        jsource = JSON.parse(jres);
//                        delete jsource._shards; // TODO implement better filtering of response output
                    }
                    { // why do I have to remove content-length and add chunked get it working?
                        delete response.headers["Content-Length"];
                        response.headers["Transfer-Encoding"] = "chunked";
                    }
                    res.writeHead(response.statusCode, response.headers);
                    res.end(JSON.stringify(jsource));
                });
            });
            request.write(d);
            request.end();
        });
    } else {
        res.writeHead(403, {'Content-Type': 'application/json'});
        res.end('{"error":"Request not supported by proxy"}');
    }
}).listen(defaults.proxyPort, "127.0.0.1");
console.log('ElasticSearch proxy server started at http://127.0.0.1:'+defaults.proxyPort+'/');