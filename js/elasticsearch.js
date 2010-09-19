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
    number_of_shards : 3,
    number_of_replicas : 2,
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
    settings.method = "GET";
    this.execute(settings);
}

ElasticSearch.prototype.clusterHealth = function(settings) {
    settings = this.ensure(settings);
    var path = "_cluster/health";
    var params = [];
    if (settings.indices) path += "/"+settings.indices;
    if (settings.level) params.push("level="+settings.level);
    if (settings.wait_for_status) params.push("wait_for_status="+settings.wait_for_status);
    if (settings.wait_for_relocating_shards) params.push("wait_for_relocating_shards="+settings.wait_for_relocating_shards);
    if (settings.wait_for_nodes) params.push("wait_for_nodes="+settings.wait_for_nodes);
    if (settings.timeout) params.push("timeout="+settings.timeout);
    if (params.length > 0) path += "?" + params.join("&");
    settings.path = path;
    settings.method = "GET";
    this.execute(settings);
}

ElasticSearch.prototype.clusterNodesInfo = function(settings) {
    settings = this.ensure(settings)
    var path = "_cluster/nodes";
    if (settings.nodes) path += "/"+settings.nodes;
    settings.path = path;
    settings.method = "GET";
    this.execute(settings);
}

ElasticSearch.prototype.clusterNodesStats = function(settings) {
    settings = this.ensure(settings)
    var path = "_cluster/nodes";
    if (settings.nodes) path += "/"+settings.nodes;
    path += "/stats";
    settings.path = path;
    settings.method = "GET";
    this.execute(settings);
}

ElasticSearch.prototype.clusterNodesShutdown = function(settings) {
    settings = this.ensure(settings)
    var path = "_cluster/nodes";
    path += "/"+ (settings.nodes || "_all") + "/_shutdown";
    if (settings.delay) path += "?delay=" + settings.delay;
    settings.path = path;
    settings.method = "POST";
    this.execute(settings);
}

ElasticSearch.prototype.clusterNodesRestart = function(settings) {
    settings = this.ensure(settings)
    var path = "_cluster/nodes";
    path += "/"+ (settings.nodes || "_all") + "/_restart";
    if (settings.delay) path += "?delay=" + settings.delay;
    settings.path = path;
    settings.method = "POST";
    this.execute(settings);
}

/* Index Admin API */

ElasticSearch.prototype.indicesStatus = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/_status";
    settings.path = path;
    settings.method = "GET";
    this.execute(settings);
}

ElasticSearch.prototype.createIndex = function(settings) {
    settings = this.ensure(settings);
    // TODO rise error if index name not set
    var path = settings.index+"/";
    this.log(path)
    var index = {
        number_of_shards : settings.number_of_shards || this.defaults.number_of_shards,
        number_of_replicas : settings.number_of_replicas || this.defaults.number_of_replicas
    };
    settings.stringifyData = JSON.stringify({"index":index});
    settings.path = path;
    settings.method = "PUT";
    this.execute(settings);
}

ElasticSearch.prototype.deleteIndex = function(settings) {
    settings = this.ensure(settings);
    // TODO rise error if index name not set
    var path = settings.index+"/";
    settings.path = path;
    settings.method = "DELETE";
    this.execute(settings);
}

ElasticSearch.prototype.getMappings = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/";
    if (settings.types) path += settings.types + "/";
    path += "_mapping";
    settings.path = path;
    settings.method = "GET";
    this.execute(settings);
}

ElasticSearch.prototype.flushIndices = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/_flush";
    if (settings.refresh && settings.refresh == "true") path += "?refresh=true";
    settings.path = path;
    settings.method = "POST";
    this.execute(settings);
}

ElasticSearch.prototype.refreshIndices = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/_refresh";
    settings.path = path;
    settings.method = "POST";
    this.execute(settings);
}

ElasticSearch.prototype.indicesSnapshot = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/_gateway/snapshot";
    settings.path = path;
    settings.method = "POST";
    this.execute(settings);
}

//ElasticSearch.prototype.putMappings = function(settings) {
//}
//
//ElasticSearch.prototype.aliases = function(settings) {
//}

ElasticSearch.prototype.updateIndicesSettings = function(settings) {
    settings = this.ensure(settings);
    if (settings.number_of_replicas) {
        var path = (settings.indices || "_all") + "/_settings";
        var index = {
            number_of_replicas : settings.number_of_replicas
        };
        settings.stringifyData = JSON.stringify({"index":index});
        settings.path = path;
        settings.method = "PUT";
        this.execute(settings);
    }
}

ElasticSearch.prototype.optimizeIndices = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/_optimize";
    params = []
    if (settings.max_num_segments) params.push("max_num_segments="+settings.max_num_segments);
    if (settings.only_expunge_deletes) params.push("only_expunge_deletes="+settings.only_expunge_deletes);
    if (settings.refresh) params.push("refresh="+settings.refresh);
    if (settings.flush) params.push("flush="+settings.flush);
    if (params.length > 0) path += "?"+params.join("&");
    settings.path = path;
    settings.method = "POST";
    this.execute(settings);
}

/* Search API using Query DSL */

ElasticSearch.prototype.search = function(settings) {
    settings = this.ensure(settings);
    var path = "_search";
    if (settings.types) path = settings.types + "/" + path;
    path = (settings.indices ? settings.indices : "_all") + "/"+ path;
    settings.path = path;
    settings.method = "POST";
    if (settings.queryDSL) settings.stringifyData = JSON.stringify(settings.queryDSL);
    this.execute(settings);
}

ElasticSearch.prototype.count = function(settings) {
    settings = this.ensure(settings);
    var path = "_count";
    if (settings.types) path = settings.types + "/" + path;
    path = (settings.indices ? settings.indices : "_all") + "/"+ path;
    settings.path = path;
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