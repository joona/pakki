const path = require('path');
const pug = require('pug');

const defaultPugOptions = {
  cache: false,
  pretty: true
};

const { glob, readFile, writeSiteFile } = require('./utils');

const tasks = module.exports = {
  async compileTemplate(context, filename, template) {
    const settings = context.pugSettings || {};
    const pugOptions = { ...defaultPugOptions, ...(settings.options || {}) };
    const file = await readFile(template);
    return pug.compile(file.toString(), Object.assign({}, pugOptions, {
      filename
    }));
  },

  async compileTemplates(context, globPath) {
    const files = await glob(globPath);
    const templateMap = {};
    const results = await Promise.all(files.map(x => {
      return tasks.compileTemplate(context, x, x);
    }));

    results.forEach((func, i) => {
      const filePath = files[i];
      const filename = path.basename(filePath, path.extname(filePath));
      templateMap[filename] = func;
    });

    console.log('[compileTemplates] compiled', results.length, 'templates');
    return templateMap;
  },

  async writePage(ctx, page, options = {}) {
    const { url, template, slug } = page;
    console.log('[writePage] writing ', slug, template, url);

    const templateContext = { 
      ...ctx.baseTemplateContext, 
      slug,
      templateName: template,
      page,
      canonicalUrl: url
    };

    // get pug template
    let templateFunction = ctx.templates[template];
    if(!templateFunction) {
      throw new Error(`Invalid template ${template} for slug ${slug}`);
    }

    // replace with middleware if any
    if(options.postProcessor && typeof options.postProcessor === 'function') {
      let originalTemplateFunction = templateFunction;
      templateFunction = (templateContext) => {
        return options.postProcessor(ctx, page, templateContext, originalTemplateFunction);
      };
    }

    // create content factory, which returns the resulting template
    let contentFactory = (templateContext) => {
      return async (ctx, additionalContext = {}) => {
        Object.assign(templateContext, additionalContext);
        console.log('templateContext:', templateContext);
        return await templateFunction(templateContext);
      };
    };

    const { filePath } = await writeSiteFile(ctx, url, contentFactory(templateContext));

    return {
      page,
      url,
      filePath
    };
  }
};
