const bluebird = require('bluebird');
const path = require('path');

const { mkdirp } = require('@joona/pakki/utils');
const { buildAssets, buildFonts } = require('@joona/pakki/general_tasks');
const { buildLess } = require('@joona/pakki/less_tasks');
const { buildBundles } = require('@joona/pakki/bundle_tasks');
const { readLocalizations } = require('@joona/pakki/locale_tasks');
const { compileTemplates } = require('@joona/pakki/pug_tasks');

const { buildSite } = require('./build/site');
const { watcher } = require('@joona/pakki/watcher_tasks');
const { cli } = require('@joona/pakki/cli');
const { server, livereload } = require('@joona/pakki/server');

// load config
const config = require('./config');

/*
 * Tasks
 *
 */

const tasks = {

  // prepare destination directory
  async prebuild(context) {
    const { dest } = context;
    await mkdirp(path.join(dest));
    await bluebird.all([
      await mkdirp(path.join(dest, 'assets')),
      await mkdirp(path.join(dest, 'assets/icons'))
    ]);
  },

  // build everything
  async build(context) {
    return await bluebird.all([
      buildAssets(context),
      buildFonts(context),
      buildLess(context),
      //buildHtml(context)
      //tasks.buildTemplates(context),
      tasks.buildTemplatesAndBundle(context)
    ]);
  },

  // build bundles with locales
  async buildBundlesWithLocales(context) {
    context.localizations = await readLocalizations(context, 'fi');
    return await buildBundles(context);
  },

  // build bundle and templates
  async buildTemplatesAndBundle(context) {
    return bluebird.all([
      tasks.buildTemplates(context),
      //tasks.buildBundlesWithLocales(context)
      buildBundles(context)
    ]);
  },

  // build templates
  async buildTemplates(context) {
    context.templates = await compileTemplates(context, path.join(context.source, 'templates', '*.pug'));
    await buildSite(context);
  },

  // setup watcher for files
  watch(context) {
    /*
     * Create watcher and define tasks for certain file paths:
     *
     *    w.add(task <function>, ...paths <string>)
     */

    const w = watcher(context) 
      .add(buildLess, 'less/*.less')
      //.add(buildHtml, 'html/*')
      .add(buildAssets, 'assets/**');

    w.add(tasks.buildTemplatesAndBundle, 
      '**/*.js',
      'content/*/**.yml',
      'content/*/**.md',
      'templates/*.pug'
    );

    w.watch();
  }
};


/*
 * CLI
 *
 * Define build commands
 */

const context = config;
context.startTime = +(new Date());

// create cli
cli(context)
  .command('watch', async(ctx) => {
    await tasks.prebuild(ctx);
    await tasks.build(ctx);
    tasks.watch(ctx);
    livereload(ctx);
    server(ctx);
  })
  .command('build', async(ctx) => {
    await tasks.prebuild(ctx);
    await tasks.build(ctx);
  })
  .run();
