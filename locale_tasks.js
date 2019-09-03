const bluebird = require('bluebird');
const yaml = require('node-yaml');

const { glob } = require('./utils');

module.exports = {
  async readLocalizations(ctx, locale) {
    const { globPattern, consumer } = ctx.localizationSettings;
    const pattern = globPattern(ctx, locale);
    const files = await glob(pattern); 
    console.log('[readLocalizations] pattern', pattern, 'resolved to', files);

    const parts = await bluebird.map(files, file => {
      return yaml.read(file);
    });

    if(consumer && typeof consumer == 'function') {
      return consumer(ctx, locale, parts);
    }
    
    return Object.assign({}, ...parts);
  }
};
