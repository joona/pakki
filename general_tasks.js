const fs = require('fs');
const path = require('path');

const less = require('less');
const mkdirp = require('mkdirp-promise');

const { copy, recursiveCopy, glob, writeFile } = require('./utils');

const lessRender = (content, options) => {
  return new Promise((resolve, reject) => {
    less.render(content, options)
      .then(output => resolve(output), err => reject(err));
  });
};

const tasks = module.exports = {
  async buildHtml(ctx) {
    const { source, dest } = ctx;
    const templates = await glob(path.join(source, 'html/*.html'));
    const results = await Promise.all(templates.map(template => {
      return copy(template, path.join(dest, path.basename(template)));
    }));
    //results.map(x => console.log('[buildHtml]', x));
    console.log('[buildHtml] copied', results.length, 'files');
    return results;
  },

  async buildFonts(ctx) {
    const { source, dest } = ctx;
    await mkdirp(path.join(dest, 'fonts'));
    const files = await glob(path.join(source, 'fonts/*'));
    const results = await Promise.all(files.map(file => {
      return copy(file, path.join(dest, 'fonts', path.basename(file)));
    }));
    //results.map(x => console.log('[buildFonts]', x));
    console.log('[buildFonts] copied', results.length, 'fonts');
    return results;
  },

  async buildAssets(ctx) {
    const { source, dest } = ctx;
    //await mkdirp(path.join(dest, 'assets'));

    const options = {
      overwrite: true, 
      expand: false,
      dot: false,
      junk: false
    };

    const sourcePath = path.join(source, 'assets'); 
    const destPath = path.join(dest, 'assets');
    //console.log(options);
    //console.log(sourcePath, destPath);

    const results = await recursiveCopy(sourcePath, destPath, options)
      .on(recursiveCopy.events.ERROR, (err, info) => {
        console.warn('[buildAssets] failed to copy:', info);
        console.warn(err);
      });

    console.log('[buildAssets] copied', results.length, 'assets copied');
    return results;
  },

  async buildAssetsShallow(ctx) {
    const { source, dest } = ctx;
    await mkdirp(path.join(dest, 'assets'));
    const items = await glob(path.join(source, 'assets/*'));
    const results = await Promise.all(items.map(item => {
      if(path.basename(item).charAt(0) == '_') {
        return Promise.resolve();
      }
      return copy(item, path.join(dest, 'assets', path.basename(item)));
    }));
    //results.map(x => console.log('[buildAssets]', x));
    console.log('[buildAssets] copied', results.length, 'assets');
    return results;
  },

  async buildLessFile(ctx, entry) {
    const { source, dest } = ctx;
    const lessContent = fs.readFileSync(path.join(source, 'less', entry));
    const lessOptions = {
      paths: [ path.join(source, 'less') ]
    };

    try {
      const output = await lessRender(lessContent.toString(), lessOptions);
      const destFile = entry.replace('less', 'css');

      await writeFile(path.join(dest, destFile), output.css);
      console.log('[buildLess] built!');
    } catch(err) {
      console.error('Failed to build less:');
      console.error(err);
      throw new err;
    }
  },

  async buildLess(ctx) {
    const { entries } = ctx.lessSettings || {};

    await Promise.all(entries.map(entry => {
      return tasks.buildLessFile(ctx, entry);
    }));
  }
};

