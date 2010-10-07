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

/*
    ElasticSearch proxy server for NodeJS.

    It can expose only part of the REST API (can be configure by rules using regular expressions). By default it
    is configured to expose only *safe* operations thus clients can not modify, delete and add indices nor they
    can shutdown and restart cluster nodes.

    It is possible to set rules for any of the following request types:
    GET, POST, PUT, DELETE, HEAD and OPTIONS

    Note: OPTIONS requests can be used by some clients for pre-flight requests. If no OPTIONS requests allowed
    then some clients may not work properly.

    ElasticSearchProxy can be configured by passing parameter into constructor. There are several ways how to
    change default settings:

    1) Passing a JSON object into the constructor. Then relevant values from this object will replace default
       settings:


        Example #1:
        Start the proxy on port 80 and allows only GET requests with '_search' in URL
        -------------------------------------------------------------

            var config = { port : 80, allow : { "GET" : ["_search"] }};
            var proxy = require('./elasticsearch-proxy').getProxy(config).start();


        Example #2:
        Start the proxy on default port with no restrictions on any GET, POST and OPTIONS requests
        -------------------------------------------------------------

            var config = { allow : { "GET" : [".*"], "POST" : [".*"], "OPTIONS" : [".*"] }};
            var proxy = require('./elasticsearch-proxy').getProxy(config).start();


    2) Passing "string" object into constructor. In this case the string is assumed to represent path to the file
       with json configuration. Relevant information from this file will replace default settings.


        Example #3:
        Start proxy with json file based configuration
        -------------------------------------------------------------

            var proxy = require('./elasticsearch-proxy').getProxy("./elastic_search_proxy.json").start();


        Assumes there is a file ./elastic_search_proxy.json with json configuration.
        If the file can not be found or is not accessible then the default settings are used instead.


    3) Calling constructor without any parameter is the same as calling it with "./proxy.json" parameter.
       In other words, if constructor called without parameter then it try to load configuration
       from ./proxy.json file and merge it with default settings, if not successful then it simply
       uses the default settings. 

        Example #4:
        Start proxy with the default settings
        -------------------------------------------------------------

            var proxy = require('./elasticsearch-proxy').getProxy().start();


        The following are the default settings:

        {
            seeds : ["localhost:9200"],
            allow : {
                "GET" : ["(_search|_status|_mapping)","/.+/.+/.+/_mlt","/.+/.+/.+]"],
                "POST" : ["_search","/.+/.+/.+/_mlt"],
                "OPTIONS" : [".*"], // allow any pre-flight request
                "HEAD" : [".*"]
            },
            refresh : 10,
            port : 8124,
            host: "127.0.0.1"
        }

        
    The start() method of ElasticSearchProxy can accept callback function. It is executed once the proxy server
    is started and ready to be used.

        Example #5:
        Use callback function
        -------------------------------------------------------------

            var proxy = require('./elasticsearch-proxy').getProxy();
            proxy.start(function(){
                console.log("Proxy server is ready at http://" + proxy.getHost() +":"+ proxy.getPort());
                proxy.stop();
            });

*/

var sys = require('sys'),
    fs = require('fs'),
    http = require('http');

var ElasticSearchProxy = function(configuration) {

    var proxy;
    var customConf = {};
    var proxyConf = {
        seeds : ["localhost:9200"],
        allow : {
            "GET" : ["(_search|_status|_mapping)","/.+/.+/.+/_mlt","/.+/.+/.+]"],
            "POST" : ["_search","/.+/.+/.+/_mlt"],
            "OPTIONS" : [".*"], // allow any pre-flight request
            "HEAD" : [".*"]
        },
        refresh : 10,
        port : 8124,
        host: "127.0.0.1"
    };

    var filters = { "GET" : [], "POST" : [], "OPTIONS" : [], "PUT" : [], "DELETE" : [], "HEAD" : [] };

    // helper function for parsing configuration
    var isArray = function(object) { return (object && object["join"]) ? true : false; };
    var isObject = function(object) { return (object && typeof object === "object") ? true : false; };
    var isNumber = function(object) { return (object && typeof object === "number") ? true : false; };
    var isString = function(object) { return (object && typeof object === "string") ? true : false; };

    var loadConfiguration = function() {

        var _conf = configuration;
        if (_conf === undefined) {_conf="./proxy.json"; }

        if (isObject(_conf)) {
            customConf = _conf;
        } else if (isString(_conf)) {
            try {
                var content = fs.readFileSync(_conf,'utf8').replace('\n', '');
            } catch(err) {
                sys.debug(err);
                sys.debug("Can not load configuration from " + _conf);
                sys.debug("Using the default configuration");
                return;
            }
            customConf = JSON.parse(content);
        } else {
            throw new Error("Unexpected format of constructor argument");
        }
        merge(proxyConf, customConf);
      };

    var merge = function(target, source) {
        if (source) {
            if (isArray(source.seeds)) { target.seeds = source.seeds; };
            if (isObject(source.allow)) { target.allow = source.allow; };
            if (isNumber(source.refresh)) { target.refresh = source.refresh; };
            if (isNumber(source.port)) { target.port = source.port; };
            if (isString(source.host)) { target.host = source.host; };
        }
    };

    var precompileFilters = function() {
        for (type in filters) {
            if (proxyConf.allow[type])
                for (i=0;i<proxyConf.allow[type].length;i++) {
                    filters[type].push(new RegExp(proxyConf.allow[type][i]));
                }
        }
    };

    var testFilters = function(method, url) {
        if (method && url) {
            for (i=0;i<filters[method.toUpperCase()].length;i++) {
                if (filters[method.toUpperCase()][i].test(url)) {
                    return true;
                }
            }
        }
        return false;
    };

    var proxyRequestHandler = function (req, res) {
        if (testFilters(req.method, req.url)) {

            var d = "";

            req.on('data', function(chunk) {
                d += chunk; // chunk.length bytes chunk
            });

            req.on('end', function() {

                var es = http.createClient("9200", "localhost"); // TODO get ElasticSearch-js client
                var request = es.request(req.method, req.url);

                request.on('response', function(response) {

                    if (response.httpVersion === '1.1')
                        response.headers["Transfer-Encoding"] = "chunked";
                    res.writeHead(response.statusCode, response.headers);

                    response.on('data', function(chunk) {
                        res.write(chunk);
                    });

                    response.on('end', function() {
                        res.end();
                    });
                });
                request.write(d);
                request.end();
            });

        } else {
            res.writeHead(403, {'Content-Type': 'application/json'});
            res.end('{"error":"Request not supported by proxy"}');
        }
    };

    var init = function() {
        loadConfiguration();
        sys.log("Using configuration:");
        console.log(proxyConf);
        precompileFilters();
        proxy = http.createServer(proxyRequestHandler)
                .on("close",
                    function(errno){
                        var msg = "ElasticSearch proxy server stopped";
                        sys.log(errno ? msg + ", errno:["+errno+"]" : msg);
                    }
                );
    };

    var _start = function(callback) {
        proxy.listen(proxyConf.port, proxyConf.host, function() {
            sys.log("ElasticSearch proxy server started at http://"+proxyConf.host+":"+proxyConf.port+"/");
            if (callback && typeof callback === 'function') callback();
        });
    };

    var _stop = function() {
        proxy.close();
    };

    this.start = function(callback) { _start(callback); };
    this.stop = function() { _stop(); };
    this.getHost = function() { return proxyConf.host };
    this.getPort = function() { return proxyConf.port };

    init();
};

exports.getProxy = function(object) {
    return new ElasticSearchProxy(object);
};



