const fs = require('fs');
const util = require('util');
const path = require('path');
const recursiveCopy = require('recursive-copy');
const crypto = require('crypto');

const glob = util.promisify(require('glob'));
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

const utils = module.exports = {
  writeFile,
  readFile,
  recursiveCopy,

  async mkdirp(targetDir, options = { isRelativeToScript: false }) {
    const sep = path.sep;
    if (path.extname(targetDir)) {
      targetDir = path.dirname(targetDir);
    }

    const initDir = path.isAbsolute(targetDir) ? sep : "";
    const baseDir = options.isRelativeToScript ? __dirname : ".";

    return targetDir.split(sep).reduce((parentDir, childDir) => {
      const curDir = path.resolve(baseDir, parentDir, childDir);
      try {
        fs.mkdirSync(curDir);
      } catch (err) {
        if (err.code === "EEXIST") {
          // curDir already exists!
          return curDir;
        }

        // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
        if (err.code === "ENOENT") {
          // Throw the original parentDir error on curDir `ENOENT` failure.
          throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
        }

        const caughtErr = ["EACCES", "EPERM", "EISDIR"].indexOf(err.code) > -1;
        if (!caughtErr || (caughtErr && curDir === path.resolve(targetDir))) {
          throw err; // Throw if it's just the last created dir.
        }
      }

      return curDir;
    }, initDir);
  },

  async glob(patterns) {
    patterns = Array.isArray(patterns) ? patterns : [patterns];

    const files = await Promise.all(patterns.map(p => {
      return glob(p);
    }));

    return files.reduce((arr, part) => arr.concat(part), []);
  },

  copy(source, target) {
    return new Promise(function (resolve, reject) {
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
    if (destPath.charAt(0) == '/') destPath = destPath.substr(1);
    destPath = path.join(dest, destPath);

    const extension = path.extname(destPath);
    if (!extension) {
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
    if (!url) {
      console.log('contentFactory:', contentOrFactory);
      throw new Error('I dunno where to write the page, because url is not defined!');
    }
    const { basePath, filePath } = utils.translateUrlToStaticPath(ctx, url);

    if (!filePath) {
      console.log('failed to resolve path:', basePath, filePath, ' / ', url);
      throw new Error('I dunno where to write the page, because file path resolving failed!');
    }

    let content = null;

    // allow returning the content from a factory
    if (typeof contentOrFactory === 'function') {
      content = await contentOrFactory(ctx, { filePath, basePath, url });
    } else {
      content = contentOrFactory;
    }

    try {
      await this.mkdirp(basePath);
      await writeFile(filePath, content);
    } catch (err) {
      console.error(`[writeSiteFile] error while writing ${filePath} (${url})`, err.message);
      console.error(err.stack);
      throw err;
    }

    return { filePath, url };
  },

  async fileHash(ctx, filePath, algorithm) {
    if (!algorithm) {
      algorithm = ctx.hashAlgorithm || 'md5';
    }

    return new Promise((resolve, reject) => {
      let shasum = crypto.createHash(algorithm);
      try {
        let s = fs.ReadStream(filePath);

        s.on('data', data => {
          shasum.update(data);
        });

        // making digest
        s.on('end', () => {
          const hash = shasum.digest('hex');
          return resolve(hash);
        });
      } catch (error) {
        console.error(error.stack);
        return reject('hash calculation failed: ' + error.message);
      }
    });
  }
};
