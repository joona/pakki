const path = require('path');
const less = require('less');

const { readFile, writeFile, fileHash } = require('./utils');

const tasks = module.exports = {
  lessRender(content, options) {
    console.log('[lessRender] with options:', options);
    return new Promise((resolve, reject) => {
      less.render(content, options)
        .then(output => resolve(output), err => reject(err));
    });
  },

  async buildLessFile(ctx, entry, options = {}) {
    const { source, dest } = ctx;
    const entryName = path.basename(entry, path.extname(entry));
    const lessContent = await readFile(path.join(source, 'less', entry));

    const { paths, hashAlgorithm, ...restOptions } = options;
    const lessOptions = {
      paths: [...(Array.isArray(paths) ? paths : []), path.join(source, 'less') ],
      ...restOptions
    };

    let destFile, output, destFilePath;
    try {
      output = await tasks.lessRender(lessContent.toString(), lessOptions);
      destFile = entry.replace('less', 'css');
      destFilePath = path.join(dest, destFile);
      await writeFile(destFilePath, output.css);
      console.log('[buildLess] built!');
    } catch(err) {
      console.error('Failed to build less:');
      console.error(err);
      throw new err;
    }

    if(hashAlgorithm) {
      if(!ctx.lessOutputs) ctx.lessOutputs = {};
      const hash = await fileHash(ctx, destFilePath, hashAlgorithm);
      const hashedFile = destFilePath.replace('.css', `-${hash}.css`);
      await writeFile(hashedFile, output.css);

      ctx.lessOutputs[entryName] = {
        filePath: path.relative(ctx.dest, destFilePath),
        fileName: path.basename(destFilePath),
        hashedName: path.basename(hashedFile),
        hash: hash
      };

      console.log('[buildLess] build with hash', hash, hashedFile);
    }
  },

  async buildLess(ctx) {
    const { entries, ...otherOptions } = ctx.lessSettings || {};

    await Promise.all(entries.map(entry => {
      return tasks.buildLessFile(ctx, entry, otherOptions);
    }));
  }
};

