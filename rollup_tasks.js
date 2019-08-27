const path = require('path');

const rollup = require('rollup').rollup;
//const buble = require('rollup-plugin-buble');
const nodeResolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const json = require('rollup-plugin-json');
const babel = require('rollup-plugin-babel');
const replace = require('rollup-plugin-replace');
const postcss = require('rollup-plugin-postcss');

const { lookup } = require('./utils');

const configCache = {};

function injectFromLocale(options = {}) {
  const dict = options.dictionary || {};
  const re = /__\(\s*(['"`])(.+?)\1\s*\)/g;
  const stringRe = /\$\(\s*(.+?)\s*\)/g;

  function stringReplacer(match, key) {
    const parts = key.split('.');
    const val = lookup(dict, ...parts);
    if(val !== undefined && val !== null) return val;
    return `!!MISSING: ${key}!!`;
  }

  function replacer(match, p0, p1) {
    const parts = p1.split('.');
    const val = lookup(dict, ...parts);
    if(val !== undefined && val !== null) {
      return JSON.stringify(val);
    }

    console.log('parts:', parts, dict);
    throw new Error('translation not found:' + p1);
  }

  return {
    name: 'i18n',
    transform: (source) => {
      return source.replace(re, replacer.bind(this))
        .replace(stringRe, stringReplacer.bind(this));
    },
  };
}

const defaultPlugins = [
  {
    name: 'postcss',
    module: postcss,
    options: {
      plugins: []
    }
  },
  {
    name: 'nodeResolve',
    module: nodeResolve,
    options: {
      mainFields: ['module', 'main']
    }
  },
  {
    name: 'json',
    module: json,
    options: {}
  },
  {
    name: 'injectFromLocale',
    module: injectFromLocale,
    factory(ctx) {
      return {
        dictionary: { ...(ctx.localizations || {}), ...ctx.bundleInjections }
      };
    }
  },
  {
    name: 'replace',
    module: replace,
    options: {
      values: {},
      exclude: 'node_modules/**',
      delimiters: ['<@', '@>']
    },

    factory(ctx) {
      return {
        values: ctx.bundleInjections || {}
      };
    }
  },
  {
    name: 'commonjs',
    module: commonjs,
    options: {
      include: ['node_modules/**'],
      sourceMap: false,
      extensions: ['.js']
    }
  }
];

function findPlugin(plugins, plugin) {
  const { name } = plugin;
  return plugins.find(x => x.name = name);
}

const tasks = module.exports = {
  createPluginConfigForBundle(ctx, name, plugins = [], options = {}) {
    let plugs = [...defaultPlugins];
    console.time(`create-plugin-config: ${name}`);

    for (var i = 0, len = defaultPlugins.length; i < len; i++) {
      const plugin = defaultPlugins[i];
      let pluginOptions = { ...plugin.options };

      if(plugin.factory) {
        Object.assign(pluginOptions, plugin.factory(ctx, options));
      }

      plugs[i] = { 
        name: plugin.name, 
        module: plugin.module, 
        options: pluginOptions 
      };
    }

    for (var y = 0, ylen = plugins.length; y < ylen; y++) {
      const plugin = plugins[y];
      const maybeAlreadyExists = findPlugin(plugs, plugin);

      if(maybeAlreadyExists) {
        let oldPlugin = maybeAlreadyExists;
        let idx = plugs.indexOf(oldPlugin);

        if(plugin.exclude) {
          plugs[idx] = null;
        } else {
          const newOptions = plugin.factory(ctx, options, oldPlugin.options);
          if(typeof newOptions !== 'object') {
            throw new Error(`createPluginConfigFailed for bundle ${name}: plugin's ${plugin.name} factory did not return options object`);
          }

          if(ctx.debug) console.log(`[createPluginConfig] overrode plugin ${name} with new options from the factory`);
          plugs[idx] = { 
            name: oldPlugin.name,
            module: oldPlugin.module,
            options: { ...oldPlugin.options, ...newOptions }
          };
        }

        continue;
      }

      let pluginOptions = plugin.options || {};
      if(plugin.factory) {
        let generatedOptions = plugin.factory(ctx, pluginOptions);
        if(typeof generatedOptions !== 'object') {
          throw new Error(`createPluginConfigFailed for bundle ${name}: plugin's ${plugin.name} factory did not return options object`);
        }

        pluginOptions = { ...pluginOptions, ...generatedOptions };
      }

      let configuredPlugin = { 
        name: plugin.name,
        module: plugin.module,
        options: pluginOptions 
      };

      if(plugin.position) {
        plugs.splice(plugin.position, 0, configuredPlugin);
      } else if(plugin.after) {
        let maybeExists = findPlugin(plugs, plugin.after);
        if(maybeExists) {
          plugs.splice(plugs.indexOf(maybeExists) + 1, 0, configuredPlugin);
        } else {
          plugs.push(configuredPlugin);
        }
      } else if(plugin.before) {
        let maybeExists = findPlugin(plugs, plugin.before);
        if(maybeExists) {
          plugs.splice(plugs.indexOf(maybeExists), 0, configuredPlugin);
        } else {
          plugs.push(configuredPlugin);
        }
      } else {
        plugs.push(configuredPlugin);
      }
    }

    configCache[name] = plugs;
    console.timeEnd(`create-plugin-config: ${name}`);
    return plugs;
  },

  async buildEntry(ctx, entry, options = {}) {
    const { source, dest } = ctx;
    let bundleFormat = 'es';
    let bundleName = `${entry}.es`;
    let isLegacy = false;

    if(options.type == 'es5') {
      bundleFormat = 'iife';
      bundleName = entry;
      isLegacy = true;
    }

    let plugins = [];
    const additionalPlugins = options.plugins || [];
    const pluginConfig = tasks.createPluginConfigForBundle(ctx, entry, additionalPlugins, options);

    pluginConfig.forEach(plugin => {
      plugins.push(plugin.module(plugin.options));
    });

    console.log('[buildEntry]', bundleName, bundleFormat, pluginConfig.map(x => x.name).join(', '));

    if(isLegacy == true) {
      plugins.push(babel({
        exclude: ['node_modules/**']
      }));
    }

    let bundle;
    try {
      bundle = await rollup({
        input: path.join(source, `${entry}.js`),
        plugins 
      });
    } catch(err) {
      console.error(`Error while bundling entry ${entry}: ${err.message}`);
      console.error(`Code: ${err.code}, Plugin: ${err.plugin}, Location: ${require('util').inspect(err.loc)}`);
      throw err;
    }

    const output = path.join(dest, `${bundleName}.js`);
    bundle.write({
      format: bundleFormat,
      file: output
    });

    console.log('[buildEntry]', bundleFormat, entry, '=>', bundleName, 'built!');
    return output;
  }
};
