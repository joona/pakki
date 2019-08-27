const fs = require('fs');
const path = require('path');
const marked = require('marked');
const store = require('./store');
const toStyleString = require('to-style').string;
const pug = require('pug');


function renderMarkdownPartial(ctx, context, block, content) {
  const { source } = ctx;
  const { processor, command, parts, args } = block;
  const statement = [processor, command].join(':');

  let output, template;

  switch(statement) {
    case 'pug:mixin':
      let blockContent = null;
      let [ mixin ] = parts;
      let argsSet = new Set(args);

      if(content) {
        blockContent = content.map(x => `  ${x}`).join("\n");
      }

      if(argsSet.has('marked')) {
        blockContent = marked(blockContent)
          .split("\n")
          .map(x => `  ${x}`)
          .join("\n");
      }

      contents = `
include _mixins.pug
+${mixin}(page, ${args.map(x => JSON.stringify(x)).join(', ')})`;

      if(blockContent) {
        contents += "\n" + blockContent;
      }

      //console.log('pug contents:', contents);

      template = pug.compile(contents, {
        filename: path.join(source, 'templates', 'temp.pug')
      });
      output = template({ 
        page: context, 
        store: ctx.store,
        ...helpers(ctx)
      });
      return output;

    case 'pug:render':
      contents = `include _mixins.pug\n${content.join("\n")}`;
      template = pug.compile(contents, {
        filename: path.join(source, 'templates', 'temp.pug')
      });
      output = template({ page: context, store: ctx.store });
      return output;

    default:
      return `<!-- INVALID PARTIAL (${statement}) -->`;
  }
}

const helpers = module.exports = (context, templateContext) => {
  return {
    marked(value) {
      return marked(value);
    },

    markedFrontMatter(matter) {
      const lines = matter.content.split("\n");
      const blocks = [];

      let currentBlock = null;
      let rows = [];
      let markdownRows = [];
      var currentType = null;
      var currentBlockStart = null;

      function finishBlock() {
        const content = renderMarkdownPartial(context, matter, currentBlock, rows);

        content.split("\n").forEach(x => {
          markdownRows.push(x);
        });

        rows = [];
        currentBlock = null;
        currentBlockStart = null;
        return content;
      }

      for (var i = 0, len = lines.length; i < len; i++) {
        let line = lines[i];


        if(line.charAt(0) == '[' && line.indexOf(']: #') > -1) {
          let [statement, args] = line.replace(/[\[\]\(\)#]/g, '').split(':');
          statement = statement.trim();
          args = args.trim().split(',').map(x => x.trim());

          let statementParts = statement.split('/');
          let processor = statementParts.shift();
          let command = statementParts.shift();

          if(currentBlock) {
            finishBlock();
          } else if(!currentBlock && statement) {
            currentType = processor;
            currentBlock = {
              processor,
              command,
              parts: statementParts,
              args
            };

            blocks.push(currentBlock);
            currentBlockStart = i;
          } else {
            markdownRows.push(line);
          }
        } else {
          if(currentBlock) {
            if(line.charAt(0) == ' ' && line.charAt(1) == ' ') {
              rows.push(line)
            } else if(i == len-1) {
              finishBlock();
            } else {
              finishBlock();
              markdownRows.push(line);
            }
          } else {
            markdownRows.push(line);
          }
        }
      }

      console.log('found blocks from markdown', blocks);

      return marked(markdownRows.join("\n"));
    },

    json(obj) {
      return JSON.stringify(obj);
    },

    withKey(array, key) {
      if(!Array.isArray(array)) {
        throw "withKey failed: Not an array";
      }

      const item = array.find(x => x.key === key);
      //console.log('withKey', key, item);
      return item;
    },

    toStyle(css) {
      return toStyleString(css);
    },

    getUrl(slug) {
      const page = store.sitemap[slug];
      if(page) return page.path;
      return '/';
    },

    getUrlBySlug(slug) {
      const page = store.sitemap[slug];
      if(page) return page.path;
      return '/';
    },

    lineBreaks(input) {
      input = input.replace(RE_PLUS, '<br class="br-non-mobile"/>');
      input = input.replace(RE_TILDE, '<br class="br-mobile"/>');
      input = input.replace(RE_DOLLAR, '<br/>');
      input = input.replace(RE_SHY, '&shy;');
      return input;
    },

    svg(filename) {
      const content = fs.readFileSync(path.join(context.source, filename));
      const svg = content.toString('utf8'); 
      return svg;
    },

    stringToCharArray(string) {
      return string.split('').map((x, i) => string.charCodeAt(i));
    },

    obfuscatedMailtoOnclick(address) {
      const arr = JSON.stringify(address.split('').map(x => x.charCodeAt(0)));
      return `javascript: this.href="mailto:"+JSON.parse(${JSON.stringify(arr)},function(k, v){return typeof v === "number" ? String.fromCharCode(v): v;}).join('');`;
    },

    obfuscateEmailAddress(address) {
      let [ username, domain ] = address.split('@'); 
      return [
        username.replace(".", "<!--nospam-->&#46;"),
        `<span style="display:none;">@spam.com spam</span>`,
        `&#64;<!--nospam-->`,
        domain.replace(".", "<!--nospam-->&#46;"),
        `<span style="display:none;"> no@spam.com</span>`,
      ].join('');
    },

    obfuscate(type, value, options = {}) {
      if(!value) return;
      switch(type) {
        case 'email':
          const parts = value.split('.') 
          const tld = parts.pop();
          const [ username, domain ] = parts.join('.').split('@');
          let result = options.proto ? 'mailto:' : ''
          result += domain;
          if(options.comment) result += "<!-- nospam -->";
          result += options.entities ? "&#64;" : '@';
          if(options.comment) result += "<!-- nospam -->";
          result += username;
          result += options.entities ? "&#46;" : ".";
          result += tld;
          return result;

        case 'phone':
          return `tel:${value.split(':')[1].split(' ').reverse().join(' ').replace(/ /g, '')}`;
      }
    }
  }
};
