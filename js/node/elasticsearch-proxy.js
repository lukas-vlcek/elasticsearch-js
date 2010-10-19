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

    It provides the following functions:

    - It can expose only part of the REST API (can be configure by rules using regular expressions). By default it
      is configured to expose only *safe* operations thus clients can not modify, delete and add indices nor they
      can shutdown and restart cluster nodes.

    - It can manipulate incoming request from client and outgoing response from Elastic Search cluster by custom
      functions. This can be useful in situations when it is needed to check or modify data in client request or
      strip out sensitive information from response. For example it may be required to ensure that incoming
      "size" parameter in client query will not exceed specific value (do not let clients pull too much data in
      one request). Or on the other hand it may be necessary to remove all IP addresses from response or remove
      specific parts of response at all (like "nodes" section, etc).

    - It can pull list of all active http enabled nodes from cluster (using settings seeds and refresh values) and
      round-robin http requests among them.

    When it comes to restricting the REST API the proxy server allows to set rules for any of the following
    request types: GET, POST, PUT, DELETE, HEAD and OPTIONS
    TRACE and CONNECT requests are not supported (as they are not supported by Elastic Search as well).

    Note: OPTIONS requests can be used by some clients for pre-flight requests. If no OPTIONS requests allowed
    then some clients may not work properly.

    ElasticSearchProxy constructor accepts the following parameters:
    ElasticSearchProxy(configuration, preRequest, postRequest)

    preRequest = function(request):
    is a handler function which is passed client request as a parameter. It is called before the request is handed
    to the cluster.

    postRequest = function(request, response, responseData):
    is a handler function which is passed two parameters: client request, cluster response and response data. This
    function is expected to return new responseData.

    for details about configuration parameter see below:

    1) Configuration is a JSON object. Then relevant values from this object will replace default settings:


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


    2) Passing "string" object as configuration. In this case the string is assumed to represent path to the file
       with json configuration. Relevant information from this file will replace default settings.


        Example #3:
        Start proxy with json file based configuration
        -------------------------------------------------------------

            var proxy = require('./elasticsearch-proxy').getProxy("./elastic_search_proxy.json").start();


        Assumes there is a file ./elastic_search_proxy.json with json configuration.
        If the file can not be found or is not accessible then the default settings are used instead.


    3) Configuration is undefined. That is the same as using string value of "./proxy.json".
       In this case it tries to load configuration from ./proxy.json file and merge it with default settings,
       if not successful then it simply uses the default settings. 

        Example #4:
        Start proxy with the default settings
        -------------------------------------------------------------

            var proxy = require('./elasticsearch-proxy').getProxy().start();


        The following are the default settings:

        {
            seeds : ["localhost:9200"],
            refresh : 1000,
            allow : {
                "GET" : ["(_search|_status|_mapping|_count)","/.+/.+/.+/_mlt","/.+/.+/.+]"],
                "POST" : ["_search|_count","/.+/.+/.+/_mlt"],
                "OPTIONS" : [".*"], // allow any pre-flight request
                "HEAD" : [".*"]
            },
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

    There are exported two public methods (kind of factory methods) that can help creating new proxy server:

    getProxy(object, preRequest, postRequest)
    getProxy(preRequest, postRequest)

    Especially the second one can be useful if you need to create proxy with default settings but provide custom
    reguest handlers.

*/

var sys = require('sys'),
    fs = require('fs'),
    http = require('http');

var ElasticSearchProxy = function(configuration, preRequest, postRequest) {

    var proxy, httpClient, intervalId;
    var customConf = {};
    var proxyConf = {
        seeds : ["localhost:9200"],
        refresh : 1000,
        allow : {
            "GET" : ["(_search|_status|_mapping|_count)","/.+/.+/.+/_mlt","/.+/.+/.+]"],
            "POST" : ["_search|_count","/.+/.+/.+/_mlt"],
            "OPTIONS" : [".*"], // allow any pre-flight request
            "HEAD" : [".*"]
        },
        port : 8124,
        host: "127.0.0.1",
        preRequest: undefined,
        postRequest: undefined
    };

    var filters = { "GET" : [], "POST" : [], "OPTIONS" : [], "PUT" : [], "DELETE" : [], "HEAD" : [] };

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
        if (isFunction(preRequest)) { proxyConf.preRequest = preRequest; };
        if (isFunction(postRequest)) { proxyConf.postRequest = postRequest; };
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

            if (isFunction(proxyConf.preRequest)) {
                proxyConf.preRequest(req);
            }

            var d = "";

            req.on('data', function(chunk) {
                d += chunk; // chunk.length bytes chunk
            });

            req.on('end', function() {

                var es = httpClient.getClient();
                var request = es.request(req.method, req.url);

                request.on('response', function(response) {

                    if (response.httpVersion === '1.1')
                        response.headers["Transfer-Encoding"] = "chunked";
                    res.writeHead(response.statusCode, response.headers);


                    if (isFunction(proxyConf.postRequest)) {

                        var o = "";
                        
                        response.on('data', function(chunk) {
                            o += chunk;
                        });

                        response.on('end', function() {
                            res.write(proxyConf.postRequest(req, response, o));
                            res.end();
                        });

                    } else {

                        response.on('data', function(chunk) {
                            res.write(chunk);
                        });

                        response.on('end', function() {
                            res.end();
                        });
                    }
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
        httpClient = new HttpClient(proxyConf.seeds);
    };

    var _start = function(callback) {
        proxy.listen(proxyConf.port, proxyConf.host, function() {
            sys.log("ElasticSearch proxy server started at http://"+proxyConf.host+":"+proxyConf.port+"/");
            httpClient.updateAllNodes(callback);
            intervalId = setInterval( function(){httpClient.updateAllNodes()}, proxyConf.refresh);
        });
    };

    var _stop = function() {
        clearInterval(intervalId);
        proxy.close();
    };

    this.start = function(callback) { _start(callback); };
    this.stop = function() { _stop(); };
    this.getHost = function() { return proxyConf.host; };
    this.getPort = function() { return proxyConf.port; };

    init();
};

/*
    HttpClient is a helper object. It keeps list af all active http enabled nodes
    and can it provide http clients for these nodes.
 */
var HttpClient = function(seeds) {

    var seeds = seeds.slice();
    var allNodes = {};
    var allNodesCount = 0;
    var actualNodePos = 0;
    var clusterName = undefined;
    var httpAddressPattern = new RegExp("inet\\[(\\S*)/(\\S+):(\\d+)\\]");

    var extractNodeInfo = function(node) {

        var host, port;

        var ha = node.http_address.toString();
        if (httpAddressPattern.test(ha)) {
            var match = ha.match(httpAddressPattern);
            if (match.length == 3) {
                host = match[1];
                port = match[2];
            } else if (match.length == 4) {
                host = (match[1].trim().length > 0 ? match[1] : match[2]);
                port = match[3];
            }
        }

        return { nodeName: node.name, address: { host: host, port: port}};
    }

    // Collect http_addresses of all nodes in the cluster via seed nodes in parallel.
    // Once all responses from seed nodes are collected then replace allNodes.
    var _updateAllNodes = function(callback) {

        var _allNodes = {};
        var _processedSeeds = 0;
        var _numberOfSeeds = seeds.length;

        for (var i = 0; i < _numberOfSeeds; i++) {

            var s = seeds[i].split(":");
            if (s && s.length == 2) {

                var c = http.createClient(s[1],s[0]);

                c.addListener('error', function (err) {
                    sys.log("Error using seed host: "+s[0]+":"+s[1]);
                    console.log(err);
                    _processedSeeds++;
                    if (_processedSeeds === _numberOfSeeds) {
                        if (callback && typeof callback === "function") callback();
                    }
                });

                var request = c.request("GET", "/_cluster/nodes");
                request.on('response', function(response) {

                    var o = "";

                    response.on('data', function(chunk) { o += chunk; });

                    response.on('end', function() {
                        var clusterNodes = JSON.parse(o);
                        if (!clusterName) {clusterName = clusterNodes.cluster_name};
                        // If cluster name does not match then skip node response.
                        if (clusterName === clusterNodes.cluster_name) {
                            for (nid in clusterNodes.nodes) {
                                if (clusterNodes.nodes[nid].http_address || clusterNodes.nodes[nid].httpAddress) {
                                    var nodeInfo = extractNodeInfo(clusterNodes.nodes[nid]);
                                    // safety check: if http address parsing fails then empty object is returned
                                    if (nodeInfo && nodeInfo.nodeName) {
                                        _allNodes[nid] = nodeInfo;
                                    }
                                }
                            }
                        }
                        _processedSeeds++;
                        if (_processedSeeds === _numberOfSeeds) {
                            allNodes = mergeNodes(allNodes, _allNodes);
                            allNodesCount = 0;
                            for (n in allNodes) { if (allNodes.hasOwnProperty(n)) allNodesCount++; }
//                            console.log("updated all nodes: " + new Date());
//                            console.log(allNodes);
                            if (callback && typeof callback === "function") callback();
                        }
                    });
                });

                request.end();

            } else {
                _processedSeeds++;
            }
        }
    }

    var mergeNodes = function(oldNodes, newNodes) {
        for (n in oldNodes) {
            if (newNodes[n] === undefined) {delete oldNodes[n];}
        }
        for (n in newNodes) {
            if (oldNodes[n] === undefined) {oldNodes[n] = newNodes[n];}
        }
        return oldNodes;
    }

    var _getClient = function() {

        if (actualNodePos >= allNodesCount) {actualNodePos = 0;}
        if (actualNodePos < allNodesCount) {
            var tp = 0;
            for (n in allNodes) {
                if (tp === actualNodePos) {
                    actualNodePos++;
                    if (allNodes[n].client === undefined) {
                        var client = http.createClient(allNodes[n].address.port, allNodes[n].address.host);
                        // whatever error, remove node from other use
                        client.addListener('error', function (err) {
                            console.log('error', err);
                            allNodesCount--;
                            delete allNodes[n];
                        });

                        allNodes[n].client = client;
                        return client;
                    } else {
                        return allNodes[n].client;
                    }
                }
                tp++;
            }
        }
    };

    var _getClusterName = function() { return clusterName };

    this.updateAllNodes = function(callback){_updateAllNodes(callback)};
    this.getClusterName = function(){return _getClusterName()};
    this.getClient = function(){return _getClient()};

}

// internal helper functions
var isArray = function(object) { return (object && object["join"]) ? true : false; };
var isObject = function(object) { return (object && typeof object === "object") ? true : false; };
var isNumber = function(object) { return (object && typeof object === "number") ? true : false; };
var isString = function(object) { return (object && typeof object === "string") ? true : false; };
var isFunction = function(object) { return (object && typeof object === "function") ? true : false; };

/*
    Get proxy server instance via factory methods.
 */
if (typeof module !== 'undefined' && "exports" in module) {
    
    exports.getProxy = function(object, preRequest, postRequest) {
        var proxy = new ElasticSearchProxy(object, preRequest, postRequest);
        return proxy;
    };

    exports.getProxy = function(preRequest, postRequest) {
        var proxy = new ElasticSearchProxy(undefined, preRequest, postRequest);
        return proxy;
    };
}




