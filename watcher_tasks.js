const path = require('path');
const chokidar = require('chokidar');

class WatcherBuilder {
  constructor(context, options = {}) {
    this.prefix = context.source;
    this.watchers = [];
    this.paths = [];
    this.context = context;

    this.defaultOptions = {
      ignoreInitial: true,
      ...options
    };
  }

  add(callback, ...paths) {
    let options = {};
    if(typeof paths[paths.length - 1] === 'object') {
      options = paths.pop();
    }

    paths = paths
      .reduce((arr, x) => arr.concat(Array.isArray(x) ? x : [x]), [])
      .map(x => path.resolve(path.join(this.prefix, x)));

    this.paths = [...this.paths, ...paths];

    const args = { ...this.defaultOptions, ...(options || {}) };
    const watcher = chokidar.watch(paths, args);

    let cb = (action, path) => {
      console.log('[watcher] change detected', action, path);
      callback(this.context);
    };

    watcher
      .on('change', cb.bind(null, 'change'))
      //.on('add', cb.bind(null, 'add'))
      .on('remove', cb.bind(null, 'remove'));

    this.watchers.push(watcher);
    return this;
  }

  watch() {
    process.nextTick(() => {
      console.log('[watcher] paths', this.paths);
      console.log('[watcher] watching for changes...');
    });
  }
}

module.exports = {
  watcher(context, callback, options = {}) {
    const builder = new WatcherBuilder(context, options);

    if(callback) {
      callback(context, { add: builder.add.call(builder) });
    }

    return builder;
  }
};
