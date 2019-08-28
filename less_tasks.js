const path = require('path');
const less = require('less');

const { readFile, writeFile } = require('./utils');

const tasks = module.exports = {
  lessRender(content, options) {
    return new Promise((resolve, reject) => {
      less.render(content, options)
        .then(output => resolve(output), err => reject(err));
    });
  },

  async buildLessFile(ctx, entry) {
    const { source, dest } = ctx;
    const lessContent = await readFile(path.join(source, 'less', entry));
    const lessOptions = {
      paths: [ path.join(source, 'less') ]
    };

    try {
      const output = await tasks.lessRender(lessContent.toString(), lessOptions);
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

