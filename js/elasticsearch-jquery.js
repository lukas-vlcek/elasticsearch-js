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

ElasticSearch.prototype.getClient = function() {
    return jQuery;
}

ElasticSearch.prototype.log = function(message, error) {
    if (this.defaults.debug && typeof console === 'object') {
        console.log('[elasticsearch-js] ' + (error ? 'ERROR: ' : ''), message);
    }
}

ElasticSearch.prototype.executeInternal = function(path, options, callback) {
    var request = {
        type: options.method.toUpperCase(),
        url: path,
        data: options.stringifyData,
        processData: false,
        dataType: "json"
        ,success: function(data, statusText, xhr) {
            callback(data, xhr);
        }
        ,error: function(xhr, message, error) {
            callback(message, xhr, error);
        }
    };
    this.client.ajax(request);
}

ElasticSearch.prototype.mixin = $.extend