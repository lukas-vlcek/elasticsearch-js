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
    This demo shows how to use events module.
 */

var output, es = undefined;

$(document).ready(function() {
    output = $("#output");
    es = new ElasticSearch({debug:true});
    startCheckingNodes();
});

function something_with_nodes_has_changed(addedNodes, removedNodes) {

    var currentTime = getFormatedDate(new Date());

    if (addedNodes && addedNodes.length > 0) {
        var d = document.createElement("div");
        $(d).append("["+currentTime+"] New nodes found: ").append(addedNodes.join(", "));
        $(output).append(d);
        console.log("Added nodes: ", addedNodes);
    }
    if (removedNodes && removedNodes.length > 0) {
        var d = document.createElement("div");
        $(d).append("["+currentTime+"] Some nodes were removed: ").append(removedNodes.join(", "));
        $(output).append(d);
        console.log("Removed nodes: ", removedNodes);
    }
}

function startCheckingNodes() {

//    es.events.nodesAddedOrRemoved.internal.check(es);
    es.addEventListener("nodesAddedOrRemoved", something_with_nodes_has_changed);
}

function getFormatedDate(date) {
    var seconds = lpad(date.getSeconds());
    var minutes = lpad(date.getMinutes());
    var hours = lpad(date.getHours());
    var month = lpad(date.getMonth() + 1);
    var day = lpad(date.getDate());
    var year = date.getFullYear();
    return year+"/"+month+"/"+day+" "+hours+":"+minutes+":"+seconds;
}

function lpad(value) {
    return ( value < 10 ? "0"+value : value);
}