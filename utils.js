const fs = require('fs');
const util = require('util');
const path = require('path');
const mkdirp = require('mkdirp-promise');
const recursiveCopy = require('recursive-copy');

const glob = util.promisify(require('glob'));
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

const utils = module.exports = {
  glob,
  mkdirp,
  writeFile,
  readFile,
  recursiveCopy,

  copy(source, target) {
    return new Promise(function(resolve, reject) {
      var rd = fs.createReadStream(source);
      rd.on('error', rejectCleanup);
      var wr = fs.createWriteStream(target);
      wr.on('error', rejectCleanup);
      function rejectCleanup(err) {
        rd.destroy();
        wr.end();
        console.error('error while copying', err);
        reject(err);
      }
      wr.on('finish', () => {
        resolve(`${source} => ${target}`);
      });
      rd.pipe(wr);
    });
  },

  lookup(obj, ...args) {
    return args.reduce((xs, x) => (xs && xs[x] !== undefined && xs[x] !== null) ? xs[x] : null, obj);
  },

  translateUrlToStaticPath(ctx, destPath) {
    const { dest } = ctx;
    const url = destPath; 
    if(destPath.charAt(0) == '/') destPath = destPath.substr(1);
    destPath = path.join(dest, destPath);

    const extension = path.extname(destPath);
    if(!extension) {
      destPath = path.join(destPath, 'index.html');
    }

    const basePath = path.dirname(destPath);
    return {
      url,
      basePath,
      filePath: destPath
    };
  },

  async writeSiteFile(ctx, url, contentOrFactory) {
    if(!url) {
      console.log('contentFactory:', contentOrFactory);
      throw new Error('I dunno where to write the page, because url is not defined!');
    }
    const { basePath, filePath } = utils.translateUrlToStaticPath(ctx, url);

    if(!filePath) {
      console.log('failed to resolve path:', basePath, filePath, ' / ', url);
      throw new Error('I dunno where to write the page, because file path resolving failed!');
    }

    let content = null;

    // allow returning the content from a factory
    if(typeof contentOrFactory === 'function') {
      content = await contentOrFactory(ctx, { filePath, basePath, url });
    } else {
      content = contentOrFactory;
    }

    try {
      await mkdirp(basePath);
      await writeFile(filePath, content);
    } catch(err) {
      console.error(`[writeSiteFile] error while writing ${filePath} (${url})`, err.message);
      console.error(err.stack);
      throw err;
    }

    return { filePath, url };
  }
};
