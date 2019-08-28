const bluebird = require('bluebird');
const path = require('path');
const yaml = require('node-yaml'); 

const { glob } = require('./utils');

const tasks = module.exports = {
  async readPage(ctx, file, relativePath) {
    const content = await yaml.read(file);
    const fileKey = path.basename(path.relative(relativePath, file), path.extname(file));

    return {
      slug: fileKey || content.slug,
      ...content,
      _source: file,
      _key: fileKey
    };
  },

  async readPages(ctx, globPattern) {
    const { source } = ctx;
    const fullPath = path.join(source, globPattern);
    const relativePath = path.dirname(fullPath);
    const files = await glob(fullPath);

    const items = await bluebird.map(files, file => {
      return tasks.readPage(ctx, file, relativePath);
    });

    console.log('[readPages] processed', items.length, 'files');

    return items;
  }
};
