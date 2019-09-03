const path = require('path');

const { readFile, writeFile, mkdirp, copy } = require('./utils');

module.exports = {
  async setupAdmin(ctx) {
    const { dest, source, branch } = ctx;

    const settings = ctx.netlifySettings.admin;
    if(!settings) return;

    const adminPath = path.join(source, settings.source);
    const adminDest = path.join(dest, settings.dest);

    const adminTemplate = await ctx.templates.admin;
    const templateContext = {
      ...ctx.baseTemplateContext,
      branch,
      settings
    };

    await mkdirp(adminDest);
    await writeFile(path.join(adminDest, 'index.html'), adminTemplate(templateContext));

    const config = await readFile(path.join(adminPath, 'config.js'));
    await writeFile(path.join(adminDest, 'config.js'), config);
  },

  async buildNetlifyRedirects(ctx) {
    const { dest, source } = ctx;
    return await copy(path.join(source, '_redirects.txt'), path.join(dest, '_redirects'));
  }
};
