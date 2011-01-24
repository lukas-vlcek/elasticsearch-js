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

ElasticSearch.prototype.events = {
    nodesAddedOrRemoved : {
        refreshInterval : 3000,
        timer : undefined,
        internal : {
            listeners : [],
            state : {
                nodesId:[]
            },
            check: function(es){
                var _this = this;
                var test = function(data, xhr) {
                    if (data && data.nodes) {

                        var _actualNodesId = [];
                        var addedNodes = [];
                        var removedNodes = [];

                        // check for added nodes first
                        for (var nodeId in data.nodes) {
                            _actualNodesId.push(nodeId);
                            var idx = _this.state.nodesId.indexOf(nodeId);
                            if (idx == -1) addedNodes.push(nodeId);
                        }
                        
                        // check for removed nodes
                        for (var i = 0; i < _this.state.nodesId.length; i++) {
                            var nodeId = _this.state.nodesId[i];
                            var idx = _actualNodesId.indexOf(nodeId);
                            if (idx == -1) removedNodes.push(nodeId);
                        }

                        if (addedNodes.length > 0 || removedNodes.length > 0) {
                            _this.state.nodesId = _actualNodesId.slice(0);
                            // call listeners
                            for (var l = 0; l < _this.listeners.length; l++) {
                                _this.listeners[l].apply(null,[addedNodes.slice(0), removedNodes.slice(0)]);
                            }
                        }
                    } else {
                        es.log("no nodes data found in response");
                    }
                };

                es.adminClusterState({
                    filter_metadata : true,
                    filter_routing_table : true,
                    callback : test
                });
            }
        }
    }
    //
}

ElasticSearch.prototype.addEventListener = function(event, customCheckFunction) {
    if (this.events[event] != undefined) {
        this.events[event].internal.listeners.push(customCheckFunction);
        if (this.events[event].timer == undefined) {
            var _event = this.events[event];
            var _this = this;
            _event.timer = setInterval( function(){_event.internal.check(_this)}, _event.refreshInterval);
            this.log("New event ["+event+"] was registered");
        }
    } else {
        throw("["+event + "] is not known event handler.");
    }
}

/* Internal helper methods */
// http://stackoverflow.com/questions/1068834/object-comparison-in-javascript
/*
ElasticSearch.prototype.events.countProps = function(obj) {
    var count = 0;
    for (k in obj) {
        if (obj.hasOwnProperty(k)) {
            count++;
        }
    }
    return count;
};

ElasticSearch.prototype.events.objectEquals = function(v1, v2) {

    if (typeof(v1) !== typeof(v2)) {
        return false;
    }
//    if (typeof(v1) === "function") {
//        return v1.toString() === v2.toString();
//    }
    if (v1 instanceof Object && v2 instanceof Object) {

        if (this.countProps(v1) !== this.countProps(v2)) {
            return false;
        }
        var r = true;
        for (k in v1) {
            r = this.objectEquals(v1[k], v2[k]);
            if (!r) {
                return false;
            }
        }
        return true;
    } else {
        return v1 === v2;
    }
}
*/