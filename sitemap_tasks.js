const path = require('path');
const sitemapBuilder = require('sitemap');

const { writeFile } = require('./utils');

module.exports = {
  async buildSitemap(ctx, sitemap) {
    const { dest, site } = ctx;

    const urls = [];
    const urlSet = new Set();

    if(!sitemap) {
      sitemap = ctx.sitemap;
    }

    if(!sitemap || sitemap.length < 1) {
      throw new Error('Sitemap not defined, or it is empty');
    }

    //console.log('Sitemap:', site.sitemap);
    sitemap.forEach(item => {
      if(item.ignore) return;
      if(urlSet.has(item.url)) return;
      let prio = item.prio || (item.isAlias ? 0.7 : 1);

      console.log('[buildSitemap] adding item ', item.url, prio, item.isAlias);

      urls.push({
        url: item.url,
        changefreq: item.frequency || 'weekly',
        priority: prio,
        lastmodrealtime: true
      });

      urlSet.add(item.url);
    });

    const sitemapContent = sitemapBuilder.createSitemap({
      hostname: site.baseUrl,
      cacheTime: 60 * 60 * 10,
      urls
    });

    console.log('[buildSitemap] writing sitemap with ', urls.length, 'items');
    await writeFile(path.join(dest, 'sitemap.xml'), sitemapContent.toString());

    ctx.sitemap = [];
  }
};
