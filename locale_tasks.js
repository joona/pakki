const bluebird = require('bluebird');
const yaml = require('node-yaml');

const { glob } = require('./utils');

module.exports = {
  async readLocalizations(ctx, locale) {
    const { globPattern } = ctx.localizationSettings;
    const files = await glob(globPattern(ctx, locale)); 

    const parts = await bluebird.map(files, file => {
      return yaml.read(file);
    });
    
    return Object.assign({}, ...parts);
  }
};
