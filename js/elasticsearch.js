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
    this.execute("GET", "_cluster/state", settings);
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
    this.execute("GET", path, settings);
}

ElasticSearch.prototype.clusterNodesInfo = function(settings) {
    settings = this.ensure(settings)
    var path = "_cluster/nodes";
    if (settings.nodes) path += "/"+settings.nodes;
    this.execute("GET", path, settings);
}

ElasticSearch.prototype.clusterNodesStats = function(settings) {
    settings = this.ensure(settings)
    var path = "_cluster/nodes";
    if (settings.nodes) path += "/"+settings.nodes;
    path += "/stats";
    this.execute("GET", path, settings);
}

ElasticSearch.prototype.clusterNodesShutdown = function(settings) {
    settings = this.ensure(settings)
    var path = "_cluster/nodes";
    path += "/"+ (settings.nodes || "_all") + "/_shutdown";
    if (settings.delay) path += "?delay=" + settings.delay;
    this.execute("POST", path, settings);
}

ElasticSearch.prototype.clusterNodesRestart = function(settings) {
    settings = this.ensure(settings)
    var path = "_cluster/nodes";
    path += "/"+ (settings.nodes || "_all") + "/_restart";
    if (settings.delay) path += "?delay=" + settings.delay;
    this.execute("POST", path, settings);
}

/* Index Admin API */

ElasticSearch.prototype.status = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/_status";
    this.execute("GET", path, settings);
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
    this.execute("PUT", path, settings);
}

ElasticSearch.prototype.deleteIndex = function(settings) {
    settings = this.ensure(settings);
    if (!settings.index) { throw("Index name must be provided.") }
    var path = settings.index+"/";
    this.execute("DELETE", path, settings);
}

ElasticSearch.prototype.getMappings = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/";
    if (settings.types) path += settings.types + "/";
    path += "_mapping";
    this.execute("GET", path, settings);
}

ElasticSearch.prototype.flush = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/_flush";
    if (settings.refresh && settings.refresh === true) path += "?refresh=true";
    this.execute("POST", path, settings);
}

ElasticSearch.prototype.refresh = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/_refresh";
    this.execute("POST", path, settings);
}

ElasticSearch.prototype.snapshot = function(settings) {
    settings = this.ensure(settings);
    var path = (settings.indices || "_all") + "/_gateway/snapshot";
    this.execute("POST", path, settings);
}

ElasticSearch.prototype.putMapping = function(settings) {
    settings = this.ensure(settings);
    if (!settings.type) { throw("An index type must be provided."); }
    if (!settings.mapping) { throw("No mapping request data provided."); }
    var path = (settings.indices || "_all") + settings.type + "/_mapping";
    if (settings.ignore_conflicts) { path += "?ignore_conflicts=" + settings.ignore_conflicts; }
    settings.stringifyData = JSON.stringify(settings.mapping);
    this.execute("POST", path, settings);
    
}

ElasticSearch.prototype.aliases = function(settings) {
    settings = this.ensure(settings);
    if (settings.aliases) {
        settings.stringifyData = JSON.stringify(settings.aliases);
        var path = "_aliases";
        this.execute("POST", path, settings);
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
        this.execute("PUT", path, settings);
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
    this.execute("POST", path, settings);
}

/* Search API using Query DSL */

ElasticSearch.prototype.search = function(settings) {
    settings = this.ensure(settings);
    if (!settings.queryDSL) throw("queryDSL not provided");
    var path = "_search";
    if (settings.types) path = settings.types + "/" + path;
    path = (settings.indices ? settings.indices : "_all") + "/"+ path;
    settings.stringifyData = JSON.stringify(settings.queryDSL);
    this.execute("POST", path, settings);
}

ElasticSearch.prototype.count = function(settings) {
    settings = this.ensure(settings);
    if (!settings.queryDSL) throw("queryDSL not provided");
    var path = "_count";
    if (settings.types) path = settings.types + "/" + path;
    path = (settings.indices ? settings.indices : "_all") + "/"+ path;
    settings.stringifyData = JSON.stringify(settings.queryDSL);
    this.execute("POST", path, settings);
}

ElasticSearch.prototype.get = function(settings) {
    if (settings === undefined || !settings.index || !settings.type || !settings.id) {
        throw("Full path information /{index}/{type}/{id} must be provided.");
    }
    var path = [settings.index, settings.type, settings.id].join("/");
    if (settings.fields) path += "?fields="+settings.fields;
    this.execute("GET", path, settings);
}

ElasticSearch.prototype.del = function(settings) {
    if (settings === undefined || !settings.index || !settings.type || !settings.id) {
        throw("Full path information /{index}/{type}/{id} must be provided.");
    }
    var path = [settings.index, settings.type, settings.id].join("/");
    if (settings.replication) path += "?replication="+settings.replication;
    this.execute("DELETE", path, settings);
}

ElasticSearch.prototype.delByQuery = function(settings) {
    settings = this.ensure(settings);
    if (!settings.queryDSL) throw("No queryDSL provided.");
    var path = (settings.indices || "_all") + "/" + (settings.types ? settings.types + "/" : "") + "_query";
    if (settings.replication) path += "?replication="+settings.replication;
    settings.stringifyData = JSON.stringify(settings.queryDSL);
    this.execute("DELETE", path, settings);
}

ElasticSearch.prototype.index = function(settings) {
    if (settings === undefined || !settings.index || !settings.type) {
        throw("Both the index and type names must be provided.");
    }
    if (!settings.document) throw("No JSON document provided.");
    settings.stringifyData = JSON.stringify(settings.document);
    var path;
    var method;
    if (settings.id) {
        path = [settings.index, settings.type, settings.id].join("/");
        if (settings.op_type && settings.op_type === "create") settings.path += "/_create";
        method = "PUT";
    } else {
        // automatic ID generation
        path = [settings.index, settings.type].join("/") + "/";
        method = "POST";
    }
    var params = [];
    if (settings.replication) params.push("replication="+settings.replication);
    if (settings.timeout) params.push("timeout="+settings.timeout);
    if (params.length > 0) path += "?" + params.join("&");
    this.execute(method, path, settings);
}

ElasticSearch.prototype.bulk = function(settings) {
    if (settings === undefined || !settings.bulkData) { throw("No bulk data provided."); }
    settings.stringifyData = JSON.stringify(settings.bulkData);
    this.execute("POST", "_bulk", settings);
}

/*
    Allows for low-level adhoc custom requests.
    
    params:
        method:     http method (eg "GET", "POST", ...)
        path:       eg "_search" or "_all/_cluster/state" etc...
        data:       either string or JSON request data
        callback:   [optional] function to be called once the ajax is finished
*/

ElasticSearch.prototype.request = function(method, path, data, callback) {
    var settings = {};
    if (typeof data === "string") {settings.stringifyData = data}
    else {settings.stringifyData = JSON.stringify(data);}
    if (callback && typeof callback === "function") {settings.callback = callback;}
    this.execute(method, path, settings);
}

/* Internal helper methods */

ElasticSearch.prototype.ensure = function(obj) {
    return obj || {};
}

ElasticSearch.prototype.execute = function (method, path, options) {
    options = this.ensure(options);
    var url = "http://" + this.defaults.host + ":" + this.defaults.port + "/" + path;
    var callback = options.callback || this.defaults.callback;
    options.method = method;
//    this.log(options.method + ": " + url);
    ElasticSearch.prototype.executeInternal.call(this, url, options, callback);
}


/*
if (typeof export === 'object') {
    exports.esclient = ElasticSearch;
}
*/