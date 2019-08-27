const bluebird = require('bluebird');
const path = require('path');
const mkdirp = require('mkdirp-promise');
const yaml = require('node-yaml');

// FIXME: what an ugly mess with writePage? fix it

const helpers = require('./helpers');
const store = require('./store');

//const netlify = require('./netlify_tasks');

const { readLocalizations } = require('./locale_tasks');
const { shopify } = require('./shopify_client');
const { readFrontMatterFiles } = require('./frontmatter_tasks');
const { writeFile, glob } = require('./utils');
const { buildSitemap } = require('./sitemap_tasks');

const { shopService } = require('./shop_service');

// NOT USED

const readPages = async (ctx, locale) => {
  const { source } = ctx;
  const files = await glob(path.join(source, 'content', locale, 'pages', '*.yml'));

  const items = await bluebird.map(files, file => {
    return yaml.read(file)
      .then(content => {
        const fileKey = path.basename(file, path.extname(file));
        return {
          key: fileKey,
          slug: fileKey || content.slug,
          ...content
        };
      });
  });
  return items;
};

const readPagesFromDirectory = async (ctx, locale, directory) => {
  const { source } = ctx;
  const files = await glob(path.join(source, 'content', locale, directory, '*.yml'));

  const items = await bluebird.map(files, file => {
    return yaml.read(file)
      .then(content => {
        const fileKey = path.basename(file, path.extname(file));
        const slug = path.join(directory, fileKey);

        return {
          key: fileKey,
          slug: slug || content.slug,
          ...content
        };
      });
  });
  return items;
};

const translateUrlToStaticPath = (ctx, destPath) => {
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
};

const writePageVersion = async (ctx, page, url, filePath, templateContext, templateFunction, isAliased) => {
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
};

const writePage = async (ctx, page) => {
  const { url, template, slug } = page;
  const { basePath, filePath } = translateUrlToStaticPath(ctx, url);
  page.__file = filePath;
  page.__canonicalUrl = url;

  console.log('[writePage] writing ', slug, template, filePath, url);

  if(false && page.isFrontmatter) {
    //await readFrontMatter(page);
  }

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
};

const addRedirect = (ctx, from, to) => {
  if(!ctx.redirects) ctx.redirects = [];

  ctx.redirects.push({
    from,
    to
  });
};

// NOT USED
const prepareImages = async (ctx, imagePath) => {
  const { source } = ctx;
  const files = await glob(path.join(source, imagePath, '*'));
  
  return files.map(f => {
    const filePath = path.relative(source, f);
    console.log('found image:', f, source, filePath);
    return {
      url: `/${filePath}`
    };
  });
};

const dumpProducts = async (context, products) => {
  const { dest } = context;
  console.log('Dumping products:', products);
  await writeFile(path.join(dest, 'products.json'), JSON.stringify(products, true, 2));
};

const fetchShopify = async (context) => {
  if(process.env.SKIP_SHOPIFY) return;

  await shopService.initialize();

  if(false) {
    const { collections, products } = await shopify.fetchAllCollectionsWithProductsMapped();

    shopService.addCollections(collections);
    shopService.addProducts(products);
  }

  
  if(false) {
    Object.values(collections).forEach(c => {
      console.log('[Shopify:Collection]', c.id, c.handle, c.title);
    });

    Object.values(products).forEach(c => {
      console.log('[Shopify:Product]', c.id, c.handle, c.title, c.collectionIds);
    });
  }

  if(context.development) {
    await dumpProducts(context, Object.values(shopService.products));
  }
};

const preparePage = async (ctx, page, metadata = {}) => {
  const data = {};

  if(page.slug.indexOf('collections/') === 0) {
    data.template = 'feature';
  }

  if(page.sitemap && metadata.sitemap) {
    data.sitemap = {};
    Object.assign(data.sitemap, metadata.sitemap, page.sitemap);
  } else if(metadata.sitemap) {
    data.sitemap = Object.assign({}, metadata.sitemap);
  }

  return data;
};

const prepareShopCategory = async (ctx, page) => {
  const data = {
    category: page.category,
    slug: `shop/categories/${page.category}`,
    template: 'shop-category',
    url: `/kauppa/kategoria/${page.slug}`,
    products: shopService.getProductsByCategory(page.category)
  };
  return data;
};

const prepareShopCollection = async (ctx, page) => {
  const shopifyCollection = shopService.getCollectionByHandle(page.shopify.collection);

  const data = {
    collection: shopifyCollection,
    slug: `shop/${page.slug}`,
    template: 'shop-category',
    url: `/kauppa/mallisto/${shopifyCollection.handle}`,
    products: shopService.getCollectionProducts(shopifyCollection.id),
    hero: null
  };

  //console.log('prepareShopCollection', data.slug, shopifyCollection.id, data.products);
  return data;
};

const prepareProduct = async (ctx, page) => {
  const { productId, collectionId, collectionPageSlug } = page;
  const product = shopService.getProduct(productId);
  //const collection = shopService.getCollection(collectionId);
  const collectionPage = store.getCollection(collectionPageSlug);

  const titleParts = [product.fullTitle];
  if(collectionPage.productType) {
    titleParts.unshift(`${collectionPage.productType}:`);
  }

  const data = {
    template: 'product-details',
    slug: `products/${product.handle}`,
    //product,
    //collection,

    headTitle: titleParts.join(' '),
    description: product.metaDescription,
    ogImage: product.image,
    isProduct: true,

    product: {
      id: productId,
      collectionId: collectionId,
      image: shopService.getProductImage(product),
      title: product.title,
      content: product.body_html,
      metafields: product.metafields
    }
  };

  return data;
};

const siteBuilder = module.exports = {
  async buildSite(ctx) {
    const { locales } = ctx;

    // fetch shopify data
    await fetchShopify(ctx);

    await bluebird.map(locales, locale => {
      return siteBuilder.buildSiteVersion(ctx, locale);
    }, { concurrency: 1 });

    //await netlify.setupAdmin(ctx); 
    
    // FIXME: add sitemap generation
  },

  async buildSiteVersion(ctx, locale) {
    ctx.store = store;
    ctx.shopService = shopService;

    const texts = await readLocalizations(ctx, locale);
    store.texts = texts;
    
    // read yaml files
    const [ collections, materials ] = await bluebird.all([
      readPagesFromDirectory(ctx, locale, 'collections'),
      readPagesFromDirectory(ctx, locale, 'materials')
    ]);

    store.collections = collections;
    store.materials = materials;

    const pages = await readFrontMatterFiles(ctx, path.join('content', locale, 'markdown/**/*.md'));
    const yamlPages = await readPages(ctx, locale);
    store.pages = [ ...pages, ...yamlPages ];

    // generate template context
    ctx.baseTemplateContext = {
      ...texts,
      ...helpers(ctx),
      locale,
      site: ctx.site,
      shop: ctx.shopService,
      store,
    };
    
    // compile collections
    await bluebird.map(store.collections, x => {
      return preparePage(ctx, x, { sitemap: { prio: 0.9 } })
        .then(data => writePage(ctx, { ...x, ...data }));
    }, { concurrency: 5 });

    // compile material pages
    await bluebird.map(store.materials, x => {
      return preparePage(ctx, x, { sitemap: { ignore: true } })
        .then(data => writePage(ctx, { ...x, ...data }));
    }, { concurrency: 5 });

    // compile pages
    await bluebird.map(store.pages, x => {
      return preparePage(ctx, x, { sitemap: { prio: 1 } })
        .then(data =>  writePage(ctx, { ...x, ...data }));
    }, { concurrency: 5 });

    // compile products
    await bluebird.map(shopService.buildQueue, x => {
      return prepareProduct(ctx, x)
        .then(data => writePage(ctx, { ...x, ...data, sitemap: { prio: 0.9 } }));
    }, { concurrency: 5 });

    //console.log('Product Categories:', shopService.categories);
    //console.log('Store Categories:', store.shopCategories);

    await bluebird.map(Object.entries(store.shopCategories), y => {
      const [ k, x ] = y;
      return prepareShopCategory(ctx, { ...x, category: k })
        .then(data => writePage(ctx, { ...x, ...data, sitemap: { prio: 0.9 } }));
    }, { concurrency: 5 });
    console.log('Product Collections:', store.productCollections);

    await bluebird.map(store.collections.filter(x => x.shopify && x.released), x => {
      return prepareShopCollection(ctx, x)
        .then(data => writePage(ctx, { ...x, ...data, sitemap: { prio: 0.9 } }));
    }, { concurrency: 5 });

    await buildSitemap(ctx, store);
  }
};
