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

var output = undefined;

$(document).ready(function() {
    doSomething();
    output = $("#output");
});

function something_with_nodes_was_changed(addedNodes, removedNodes) {

    var currentTime = new Date();
    var seconds = currentTime.getSeconds();
    var minutes = currentTime.getMinutes();
    var hours = currentTime.getHours();
    var month = currentTime.getMonth() + 1;
    var day = currentTime.getDate();
    var year = currentTime.getFullYear();

    if (addedNodes && addedNodes.length > 0) {
        var d = document.createElement("div");
        $(d).append("["+month+"/"+day+"/"+year+" "+hours+":"+minutes+":"+seconds+"] New nodes found: ").append(addedNodes.join(", "));
        $(output).append(d);
        console.log("Added nodes: ", addedNodes);
    }
    if (removedNodes && removedNodes.length > 0) {
        var d = document.createElement("div");
        $(d).append("["+month+"/"+day+"/"+year+" "+hours+":"+minutes+":"+seconds+"] Some nodes were removed: ").append(removedNodes.join(", "));
        $(output).append(d);
        console.log("Removed nodes: ", removedNodes);
    }
}

function doSomething() {
    var es = new ElasticSearch({debug:true});

//    es.events.nodesAddedOrRemoved.internal.check(es);
    es.addEventListener("nodesAddedOrRemoved", something_with_nodes_was_changed);
}