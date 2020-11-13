const bluebird = require('bluebird');
const path = require('path');

const { glob, readFile } = require('./utils');
const { readDocument, readDocuments } = require('./yaml_tasks');
const { readFrontMatterFile, readFrontMatterFiles } = require('./frontmatter_tasks');

const tasks = module.exports = {
  async readJSONDocument(ctx, file, relativePath) {
    const raw = await readFile(file);
    const relativeFilePath = path.relative(relativePath, file);
    const fileKey = path.basename(relativeFilePath, path.extname(file));

    let rawContent;
    let content;
    try {
      rawContent = JSON.parse(raw);
    } catch(err) {
      console.error('Malformed JSON document:', file, relativePath);
      console.error(err.stack);
      throw err;
    }

    // if JSON content is not an object, do not try to assign it to top level
    if(typeof rawContent === 'object' && !Array.isArray) {
      content = rawContent;
    } else {
      content = { data: rawContent };
    }

    return {
      slug: fileKey || content.slug,
      ...content,
      _source: file,
      _key: fileKey,
      _path: relativeFilePath
    };
  },

  readDocument(ctx, file, relativePath) {
    const ext = path.extname(file);

    switch(ext) {
      case '.yaml':
      case '.yml':
        return readDocument(ctx, file, relativePath);
      case '.md':
        return readFrontMatterFile(ctx, file, relativePath);
      case '.json':
        return tasks.readJSONDocument(ctx, file, relativePath);
      default:
        console.warn('[pakki:readPageDocuments] unsupported file extension', ext);
        return;
    }
  },

  async readDocuments(ctx, globPattern) {
    const { source } = ctx;
    const fullPath = path.join(source, globPattern);
    const relativePath = path.dirname(fullPath);
    const files = await glob(fullPath);

    const items = await bluebird.map(files, file => {
      return tasks.readDocument(ctx, file, relativePath);
    });

    let documents = items.filter(x => !!x);
    console.log('[readPageDocuments] processed', items.length, 'files and found', documents.length, 'documents');
    return documents;
  },

  // expose separate modules for convenience
  readYAMLDocument: readDocument,
  readYAMLDocuments: readDocuments,
  readFrontMatterDocument: readFrontMatterFile,
  readFrontMatterDocuments: readFrontMatterFiles,
}
