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

var // html elements
        es, timer, form, button, host, port, interval, indicesHeadline, jvmUptime, osUptime, clusterNameSpan, nodesSpan,
        jvmGcTable, osCpuTable, transportTable, networkTable, jvmTable,
        fieldEvictions, fieldCacheSize, filterCacheSize, storeSize,
    // variables
        clusterName, selectedNodeName,
    // charts
        chjvmthreads, chjvmmemheap, chjvmmemnonheap,
        choscpu, chosmem, chosswap = undefined;
var connected = false;
var firstPoint = true;
var winsize = -1;
var charts = [];
var nodes = {};

$(document).ready(function() {
    
    // locate html elements and keep pointers
    form = $("#form");
    button = $("#go");
    host = $("#host");
    port = $("#port");
    interval = $("#interval");
    indicesHeadline = $("#indices-headline");
    jvmUptime = $("#jvm-uptime");
    osUptime = $("#os-uptime");
    clusterNameSpan = $("#cluster-name");
    nodesSpan = $("#nodes");
    jvmGcTable = $("#jvm-gc-table");
    osCpuTable = $("#os-cpu-table");
    transportTable = $("#transport-table");
    networkTable = $("#network-table");
    jvmTable = $("#jvm-table");
    fieldEvictions = $("#field-cache-evictions");
    fieldCacheSize = $("#field-cache-size");
    filterCacheSize = $("#filter-cache-size");
    storeSize = $("#store-size");

    // initialize variables
    clusterName = clusterNameSpan.text();

    // bind GUI actions
    $(form).bind('submit', function() {
        return false;
    });

    $(button).bind('click', function() {
        if ($(this).val() == "STOP") {
            clearTimeout(timer);
            es = undefined;
            connected = false;
            $(host).removeAttr("disabled");
            $(port).removeAttr("disabled");
            $(button).val("GO!");
            firstPoint = true;
            fadeAll();
            // disconected ...
        } else {
            var hostVal = $("#host").val();
            var portVal = $("#port").val();
            if (!hostVal || !portVal || hostVal.trim().length == 0 || portVal.trim().length == 0) {
                alert("Fill in host and port data!");
            } else {
                connect(hostVal, portVal);
            }
        }
    });

    $(interval).change(function() {
        if (connected) {
            setupInterval($(this).attr('value'));
        }
    });

    $("#winsize").change(function() {
        winsize = $(this).attr('value');
        shrinkCharts(charts);
        redrawCharts(charts);
    });
    winsize = $("#winsize option:selected").val();

    // build all charts
    charts = [
        // jvm charts
        chjvmthreads = buildChJvmThreads('jvm-threads'),
        chjvmmemheap = buildChJvmMem('jvm-mem-heap', 'Mem Heap'),
        chjvmmemnonheap = buildChJvmMem('jvm-mem-non-heap', 'Mem Non-Heap'),
        // os charts
        choscpu = buildChOsCpu("os-cpu"),
        chosmem = buildChOsMem("os-mem"),
        chosswap = buildChOsSwap("os-swap",'Swap')
    ]

    // allow toggle for detail sections
    $(".section").each(function(idx, val){
        $(val).bind('click',function(){
            // navigate to "section-detail"
            $($(this).parent().parent().parent().children()[1]).toggle("fast");
        });
    });

    fadeAll();

});

var setupInterval = function(delay) {
    clearInterval(timer);
    var _function = function(){es.adminClusterNodeStats({callback:function(data, xhr){console.log(data);stats(data)}})};
    _function(); // execute the _function right now before the first delay interval elapses
    timer = setInterval(_function, delay);
}

var connect = function connect(hostVal, portVal) {
    es = new ElasticSearch({host:hostVal, port:portVal});
    es.adminClusterHealth({
        level:"shard",
        callback:
            function(data, xhr) {
//                console.log(data);
                setupInterval($("#interval option:selected").val());
                connected = true;
                $(host).attr("disabled", "true");
                $(port).attr("disabled", "true");
                $(button).val("STOP");
            }
    });
}

var fadeAll = function() {
    $(".fading").fadeTo("slow",0.4,function(){
        var temp = $(document.createElement("span")).attr("class","disconnected").append(" (disconnected)").hide();
        $(this).append(temp);
        $(temp).fadeTo("slow",1);
    });
}

// Update cluster name and Nodes if there has been any change since last run.
var updateClusterAndNodeNames = function(data){
    if (data) {
        if(data.cluster_name && clusterName != data.cluster_name) {
            clusterName = data.cluster_name;
            clusterNameSpan.text(clusterName);
        }
        if (data.nodes) {
            var nodesChanged = false;
            for (var node in nodes) {
                // node removed?
                if (!data.nodes[node]) {
                    if (selectedNodeName && nodes[node] == selectedNodeName) {
                        selectedNodeName = undefined;
                        cleanCharts(charts);
                        // TODO stop timer ?
                    }
                    delete nodes[node];
                    nodesChanged = true;
                }
            }
            for (var node in data.nodes) {
                // new node?
                if (!nodes[node]) {
                    nodes[node] = data.nodes[node].name;
                    nodesChanged = true;
                }
            }
            if (nodesChanged) {
                //redraw nodes
                var _nodes = [];
                for (var n in nodes) _nodes.push(nodes[n]);
                _nodes.sort(); // sort node names alphabetically
                $(nodesSpan).empty();
                if (selectedNodeName == undefined && _nodes.length > 0) {
                    // make first available node selected
                    selectedNodeName = _nodes[0];
                    refreshNodeInfo(selectedNodeName);
                }
                $.each(_nodes, function(index, value) {
                    var node =  $(document.createElement("span")).attr("class","node").append(value);
                    if (value == selectedNodeName) { $(node).addClass("selectedNode"); }
                    $(node).click(
                        function(){
                            // new node selected by user
                            if (selectedNodeName != $(this).text()) {
                                selectedNodeName = $(this).text();
                                refreshNodeInfo(selectedNodeName);
                                $.each(nodesSpan.children(),
                                    function(id, s){
                                      if (selectedNodeName == $(s).text()) $(s).addClass("selectedNode")
                                      else $(s).removeClass("selectedNode");
                                    }
                                );
                                cleanCharts(charts);
                                setupInterval($("#interval option:selected").val());
                            }
                        }
                    );
                    $(nodesSpan).append(node);
                });
            }
        }
    }
}

var getSelectedNodeId = function(name) {
    for (node in nodes) {
        if (nodes[node] == name) return node;
    }
    return undefined;
}

var refreshNodeInfo = function(nodeName) {
    var id = getSelectedNodeId(nodeName);
    if (id) {
    es.adminClusterNodeInfo({
        nodes : [id],
        callback: function(data, xhr) {
            if (data && data.nodes)
            updateStaticNodeData(data.nodes[id]);
        }
    });
    }
}

var updateStaticNodeData = function(data) {
//    console.log(data);
    if (data) {
        if (data.os) {
            if (data.os.cpu) {
                var cpu = data.os.cpu;
                osCpuTable.empty().append(
                    newTR().append( newTD().append("Vendor:"), newTD().append(cpu.vendor) ),
                    newTR().append( newTD().append("Model:"), newTD().append(cpu.model) ),
                    newTR().append( newTD().append("MHz:"), newTD().append(cpu.mhz) ),
                    newTR().append( newTD().append("Cores:"), newTD().append(cpu.total_cores) ),
                    newTR().append( newTD().append("Cache:"), newTD().append(cpu.cache_size) )
                );
            }
        }
        if (data.transport) {
            var t = data.transport;
            transportTable.empty().append(
                newTR().append( newTD().append("Bound address:"), newTD().append(t.bound_address) ),
                newTR().append( newTD().append("Publish address:"), newTD().append(t.publish_address) )
            );
        }
        networkTable.empty().append(
            newTR().append( newTD().append("Http address:"), newTD().append(data.http_address) ),
            newTR().append( newTD().append("Transport address:"), newTD().append(data.transport_address) )
        );
        if (data.jvm) {
            var jvm = data.jvm;
            jvmTable.empty().append(
                newTR().append( newTD().append("Vendor:"), newTD().append(jvm.vm_vendor) ),
                newTR().append( newTD().append("Name:"), newTD().append(jvm.vm_name) ),
                newTR().append( newTD().append("Version:"), newTD().append(jvm.vm_version) ),
                newTR().append( newTD().append("PID:"), newTD().append(jvm.pid) )
            );
        }
    }
}

var stats = function(data) {

//    console.log(data);
    updateClusterAndNodeNames(data);

    var selectedNode = undefined;
    for (node in data.nodes) {
        if (!selectedNode && data.nodes[node].name == selectedNodeName) selectedNode = data.nodes[node];
    }
    if (selectedNode) {
//        console.log(selectedNode);

        var indices = selectedNode.indices;
        var jvm = selectedNode.jvm;
        var os = selectedNode.os;

        // insert blank space into charts
        if (firstPoint) {

            firstPoint = false;

            chjvmthreads.series[0].addPoint([jvm.timestamp - 1, null], false, false);
            chjvmthreads.series[1].addPoint([jvm.timestamp - 1, null], false, false);

            chjvmmemheap.series[0].addPoint([jvm.timestamp - 1, null], false, false);
            chjvmmemheap.series[1].addPoint([jvm.timestamp - 1, null], false, false);

            chjvmmemnonheap.series[0].addPoint([jvm.timestamp - 1, null], false, false);
            chjvmmemnonheap.series[1].addPoint([jvm.timestamp - 1, null], false, false);

            choscpu.series[0].addPoint([os.timestamp - 1, null], false, false);
            choscpu.series[1].addPoint([os.timestamp - 1, null], false, false);
            choscpu.series[2].addPoint([os.timestamp - 1, null], false, false);

            chosmem.series[0].addPoint([os.timestamp - 1, null], false, false);
            chosmem.series[1].addPoint([os.timestamp - 1, null], false, false);
            chosmem.series[2].addPoint([os.timestamp - 1, null], false, false);
                                                                                         
            chosswap.series[0].addPoint([os.timestamp - 1, null], false, false);
            chosswap.series[1].addPoint([os.timestamp - 1, null], false, false);
        }

        // update section headers
        $(indicesHeadline).empty().fadeTo("fast",1);
        $(jvmUptime).empty().text(jvm.uptime).fadeTo("fast",1);
        $(osUptime).empty().text(os.uptime).fadeTo("fast",1);

        // update stats that are not charts
        updateIndices(indices);
        updateJvmGC(jvm.gc);

        // populate charts
        chjvmthreads.series[0].addPoint([jvm.timestamp, (jvm.threads ? jvm.threads.count : null)], false, false);
        chjvmthreads.series[1].addPoint([jvm.timestamp, (jvm.threads ? jvm.threads.peak_count : null)], false, false);

        chjvmmemheap.series[0].addPoint([jvm.timestamp, (jvm.mem ? jvm.mem.heap_committed_in_bytes : null)], false, false);
        chjvmmemheap.series[1].addPoint([jvm.timestamp, (jvm.mem ? jvm.mem.heap_used_in_bytes : null)], false, false);

        chjvmmemnonheap.series[0].addPoint([jvm.timestamp, (jvm.mem ? jvm.mem.non_heap_committed_in_bytes : null)], false, false);
        chjvmmemnonheap.series[1].addPoint([jvm.timestamp, (jvm.mem ? jvm.mem.non_heap_used_in_bytes : null)], false, false);

        shrinkCharts([chjvmthreads, chjvmmemheap, chjvmmemnonheap], jvm.timestamp - winsize);

        choscpu.series[0].addPoint([os.timestamp, (os.cpu ? os.cpu.idle : null)], false, false);
        choscpu.series[1].addPoint([os.timestamp, (os.cpu ? os.cpu.sys : null)], false, false);
        choscpu.series[2].addPoint([os.timestamp, (os.cpu ? os.cpu.user : null)], false, false);

        chosmem.series[0].addPoint([os.timestamp, (os.mem.actual_free_in_bytes && os.mem.actual_used_in_bytes ? os.mem.actual_free_in_bytes + os.mem.actual_used_in_bytes : null)], false, false);
        chosmem.series[1].addPoint([os.timestamp, (os.mem.used_in_bytes ? os.mem.used_in_bytes : null)], false, false);
        chosmem.series[2].addPoint([os.timestamp, (os.mem.actual_used_in_bytes ? os.mem.actual_used_in_bytes : null)], false, false);

        chosswap.series[0].addPoint([os.timestamp, (os.swap ? os.swap.free_in_bytes : null)], false, false);
        chosswap.series[1].addPoint([os.timestamp, (os.swap ? os.swap.used_in_bytes : null)], false, false);

        shrinkCharts([choscpu, chosmem, chosswap],os.timestamp - winsize);

        // redraw all charts
        redrawCharts(charts);

    }
}

var updateIndices = function(indices) {
//    console.log(indices);
    // response format changed in 0.16
    // see https://github.com/elasticsearch/elasticsearch/issues/746
    if ( indices.cache ) {
        fieldEvictions.text(indices.cache.field_evictions);
        fieldCacheSize.text(indices.cache.field_size);
        filterCacheSize.text(indices.cache.filter_size);
        storeSize.text(indices.size + " (" + indices.size_in_bytes + "), ")
                .append("Documents: ",indices.docs.num_docs,", ")
                .append("Merges current/total: ",indices.merges.current, "/", indices.merges.total, " (took ", indices.merges.total_time,")");
    } else {
        fieldEvictions.text(indices.field_cache_evictions);
        fieldCacheSize.text(indices.field_cache_size);
        filterCacheSize.text(indices.filter_cache_size);
        storeSize.text(indices.store_size + " (" + indices.store_size_in_bytes + ")");
    }
}

var updateJvmGC = function(gc) {
    if (gc) {
        var tr = newTR().append(
            newTD().append("Total:"),
            newTD().append(gc.collection_count),
            newTD().append(gc.collection_time)
        );
        jvmGcTable.empty().append(tr).append(newTR("collspan",4)); // extra empty row (can be css-styled in the future)
        for (collType in gc.collectors) {
            tr = newTR().append(
                newTD().append(collType,":"),
                newTD().append(gc.collectors[collType].collection_count),
                newTD().append(gc.collectors[collType].collection_time)
            );
            jvmGcTable.append(tr);
        }
    }
}

var newTR = function(attr, val) {
    var tr = $(document.createElement("tr"));
    if (attr && val) tr.attr(attr,val);
    return tr;
}

var newTD = function(attr, val) {
    var td = $(document.createElement("td"));
    if (attr && val) td.attr(attr,val);
    return td;
}

var cleanCharts = function(chartsArray) {
    for (var i = 0; i < chartsArray.length; i++) {
        for (var s = 0; s < chartsArray[i].series.length; s++) {
            var series = chartsArray[i].series[s];
            series.setData([],true);
        }
    }
}

var shrinkCharts = function(chartsArray, threshold) {
    if (threshold && winsize > 0) {
        for (var i = 0; i < chartsArray.length; i++) {
            for (var s = 0; s < chartsArray[i].series.length; s++) {
                var series = chartsArray[i].series[s];
                for (var d = 0; d < series.data.length; d++) {
                    var data = series.data[d];
                    while (data.category && data.category < threshold) data.remove(false);
                }
            }
        }
    }
}

var redrawCharts = function(chartsArray) {
    for (var i = 0; i < chartsArray.length; i++) {
        chartsArray[i].redraw();
    }
}

var buildChJvmThreads = function(renderTo) {
    return new Highcharts.Chart({
        chart: {
            renderTo: renderTo,
            defaultSeriesType: 'line',
            marginRight: 10
        },
        title: {
            text: 'Threads'
        },
        credits: {
            enabled: false
        },
        xAxis: {
            type: 'datetime',
            tickPixelInterval: 150
        },
        yAxis: {
            title: {
                text: 'Count'
            },
            plotLines: [
                {
                    value: 0,
                    width: 1,
                    color: '#808080'
                }
            ]
        },
        tooltip: {
            formatter: function() {
                return '<b>' + this.series.name + '</b><br/>' +
                        Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '<br/>' +
                        Highcharts.numberFormat(this.y, 2);
            }
        },
        legend: {
            enabled: true
        },
        exporting: {
            enabled: false
        },
        series: [
            { name: 'count' },
            { name: 'peak count' }
        ]
    });
}

var buildChJvmMem = function(renderTo, title) {
    return new Highcharts.Chart({
        chart: {
            renderTo: renderTo,
            defaultSeriesType: 'area'
        },
        title: {
            text: title
        },
        credits: {
            enabled: false
        },
        xAxis: {
            type: 'datetime',
            tickPixelInterval: 150
        },
        yAxis: {
            title: {
                text: 'MegaBytes'
            },
            labels: {
                formatter: function() {
                    var res = this.value / 1024000;
                    res = Math.round(res*Math.pow(10,2))/Math.pow(10,2);
                    return res;
                }
            }
        },
        tooltip: {
            formatter: function() {
                return '' +
                        Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + ': ' +
                        Highcharts.numberFormat(this.y / 1024000, 1) + 'mb';
            }
        },
        plotOptions: {
            area: {
                //            stacking: 'normal',
                lineColor: '#666666',
                lineWidth: 1,
                marker: {
                    enabled: false,
                    symbol: 'circle',
                    radius: 2,
                    states: {
                        hover: {
                            enabled: true
                        }
                    }
                }
                //            marker: {
                //               lineWidth: 1,
                //               lineColor: '#666666'
                //            }
            }
        },
        series: [
            { name: 'Heap Allocated' },
            { name: 'Heap Used' }
        ]
    });
}

var buildChOsCpu = function(renderTo) {
    return new Highcharts.Chart({
      chart: {
         renderTo: renderTo,
         defaultSeriesType: 'area',
         marginRight: 10
      },
      title: {
         text: 'CPU(%)'
      },
        credits: {
            enabled: false
        },
      xAxis: {
          type: 'datetime',
          tickPixelInterval: 150
      },
      yAxis: {
         title: {
            text: 'Percent'
         }
      },
      tooltip: {
         formatter: function() {
                   return ''+
                Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) +': '+
                Highcharts.numberFormat(this.percentage, 1) +'%';
         }
      },
      plotOptions: {
         area: {
            stacking: 'percent',
            lineColor: '#ffffff',
            lineWidth: 1,
            marker: {
               lineWidth: 1,
               lineColor: '#ffffff'
            }
         }
      },
      series: [
          { name: 'Idle' },
          { name: 'Sys' },
          { name: 'User' }
      ]
   });
}

var buildChOsSwap = function(renderTo, title) {
    return new Highcharts.Chart({
        chart: {
            renderTo: renderTo,
            defaultSeriesType: 'area'
        },
        title: {
            text: title
        },
        credits: {
            enabled: false
        },
        xAxis: {
            type: 'datetime',
            tickPixelInterval: 150
        },
        yAxis: {
            title: {
                text: 'MegaBytes'
            },
            labels: {
                formatter: function() {
                    var res = this.value / 1024000;
                    res = Math.round(res*Math.pow(10,2))/Math.pow(10,2);
                    return res;
                }
            }
        },
        tooltip: {
            formatter: function() {
                return '' +
                        Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + ': ' +
                        Highcharts.numberFormat(this.y / 1024000, 1) + 'mb';
            }
        },
        plotOptions: {
            area: {
                stacking: 'normal',
                lineColor: '#666666',
                lineWidth: 1,
                marker: {
                    enabled: false,
                    symbol: 'circle',
                    radius: 2,
                    states: {
                        hover: {
                            enabled: true
                        }
                    }
                }
                //            marker: {
                //               lineWidth: 1,
                //               lineColor: '#666666'
                //            }
            }
        },
        series: [
            { name: 'Free' },
            { name: 'Used' }
        ]
    });
}

var buildChOsMem = function(renderTo) {
    return new Highcharts.Chart({
        chart: {
            renderTo: renderTo,
            defaultSeriesType: 'area'
        },
        title: {
            text: "Mem"
        },
        credits: {
            enabled: false
        },
        xAxis: {
            type: 'datetime',
            tickPixelInterval: 150
        },
        yAxis: {
            title: {
                text: 'MegaBytes'
            },
            labels: {
                formatter: function() {
                    var res = this.value / 1024000;
                    res = Math.round(res*Math.pow(10,2))/Math.pow(10,2);
                    return res;
                }
            }
        },
        tooltip: {
            formatter: function() {
                return '' +
                        Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + ': ' +
                        Highcharts.numberFormat(this.y / 1024000, 1) + 'mb';
            }
        },
        plotOptions: {
            area: {
                //            stacking: 'normal',
                lineColor: '#666666',
                lineWidth: 1,
                marker: {
                    enabled: false,
                    symbol: 'circle',
                    radius: 2,
                    states: {
                        hover: {
                            enabled: true
                        }
                    }
                }
                //            marker: {
                //               lineWidth: 1,
                //               lineColor: '#666666'
                //            }
            }
        },
        series: [
            { name: 'Total Mem' },
            { name: 'Used' },
            { name: 'Actual Used' }
        ]
    });
}