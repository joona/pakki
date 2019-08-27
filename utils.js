const fs = require('fs');
const util = require('util');
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
  }
};
