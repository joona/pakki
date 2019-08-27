const path = require('path');
const pug = require('pug');

const pugOptions = {
  cache: false,
  pretty: true
};

const { copy, glob, readFile, writeFile } = require('./utils');

const compileTemplate = async (filename, template) => {
  const file = await readFile(template);
  return pug.compile(file.toString(), Object.assign({}, pugOptions, {
    filename
  }));
};


const tasks = module.exports = {
  async compileTemplates(context, globPath) {
    const files = await glob(globPath);
    const templateMap = {};
    const filenames = [];
    const results = await Promise.all(files.map(x => {
      return compileTemplate(x, x);
    }));

    results.forEach((func, i) => {
      const filePath = files[i];
      const filename = path.basename(filePath, path.extname(filePath));
      templateMap[filename] = func;
    });

    console.log('[compileTemplates] compiled', results.length, 'templates');
    return templateMap;
  }
};
