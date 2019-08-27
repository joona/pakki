const path = require('path');
const chokidar = require('chokidar');

class WatcherBuilder {
  constructor(options = {}) {
    this.prefix = options.prefix;
    this.context = options.context;
    this.watchers = [];
    this.paths = [];
  }

  add(callback, ...paths) {
    paths = paths
      .reduce((arr, x) => arr.concat(Array.isArray(x) ? x : [x]), [])
      .map(x => path.resolve(path.join(this.prefix, x)));

    this.paths = [...this.paths, ...paths];

    const watcher = chokidar.watch(paths);

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
}

module.exports = {
  watcher(context, callback) {
    const { source } = context;
    const builder = new WatcherBuilder({
      prefix: source,
      context
    });

    if(callback) {
      callback(context, { add: builder.add.call(builder) });
    }

    return builder;
  }
};
