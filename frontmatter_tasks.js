const path = require('path');
const frontMatter = require('front-matter');

const { glob, readFile } = require('./utils');

const tasks = module.exports = {
  async readFrontMatterFile(ctx, item, relativePath) {
    const slug = path.basename(item, path.extname(item));
    const content = await readFile(item);
    const matter = frontMatter(content.toString());
    const filePath = path.basename(path.relative(relativePath, item), '.md');
    const fileKey = path.basename(filePath, path.extname(item));
    
    return {
      slug,
      content: matter.body,
      ...matter.attributes,
      _key: fileKey,
      _path: filePath,
      _source: item
    };
  },

  async readFrontMatterFiles(ctx, globPath) {
    const { source } = ctx;
    const fullPath = path.join(source, globPath);
    const relativePath = path.dirname(fullPath);
    const items = await glob(fullPath);

    const results = await Promise.all(items.map(item => {
      return tasks.readFrontMatterFile(ctx, item, relativePath);
    }));

    console.log('[readFrontMatter] processed', results.length, 'files');
    return results;
  }
};

