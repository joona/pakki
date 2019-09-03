const bluebird = require('bluebird');
const { buildEntry } = require('./rollup_tasks');

// FIXME: move all bundle tasks here

const tasks = module.exports = {
  buildBundle(ctx, name, type, options = {}) {
    let entryContext = { ...ctx, ...options.context || {} };

    if(options.middleware && typeof options.middleware === 'function') {
      options.middleware(entryContext, name, type, options);
    }

    console.log('[buildBundle]', name, type, options);
    return buildEntry(entryContext, name, { type, ...options });
  },

  buildBundles(ctx) {
    const { bundles } = ctx.bundleSettings;

    return bluebird.map(bundles, bundle => {
      const { types, name, enabled, options, plugins } = bundle;
      if(enabled !== true) {
        return Promise.resolve();
      }

      return bluebird.map(types, type => {
        if(process.env[`DISABLE_${type.toUpperCase()}_BUNDLE`]) {
          return Promise.resolve();
        }

        console.log('[buildBundle]', name, type);
        return tasks.buildBundle(ctx, name, type, { plugins, ...options });
      }, { concurrency: 2 });
    });
  }
};
