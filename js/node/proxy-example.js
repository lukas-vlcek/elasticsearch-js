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

var afterStart = function(proxy) {
    console.log("Proxy server is ready at http://" + proxy.getHost() +":"+ proxy.getPort());
    proxy.stop();
};

var proxyServer = proxyFactory.getProxy();
proxyServer.start(function(){afterStart(proxyServer)});
