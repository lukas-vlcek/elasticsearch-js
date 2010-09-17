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

var ElasticSearch = function(settings) {
    this.defaults = ElasticSearch.prototype.mixin({}, this.defaults, settings);
    this.client = ElasticSearch.prototype.getClient();
}

ElasticSearch.prototype.defaults = {
    method: 'GET',
    debug: false,
    host: "localhost",
    port: 9200,
    callback: function(response, meta) {
        // TODO By default the "debug" is set to false.
        if (response) ElasticSearch.prototype.log(response)
    }
}

/* Cluster Admin API */

ElasticSearch.prototype.clusterState = function(settings) {
    (settings = this.ensure(settings)).path = "_cluster/state";
    this.execute(settings);
}

ElasticSearch.prototype.clusterHealth = function(settings) {
    var path = "_cluster/health";
    var params = [];
    if (settings.indices) path += "/"+settings.indices;
    if (settings.level) params.push("level="+settings.level);
    if (settings.wait_for_status) params.push("wait_for_status="+settings.wait_for_status);
    if (settings.wait_for_relocating_shards) params.push("wait_for_relocating_shards="+settings.wait_for_relocating_shards);
    if (settings.wait_for_nodes) params.push("wait_for_nodes="+settings.wait_for_nodes);
    if (settings.timeout) params.push("timeout="+settings.timeout);
    if (params.length > 0) path += "?" + params.join("&");
    (settings = this.ensure(settings)).path = path;
    this.execute(settings);
}

ElasticSearch.prototype.clusterNodesInfo = function(settings) {
    var path = "_cluster/nodes";
    if (settings.nodes) path += "/"+settings.nodes;
    (settings = this.ensure(settings)).path = path;
    this.execute(settings);
}

ElasticSearch.prototype.clusterNodesStats = function(settings) {
    var path = "_cluster/nodes";
    if (settings.nodes) path += "/"+settings.nodes;
    path += "/stats";
    (settings = this.ensure(settings)).path = path;
    this.execute(settings);
}

ElasticSearch.prototype.clusterNodesShutdown = function(settings) {
    var path = "_cluster/nodes";
    path += "/"+ (settings.nodes || "_all") + "/_shutdown";
    if (settings.delay) path += "?delay=" + settings.delay;
    (settings = this.ensure(settings)).path = path;
    settings.method = "POST";
    this.execute(settings);
}

ElasticSearch.prototype.clusterNodesRestart = function(settings) {
    var path = "_cluster/nodes";
    path += "/"+ (settings.nodes || "_all") + "/_restart";
    if (settings.delay) path += "?delay=" + settings.delay;
    (settings = this.ensure(settings)).path = path;
    settings.method = "POST";
    this.execute(settings);
}

/* Search API using Query DSL */

ElasticSearch.prototype.search = function(settings) {
    var path = "_search";
    if (settings.types) path = settings.types + "/" + path;
    path = (settings.indices ? settings.indices : "_all") + "/"+ path;
    (settings = this.ensure(settings)).path = path;
    settings.method = "POST";
    if (settings.queryDSL) settings.stringifyData = JSON.stringify(settings.queryDSL);
    this.execute(settings);
}

ElasticSearch.prototype.count = function(settings) {
    var path = "_count";
    if (settings.types) path = settings.types + "/" + path;
    path = (settings.indices ? settings.indices : "_all") + "/"+ path;
    (settings = this.ensure(settings)).path = path;
    settings.method = "POST";
    if (settings.queryDSL) settings.stringifyData = JSON.stringify(settings.queryDSL);
    this.execute(settings);
}

/* Internal helper methods */

ElasticSearch.prototype.ensure = function(obj) {
    return obj || {};
}

ElasticSearch.prototype.execute = function (options) {
    options = this.ensure(options);
    var url = "http://" + (options.host || this.defaults.host) + ":" + (options.port || this.defaults.port) + "/" + options.path;
    var callback = options.callback || this.defaults.callback;
    options.method = options.method || this.defaults.method;
    this.log(options.method + ": " + url);
    ElasticSearch.prototype.executeInternal.call(this, url, options, callback);
}