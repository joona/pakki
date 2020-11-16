const path = require('path');
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');

const { writeFile } = require('./utils');

const sitemapBuilder = module.exports = {
  async buildSitemap(ctx, sitemap) {
    const { dest, site } = ctx;

    const urls = [];
    const urlSet = new Set();
    const handledKeys = new Set();
    const hasMultipleLocales = ctx.locales && Array.isArray(ctx.locales) && ctx.locales.length > 1;

    if(!sitemap) {
      sitemap = ctx.sitemap;
    }

    if(!sitemap || !Array.isArray(sitemap)) {
      throw new Error('Sitemap not defined, must be an array');
    }

    if(sitemap.length < 1) {
      console.warn('[buildSitemap] sitemap is empty');
      return;
    }

    if(hasMultipleLocales && ctx.primaryLocale) {
      sitemap = sitemap.sort((a, b) => {
        if(b.locale == a.locale) return 0;
        return b.locale == ctx.primaryLocale ? 1 : -1;
      });
    }

    //console.log('Sitemap:', site.sitemap);
    sitemap.forEach(item => {
      if(item.ignore) return;
      if(urlSet.has(item.url)) return;
      if(handledKeys.has(item.key)) return;

      let prio = item.prio || (item.isAlias ? 0.7 : 1);

      console.log('[buildSitemap] adding item ', item.key, item.url, prio, item.isAlias);

      let links = [];
      if(hasMultipleLocales && ctx.primaryLocale == item.locale && item.key) {
        links = sitemap.filter(p => p.key == item.key)
          .map(p => {
            return {
              lang: p.locale,
              url: p.url
            };
          });
      }

      urls.push({
        url: item.url,
        changefreq: item.frequency || 'weekly',
        priority: prio,
        lastmodrealtime: item.updated_at || true,
        links
      });

      urlSet.add(item.url);

      if(item.key) {
        handledKeys.add(item.key);
      }
    });

    const sitemapContent = await sitemapBuilder.createSitemap(urls, {
      hostname: site.baseUrl,
      cacheTime: 60 * 60 * 10,
    });

    console.log('[buildSitemap] writing sitemap with ', urls.length, 'items');
    await writeFile(path.join(dest, 'sitemap.xml'), sitemapContent.toString());

    ctx.sitemap = [];
  },

  async createSitemap(urls, options) {
    const stream = new SitemapStream(options);

    return streamToPromise(Readable.from(urls)
      .pipe(stream))
      .then(data => {
        return data.toString();
      });
  }
};
