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

$(document).ready(function()
{
    populateMethods();
    output = $("#output");
});

var methods = [];
methods.push(["log","Logging message"]);
methods.push(["search",{indices:["_all"], types:["mail"], queryDSL:{ size: 1, from: 0, query: { match_all: {}} }}]);
methods.push(["count",{queryDSL:{ match_all: {}} }]);
methods.push(["clusterState",{}]);
methods.push(["clusterHealth",{indices:["java-user","dev"], timeout:"30s"}]);
methods.push(["clusterNodesInfo",{}]);
methods.push(["clusterNodesStats",{}]);

function populateMethods() {
    var methodList = $("#methods");
    $.each(methods, function(idx, method){
        var i = li();
        var t = input(JSON.stringify(method[1]));
        var b = button("Run");
        b.bind("click",function(){
            var p = {};
            if (t.val()) p = JSON.parse(t.val());
            getES()[method[0]](p);
        });
        $(i).append(method[0],t,b);
        methodList.append(i);
    });
}

function getES() {
    var es = new ElasticSearch(
        {
            debug: $("#logging").attr("checked"),
            host: $("#host").val(),
            port: $("#port").val()
        });
    es.defaults.callback = function(data, xhr) { es.log(data); output.empty().append("<p>"+JSON.stringify(data, null, '  '))+"</p>"};
    return es;
}

function li() {return document.createElement("li");}
function input(value) {return $(document.createElement("input")).attr("type","text").attr("size","70").attr("value",value);}
function button(value) {return $(document.createElement("input")).attr("type","button").attr("value",value);}
