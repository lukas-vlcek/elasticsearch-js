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
    Example of using ElasticSearch proxy server in NodeJS.
 */
var proxyFactory = require('./elasticsearch-proxy');
var http = require('http');

var getClusterStatus = function(proxy) {
    
    var proxyClient = http.createClient(proxy.getPort(), proxy.getHost());
    var request = proxyClient.request("GET", "/_status");
    
    request.on('response', function(response) {

        var data = "";

        console.log('STATUS: ' + response.statusCode);
        console.log('HEADERS: ' + JSON.stringify(response.headers));

        response.on('data', function(chunk) {
            data += chunk;
        });

        response.on('end', function() {
            console.log('RESPONSE BODY: ' + JSON.stringify(JSON.parse(data),null,'  '));
            proxy.stop();
        });
    });
    console.log("Getting cluster state");
    request.end();

};

var proxyServer = proxyFactory.getProxy();
proxyServer.start(function(){getClusterStatus(proxyServer)});
