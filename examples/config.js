const path = require('path');

const DEVELOPMENT = process.env.DEVELOPMENT ? true : false;
const SOURCE = path.join(__dirname, '../src');
const DEST = path.join(__dirname, '../dist');

const LOCALES = [ 'fi' ];

// exports default build context
module.exports = {
  // Source directory
  source: SOURCE,

  // Destination directory
  dest: DEST,

  // Expose needed custom variables to context
  development: DEVELOPMENT,
  branch: process.env.BRANCH || 'master',

  // netlify?
  netlify: false,

  // injections to javascript code
  //  
  bundleInjections: {
    // API_URL: 'http://localhost:8080' // replaces <@API_URL@> in js files with http://localhost:8080
  },

  // Global variables for site
  site: {
    development: DEVELOPMENT,
  },

  // Localization settings
  locales: LOCALES,

  // LESS Settings
  lessSettings: {
    // less bundles to build
    entries: [
      'site.less'
    ]
  },

  // JavaScript bundle settings
  bundleSettings: {
    bundles: [
      { name: 'app', types: ['iife', 'es6'], enabled: true },
      //{ name: 'widget', types: ['iife', 'es6'], enabled: true }
    ]
  },

  // Localization settings
  localizationSettings: {
    locales: LOCALES,
    globPattern(ctx, locale) {
      return path.join(SOURCE, 'content', `${locale}.yml`);
    }
  },
  
  // Development Server
  serverSettings: {
    port: process.env.PORT || 7701,

    // options for serve-handler
    handlerOptions: {},
    
    // Redirects: can be netlify _redirects.txt, null, or array with { source, destination, type }
    //redirects: path.join(SOURCE, '_redirects.txt')

    // if defined, enables CORS
    cors: {
      headers: 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
      methods: 'GET,POST,PUT,DELETE,OPTIONS',
      origin: '*',
    },

    // livereload configuration
    livereload: {
      port: process.env.LIVERELOAD_PORT || 35939,
      delay: 100
    }
  },
};
