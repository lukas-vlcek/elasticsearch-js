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
    $("#start").bind("click",function(){demo()});
});

function demo() {

    var output = $("#output");
    output.empty();

    // If your browser supports console then you should not see any logging messages in it.
    var es = new ElasticSearch();
    es.log("By default logging is turned off");

    // If you browser supports console then you should see logging messages in it now.
    es = new ElasticSearch({
        debug: true,
        callback : function(data, xhr) { es.log(data); output.append("<p>"+JSON.stringify(data, null, '  '))+"</p>"}
    });

    es.log("Test logging message");

    es.clusterState();
    es.clusterHealth({indices:["java-user","dev"], timeout:"30s"});

    es.search({indices:["_all"], types:["mail"], queryDSL:{ size: 1, from: 0, query: { match_all: {}} }})
    es.count({queryDSL:{ match_all: {}} })
};
