const fs = require('fs');
const http = require('http');
const handler = require('serve-handler');

function readRedirects(ctx, redirectsFile) {
  return fs.readFileSync(redirectsFile)
    .toString()
    .split("\n")
    .reduce((arr, line) => {
      const [ source, destination, status ] = line.split(/\s+/);

      if(source && source.length > 0) {
        const redirect = {
          source, destination
        };

        if(status && !isNaN(parseInt(status))) {
          redirect.type = status;
        }

        arr.push(redirect);
      }
      return arr;
    }, []);
}

module.exports = {
  livereload(ctx) {
    const settings = (ctx.serverSettings || {}).livereload || {};
    const { port } = settings;

    const server = require('livereload').createServer(settings);

    server.watch(ctx.dest);
    console.log('[livereload] initialized on port', port);
  },

  server(ctx) {
    const { port, cors, redirects, handlerOptions } = ctx.serverSettings || {};

    let redirectsArray = [];
    if(Array.isArray(redirects)) {
      redirectsArray = redirects;
    } else if(typeof redirects === 'string') {
      redirectsArray = readRedirects(ctx, redirects);
    }

    const server = http.createServer((req, res) => {
      console.log(req.method, req.url);

      if(cors) {
        // add CORS headers
        res.setHeader('Access-Control-Allow-Headers', cors.headers);
        res.setHeader('Access-Control-Allow-Methods', cors.methods);
        res.setHeader('Access-Control-Allow-Origin', cors.origin);
      }

      return handler(req, res, {
        public: ctx.dest,
        redirects: redirectsArray,
        ...(handlerOptions || {})
      });
    });

    server.listen(port, () => {
      console.log(`[server] Serving at http://localhost:${port}`);

      if(redirectsArray && redirectsArray.length > 0) {
        console.log('[server] redirects:', redirects);
      }

      if(cors) {
        console.log(`[server] CORS support is enabled`);
      }
    });
  }
};
