const path = require('path');

const { writeFile } = require('./utils');

const tasks = module.exports = {
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
    const { basePath, filePath } = tasks.translateUrlToStaticPath(ctx, url);

    let content = null;

    // allow returning the content from a factory
    if(typeof content === 'function') {
      console.log('returning content from a factory');
      content = contentOrFactory(ctx, { filePath, basePath, url });
    } else {
      content = contentOrFactory;
    }

    try {
      await writeFile(filePath, content);
    } catch(err) {
      console.error(`[writeSiteFile] error while writing ${filePath} (${url})`, err.message);
      console.error(err.stack);
      throw err;
    }

    return { filePath, url };
  },

  async writePageVersion(ctx, page, url, filePath, templateContext, templateFunction, isAliased) {
    let renderContext = Object.assign({}, templateContext, {
      path: url,
      currentUrl: url, 
      alias: isAliased === true,
      canonicalUrl: page.__canonicalUrl,
      page
    });

    const sitemapData = {
      slug: page.slug,
      url,
      //meta: templateContext.doc
    };

    if(page.sitemap) {
      Object.assign(sitemapData, page.sitemap);
    }

    if(isAliased) {
      sitemapData.isAlias = true;
    }

    if(!page.__versions) page.__versions = [];
    page.__versions.push(url);

    store.sitemap.push(sitemapData);
    return await writeFile(filePath, templateFunction(renderContext));
  },

  async writePage(ctx, page) {
    const { url, template, slug } = page;
    
    console.log('[writePage] writing ', slug, template, filePath, url);

    const templateContext = Object.assign({}, ctx.baseTemplateContext, { 
      slug,
      templateName: template,
      page
    });

    const templateFunction = await ctx.templates[template];
    if(!templateFunction) {
      throw new Error(`Invalid template ${template} for slug ${slug}`);
    }



    const aliases = (page.aliases || []).map(a => {
      return translateUrlToStaticPath(ctx, a);
    });

    await bluebird.map([{ basePath }, ...aliases], p => {
      return mkdirp(p.basePath);
    }, { concurrency: 1 });

    await bluebird.map([{ basePath, filePath, url, canonical: true }, ...aliases], version => {
      return writePageVersion(ctx, page, version.url, version.filePath, templateContext, templateFunction, version.canonical !== true);
    }, { concurrency: 1 });
  }
}
