const bluebird = require('bluebird');
const yaml = require('node-yaml');

const { glob } = require('./utils');

module.exports = {
  async readLocalizations(ctx, locale) {
    const { globPattern, consumer } = ctx.localizationSettings;
    const files = await glob(globPattern(ctx, locale)); 

    const parts = await bluebird.map(files, file => {
      return yaml.read(file);
    });

    if(consumer && typeof consumer == 'function') {
      return consumer(ctx, locale, parts);
    }
    
    return Object.assign({}, ...parts);
  }
};
