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
        es,timer, form, button, host, port, interval, jvmUptime, osUptime,
    // charts
        chjvmthreads, chjvmmemheap, chjvmmemnonheap,
        choscpu, chosswap = undefined;
var connected = false;
var firstPoint = true;
var winsize = -1;
var charts = [];

$(document).ready(function() {
    form = $("#form");
    button = $("#go");
    host = $("#host");
    port = $("#port");
    interval = $("#interval");
    jvmUptime = $("#jvm-uptime");
    osUptime = $("#os-uptime");

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
            ;
        }
    });

    $(interval).change(function() {
        if (connected) {
            setupInterval($(this).attr('value'));
        }
    });

    charts = [
        // jvm charts
        chjvmthreads = buildChJvmThreads('jvm-threads'),
        chjvmmemheap = buildChJvmMem('jvm-mem-heap', 'Mem Heap'),
        chjvmmemnonheap = buildChJvmMem('jvm-mem-non-heap', 'Mem Non-Heap'),
        // os charts
        choscpu = buildChOsCpu("os-cpu"),
        chosswap = buildChOsSwap("os-swap",'Swap'),
    ]

    $("#winsize").change(function() {
        winsize = $(this).attr('value');
        shrinkCharts(charts);
        redrawCharts(charts);
    });
});

var setupInterval = function(delay) {
    clearInterval(timer);
    timer = setInterval("es.adminClusterNodeStats({callback:function(data, xhr){stats(data)}})", delay);
}

var connect = function connect(hostVal, portVal) {
    es = new ElasticSearch({host:hostVal, port:portVal});
    es.adminClusterHealth(
    {callback:
            function(data, xhr) {
                //                console.log(data);
                setupInterval($("#interval option:selected").val());
                connected = true;
                $(host).attr("disabled", "true");
                $(port).attr("disabled", "true");
                $(button).val("STOP");
            },
        level:"shard"});
}

var fadeAll = function() {
    $(".fading").fadeTo("slow",0.4,function(){
        var temp = $(document.createElement("span")).attr("class","disconnected").append(" (disconnected)").hide();
        $(this).append(temp);
        $(temp).fadeTo("slow",1);
    });
}

var stats = function stats(data) {
    var firstnode = undefined;
    for (node in data.nodes) {
        if (!firstnode) firstnode = data.nodes[node];
    }
    if (firstnode) {
//        console.log(firstnode);

        var jvm = firstnode.jvm;
        var os = firstnode.os;

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

            chosswap.series[0].addPoint([os.timestamp - 1, null], false, false);
            chosswap.series[1].addPoint([os.timestamp - 1, null], false, false);
        }

        // populate charts

        $(jvmUptime).empty().text(jvm.uptime).fadeTo("fast",1);

        chjvmthreads.series[0].addPoint([jvm.timestamp, (jvm.threads ? jvm.threads.count : null)], false, false);
        chjvmthreads.series[1].addPoint([jvm.timestamp, (jvm.threads ? jvm.threads.peak_count : null)], false, false);

        chjvmmemheap.series[0].addPoint([jvm.timestamp, (jvm.mem ? jvm.mem.heap_committed_in_bytes : null)], false, false);
        chjvmmemheap.series[1].addPoint([jvm.timestamp, (jvm.mem ? jvm.mem.heap_used_in_bytes : null)], false, false);

        chjvmmemnonheap.series[0].addPoint([jvm.timestamp, (jvm.mem ? jvm.mem.non_heap_committed_in_bytes : null)], false, false);
        chjvmmemnonheap.series[1].addPoint([jvm.timestamp, (jvm.mem ? jvm.mem.non_heap_used_in_bytes : null)], false, false);

        shrinkCharts([chjvmthreads, chjvmmemheap, chjvmmemnonheap], jvm.timestamp - winsize);

        $(osUptime).empty().text(os.uptime).fadeTo("fast",1);

        choscpu.series[0].addPoint([os.timestamp, (os.cpu ? os.cpu.idle : null)], false, false);
        choscpu.series[1].addPoint([os.timestamp, (os.cpu ? os.cpu.sys : null)], false, false);
        choscpu.series[2].addPoint([os.timestamp, (os.cpu ? os.cpu.user : null)], false, false);

        chosswap.series[0].addPoint([os.timestamp, (os.swap ? os.swap.free_in_bytes : null)], false, false);
        chosswap.series[1].addPoint([os.timestamp, (os.swap ? os.swap.used_in_bytes : null)], false, false);

        shrinkCharts([choscpu, chosswap],os.timestamp - winsize);

        // redraw all charts
        redrawCharts(charts);

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
            { name: 'Free' },
            { name: 'Used' }
        ]
    });
}