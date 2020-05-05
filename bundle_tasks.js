const bluebird = require('bluebird');
const path = require('path');
const { buildEntry } = require('./rollup_tasks');
const { fileHash, copy } = require('./utils');

// FIXME: move all bundle tasks here

const tasks = module.exports = {
  async buildBundle(ctx, name, type, options = {}) {
    const bundleSettings = ctx.bundleSettings;
    let entryContext = { ...ctx, ...options.context || {} };

    if(options.middleware && typeof options.middleware === 'function') {
      options.middleware(entryContext, name, type, options);
    }

    console.log('[buildBundle]', name, type, options);
    const bundle = await buildEntry(entryContext, name, { type, ...options });

    if(!ctx.bundleOutputs) ctx.bundleOutputs = {};
    ctx.bundleOutputs[bundle.bundleName] = {
      fileName: bundle.outputName
    };

    if(bundleSettings.hashAlgorithm) {
      const hash = await fileHash(ctx, bundle.outputPath, bundleSettings.hashAlgorithm);
      const hashedFile = bundle.outputName.replace(name, `${name}-${hash}`);
      await copy(bundle.outputPath, path.join(ctx.dest, hashedFile));

      ctx.bundleOutputs[bundle.bundleName].hashedName = path.basename(hashedFile);
      ctx.bundleOutputs[bundle.bundleName].hash = hash;
      console.log('[buildBundle] build with hash', hash, hashedFile);
    }
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
