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
    this.seedServers = [this.defaults.host+":"+this.defaults.port];
    this.activeServers = [];
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

ElasticSearch.prototype.status = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/_status";
    settings.path = path;
    settings.method = "GET";
    this.execute(settings);
}

ElasticSearch.prototype.createIndex = function(settings) {
    settings = this.ensure(settings);
    if (!settings.index) { throw("Index name must be provided.") }
    var path = settings.index+"/";
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
    if (!settings.index) { throw("Index name must be provided.") }
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

ElasticSearch.prototype.flush = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/_flush";
    if (settings.refresh && settings.refresh === true) path += "?refresh=true";
    settings.path = path;
    settings.method = "POST";
    this.execute(settings);
}

ElasticSearch.prototype.refresh = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/_refresh";
    settings.path = path;
    settings.method = "POST";
    this.execute(settings);
}

ElasticSearch.prototype.snapshot = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/_gateway/snapshot";
    settings.path = path;
    settings.method = "POST";
    this.execute(settings);
}

ElasticSearch.prototype.putMapping = function(settings) {
    settings = this.ensure(settings);
    if (!settings.type) { throw("An index type must be provided."); }
    if (!settings.mapping) { throw("No mapping request data provided."); }
    var path = (settings.indices || "_all") + settings.type + "/_mapping";
    if (settings.ignore_conflicts) { path += "?ignore_conflicts="settings.ignore_conflicts; }
    settings.path = path;
    settings.stringifyData = JSON.stringify(settings.mapping);
    settings.method = "POST";
    this.execute(settings);
    
}

ElasticSearch.prototype.aliases = function(settings) {
    settings = this.ensure(settings);
    if (settings.aliases) {
        settings.stringifyData = JSON.stringify(settings.aliases);
        var path = "_aliases";
        settings.path = path;
        settings.method = "POST";
        this.execute(settings);
    } else {
        throw("No aliases request data provided.");
    }
}

ElasticSearch.prototype.updateSettings = function(settings) {
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

ElasticSearch.prototype.optimize = function(settings) {
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
    if (!settings.queryDSL) throw("queryDSL not provided");
    var path = "_search";
    if (settings.types) path = settings.types + "/" + path;
    path = (settings.indices ? settings.indices : "_all") + "/"+ path;
    settings.path = path;
    settings.method = "POST";
    settings.stringifyData = JSON.stringify(settings.queryDSL);
    this.execute(settings);
}

ElasticSearch.prototype.count = function(settings) {
    settings = this.ensure(settings);
    if (!settings.queryDSL) throw("queryDSL not provided");
    var path = "_count";
    if (settings.types) path = settings.types + "/" + path;
    path = (settings.indices ? settings.indices : "_all") + "/"+ path;
    settings.path = path;
    settings.method = "POST";
    settings.stringifyData = JSON.stringify(settings.queryDSL);
    this.execute(settings);
}

ElasticSearch.prototype.get = function(settings) {
    if (settings === undefined || !settings.index || !settings.type || !settings.id) {
        throw("Full path information /{index}/{type}/{id} must be provided.");
    }
    settings.path = [settings.index, settings.type, settings.id].join("/");
    if (settings.fields) settings.path += "?fields="+settings.fields;
    settings.method = "GET";
    this.execute(settings);
}

ElasticSearch.prototype.del = function(settings) {
    if (settings === undefined || !settings.index || !settings.type || !settings.id) {
        throw("Full path information /{index}/{type}/{id} must be provided.");
    }
    settings.path = [settings.index, settings.type, settings.id].join("/");
    if (settings.replication) settings.path += "?replication="+settings.replication;
    settings.method = "DELETE";
    this.execute(settings);
}

ElasticSearch.prototype.delByQuery = function(settings) {
    settings = this.ensure(settings);
    if (!settings.queryDSL) throw("queryDSL not provided");
    settings.path = (settings.indices || "_all") + "/" + (settings.types ? settings.types + "/" : "") + "_query";
    if (settings.replication) settings.path += "?replication="+settings.replication;
    settings.stringifyData = JSON.stringify(settings.queryDSL);
    settings.method = "DELETE";
    this.execute(settings);
}

ElasticSearch.prototype.index = function(settings) {
    if (settings === undefined || !settings.index || !settings.type) {
        throw("Both the index and type names must be provided.");
    }
    if (!settings.document) throw("No JSON document provided.");
    settings.stringifyData = JSON.stringify(settings.document);
    if (settings.id) {
        settings.path = [settings.index, settings.type, settings.id].join("/");
        if (settings.op_type && settings.op_type === "create") settings.path += "/_create";
        settings.method = "PUT";
    } else {
        // automatic ID generation
        settings.path = [settings.index, settings.type].join("/") + "/";
        settings.method = "POST";
    }
    var params = [];
    if (settings.replication) params.push("replication="+settings.replication);
    if (settings.timeout) params.push("timeout="+settings.timeout);
    if (params.length > 0) settings.path += "?" + params.join("&");
    this.execute(settings);
}

ElasticSearch.prototype.bulk = function(settings) {
    if (settings === undefined || !settings.bulkData) {
        throw("No bulk data provided.");
    }
    settings.stringifyData = JSON.stringify(settings.bulkData);
    settings.path = "_bulk";
    settings.method = "POST";
    this.execute(settings);
}

/* Internal helper methods */

ElasticSearch.prototype.ensure = function(obj) {
    return obj || {};
}

ElasticSearch.prototype.execute = function (options) {
    options = this.ensure(options);
    var url = "http://" + (this.seedServers[Math.floor(Math.random()*this.seedServers.length)]) + "/" + options.path;
    var callback = options.callback || this.defaults.callback;
    options.method = options.method || this.defaults.method;
    this.log(options.method + ": " + url);
    ElasticSearch.prototype.executeInternal.call(this, url, options, callback);
}


/*
if (typeof export === 'object') {
    exports.esclient = ElasticSearch;
}
*/