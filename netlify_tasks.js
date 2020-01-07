const path = require('path');

const { readFile, writeFile, mkdirp, copy } = require('./utils');
const netlifyAdmin = require('./netlify/schema_service');

module.exports = {
  async setupAdmin(ctx) {
    const { dest, source, branch } = ctx;
    const context = {};

    const settings = ctx.netlifySettings.admin;
    if(!settings) return;

    const adminPath = path.join(source, settings.source);
    const adminDest = path.join(dest, settings.dest);
    await mkdirp(adminDest);

    if(settings.generateSchema) {
      await netlifyAdmin.generateAdminConfig(ctx);
      context.manualInit = false;
    } else {
      context.manualInit = true;
    }

    const adminTemplate = await ctx.templates.admin;
    const templateContext = {
      ...ctx.baseTemplateContext,
      branch,
      settings,
      ...context
    };

    await writeFile(path.join(adminDest, 'index.html'), adminTemplate(templateContext));

    const config = await readFile(path.join(adminPath, 'config.js'));
    await writeFile(path.join(adminDest, 'config.js'), config);
  },

  async buildNetlifyRedirects(ctx) {
    const { dest, source } = ctx;
    return await copy(path.join(source, '_redirects.txt'), path.join(dest, '_redirects'));
  }
};
