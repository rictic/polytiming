(function() {
  'use strict';

  let measuredElements = new Set();
  let measuredMethods = new Set();
  let configuredMethods = window.location.search.slice(1).split('&')
      .map(function(part) {
        return part.split('=');
      }).reduce(function(l, r) {
        if (r[0] === 'instrumentPolymer') {
          return l.concat(r[1].split(','));
        }
        return l;
      }, []);
  let AuthenticPolymer;
  let AuthenticBase;
  let AuthenticTemplatizer;

  Object.defineProperty(window, 'Polymer', {
    get: function() {
      return AuthenticPolymer;
    },

    set: function(Polymer) {
      AuthenticPolymer = Polymer;
      Object.defineProperty(Polymer, 'Base', {
        get: function() {
          return AuthenticBase;
        },

        set: function(Base) {
          AuthenticBase = Base;
        }
      });

      Object.defineProperty(Polymer, 'Templatizer', {
        get: function() {
          return AuthenticTemplatizer;
        },

        set: function(Templatizer) {
          AuthenticTemplatizer = Templatizer;
          instrumentLifecycle(AuthenticBase, configuredMethods);
        }
      });
    }
  });

  function measuredMethod(name, work) {
    measuredMethods.add(name);
    return function() {
      let element = this.is || this.tagName;
      let elementName = `${element}-${name}`;
      let startMark = `${elementName}-start`;
      let endMark = `${elementName}-end`;
      let result;

      measuredElements.add(element);

      window.performance.mark(startMark);
      result = work.apply(this, arguments);
      window.performance.mark(endMark);
      window.performance.measure(elementName, startMark, endMark);
      return result;
    };
  }

  function instrumentLifecycle(proto, methods) {
    methods.forEach(function(method) {
      proto[method] = measuredMethod(method, proto[method]);
    });
  }

  function statsForElementMethod(element, method) {
    let measures = window.performance.getEntriesByName(`${element}-${method}`);
    let count = measures.length;
    let sum = measures.reduce(function(sum, measure) {
      return sum + measure.duration;
    }, 0);
    let average = sum ? sum / count : 0;

    return { count, average, sum };
  }

  function statsForMethod(method) {
    let count = 0;
    let sum = 0;
    let average = 0;

    measuredMethods.forEach(function(_method) {
      if (method === _method) {
        measuredElements.forEach(function(element) {
          let stats = statsForElementMethod(element, method)
          sum += stats.sum;
          count += stats.count;
        });
      };
    });

    average = count > 0 ? sum / count : average;

    return { count, average, sum };
  }

  window.console.polymerTimingCsv = function() {
    let header = 'element';

    measuredMethods.forEach(function(method) {
      header = `${header},${method} #,${method} avg. ms,${method} total`;
    });

    let rows = header;

    measuredElements.forEach(function(element) {
      let row = element;

      measuredMethods.forEach(function(method) {
        let stats = statsForElementMethod(element, method);

        Object.keys(stats).forEach(function(stat) {
          row = `${row},${stats[stat]}`;
        });
      });

      rows = `${rows}\n${row}`;
    });

    console.log(rows);
  };

  window.console.polymerTiming = function() {
    let elementData = {};

    measuredElements.forEach(function(element) {
      let methodData = {};

      measuredMethods.forEach(function(method) {
        let stats = statsForElementMethod(element, method);

        methodData[`${method} #`] = stats.count;
        methodData[`${method} avg. ms`] = stats.average;
        methodData[`${method} total`] = stats.sum;
      });

      elementData[element] = methodData;
    });

    let totals = {};

    measuredMethods.forEach(function(method) {
      totals[method] = statsForMethod(method);
    });

    console.table(totals);
    console.table(elementData);
  }
})();
