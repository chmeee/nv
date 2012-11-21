var Treemap = Backbone.Model.extend({
  initialize: function() {
    // respond to app-level events
    this.get('datasource').on('dataset updated', this.updateData, this);

    this.set('sizeOption', 'cvss');

    this.on('change:sizeOption', this.updateData, this);

    // TODO change in filterOptions should update data
    this.on('change:filterOptions', this.updateData, this);

    // respond to app filter change
    this.get('app').on('histogramClick', function(msg){

      // TODO use this info to construct a filter
      if(msg.state === "off"){
        console.log('removing filters');
        updateFilter('remove');
      } else if(msg.chart === "cvss"){
        console.log('adding cvss filter');
        updateFilter('cvss', msg.label+0.0, msg.label+1.01);
      } else if(msg.chart === "vuln type"){
        console.log('adding vuln type filter');
        updateFilter('vulntype', msg.label);
      } else if(msg.chart === "top holes"){
        console.log('adding top holes filter');
        updateFilter('vulnid', msg.label);
      } else if(msg.chart === "top notes"){
        console.log('adding top notes filter');
        updateFilter('vulnid', msg.label);
      }

    });

    var that = this;
    var updateFilter = function updateFilter(attr, value, valueEnd){
      var filterOptions   = that.get('filterOptions');

      if(attr === 'remove'){
        filterOptions.filters = null;
      } else if(valueEnd){
        filterOptions.filters = [
          { attribute:attr, rangeMin:value, rangeMax: valueEnd }
        ];
      } else {
        filterOptions.filters = [
          { attribute:attr, exact:value }
        ];
      }

      that.set('filterOptions', filterOptions);
      that.updateData();
    };
  },

  updateData: function(){
    var filterOptions   = this.get('filterOptions')
      , attribute       = filterOptions.attribute
      , hierarchy       = this.get('hierarchy').get('data');

    var rawData = this.get('datasource').getData(filterOptions);

    // check if our filters end up excluding everything
    if(rawData.length < 1){
      console.log('current filter yields no data, try another');
      return;
    }

    // TODO get hierarchy here

    var root = applyhierarchy(hierarchy);

    function applyhierarchy(hierarchy){
      var nest = d3.nest();

      // loop hierarchy and apply based on conditions
      _.each(hierarchy, function(h){
        nest.key(function(d){
          if(h.useData){
            if(h.prefix)
              return h.prefix+d[h.target];
            else
              return d[h.target];
          } else {
            return h.target;
          }
        });
      });

      nest.sortKeys(d3.ascending);
      return nest.entries(rawData);
    }

//      .key(function(d) {return 'groups';})
//      .key(function(d) {return d.group;})
//      .key(function(d) {return d.ip;})
//      .key(function(d) {return d.state;})
//      .key(function(d) {return ":"+d.port;})
//      .key(function(d) {return "id:"+d.vulnid;})
//      .sortkeys(d3.ascending)
//      .entries(rawdata); 
//    }
//        } else {
//      root=d3.nest()
//      .key(function(d) {return 'groups';})
//      .key(function(d) {return d.group;})
//      .key(function(d) {return d.ip;})
//      .key(function(d) {return ":"+d.port;})
//      .key(function(d) {return "id:"+d.vulnid;})
//      .sortkeys(d3.ascending)
//      .entries(rawdata); 
//    }

    // free the root from its original array
    root = root[0];

    this.accumulate(root);

    // set data to the lengths of the data
    this.set('data', root);  
  }, 

  // aggregate the values for internal nodes. This is normally done by the
  // treemap layout, but not here because of our custom implementation.
  // 
  // todo: can we generalize the accumulate functions for multiple attributes?
  accumulate: function(d) {
    var app = this;

    function accumulateCVSS(d){
      return d.values ? 
        d.cvss = d.values.reduce(function(p, v) { return Math.max(p, accumulateCVSS(v)); }, 0) :
        d.cvss;
    }

    function accumulateState(d){
      return d.values ?
        d.state = d.values.reduce(function(p, v) { return accumulateState(v); }, 0) :
        d.state;
    }

    function accumulateFixedCounts(d){
      return d.values ?
        d.fixedCount = d.values.reduce(function(p, v) { return p + accumulateFixedCounts(v); }, 0) :
        d.state === 'fixed' ? 1 : 0;
    }
    
    function accumulateOpenCounts(d){
      return d.values ?
        d.openCount = d.values.reduce(function(p, v) { return p + accumulateOpenCounts(v); }, 0) :
        d.state === 'open' ? 1 : 0;
    }

    function accumulateNewCounts(d){
      return d.values ?
        d.newCount = d.values.reduce(function(p, v) { return p + accumulateNewCounts(v); }, 0) :
        d.state === 'new' ? 1 : 0;
    }

    d.cvss = accumulateCVSS(d);
    if(isChangeVis){
      d.state = accumulateState(d);
      d.fixedCount = accumulateFixedCounts(d);
      d.openCount = accumulateOpenCounts(d);
      d.newCount = accumulateNewCounts(d);
    }

    return d.values ?
      d.value = d.values.reduce(function(p, v) { return p + app.accumulate(v); }, 0) :
      d[this.get('sizeOption')];
  }
});
