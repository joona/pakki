const path = require('path');
const yaml = require('node-yaml');

const { readDocuments } = require('../yaml_tasks');

function log(...args) {
  console.log('[NetlifyAdminService]', ...args);
}

function relativeAdminPath(ctx, file) {
  const source = path.join(ctx.source, '..');
  return path.relative(source, file);
}

function keyedFields(fields) {
  return fields.reduce((obj, x) => {
    obj[x.name] = x;
    return obj;
  }, {});
}

function arrayFields(fieldMap) {
  return Object.values(fieldMap);
}

function processNodeFields(service, node, doc) {
  return node.fields.map(x => {
    return handleField(service, x, doc);
  });
}

function hideField(fields, schema, fieldName) {
  const maybeField = fields.find(x => x.name === fieldName);
  if(maybeField) {
    const idx = fields.indexOf(maybeField);
    fields.splice(idx, 1);
  }
}

function appendField(fields, schema, field) {
  fields.push(field);
}

function fieldExists(doc, field) {
  const value = doc[field.name];
  return value !== null && value !== undefined;
}

function createHiddenField(field) {
  return {
    name: field.name,
    widget: 'hidden'
  };
}

function createObjectField(options = {}) {
  return {
    widget: 'object',
    ...options
  };
}

function createKeyedNodeMappingField(service, field, doc) {
  const { name, mapping } = field;
  delete field.mapping;

  const data = doc[name];
  if(!data || typeof data !== 'object' || Array.isArray(data)) {
    return createHiddenField(field);
  }
  
  const fields = [];
  const keys = Object.keys(data);

  keys.forEach(key => {
    const node = service.getNodeFromMapping(mapping, key);
    const objectFields = processNodeFields(service, node, doc);

    fields.push(createObjectField({
      fields: objectFields,
      name: key,
      label: key,
      required: true 
    }));
  });

  return {
    ...field,
    widget: 'object',
    fields
  };
}

function createNodeListField(service, field, doc) {
  const { name, node } = field;
  delete field.node;

  const data = doc[name] || [];

  const nodeSchema = service.getNode(node);
  const nodeFields = processNodeFields(service, nodeSchema, data);

  return {
    ...field,
    widget: 'list',
    fields: nodeFields
  };
}

function handleField(service, field, doc) {
  const { widget } = field;
  let def = { ...field };

  switch(widget) {
    case 'node-object':
      def.widget = 'object';
      def.fields = processNodeFields(service, service.getNode(field.node), doc);
      delete def.node;
      break;
    case 'node-list':
      def = createNodeListField(service, def, doc);
      break;
    case 'dynamic-node-list':
      return createHiddenField(field);
    case 'keyed-node-mapping':
      def = createKeyedNodeMappingField(service, def, doc);
      break;
  }

  // show only if value exists in the doc
  if(def.when_exists) {
    delete def.when_exists;
    if(!fieldExists(doc, def)) {
      return createHiddenField(def);
    }
  }

  return def;
}

function traverseTemplateSchema(service, templateSchema, template, doc) {
  let docSettings = doc.__cms || {};
  let fields = [];

  let schemaFields = keyedFields(templateSchema.fields);

  if(doc.__cms) {
    fields.append({
      widget: 'hidden',
      name: '__cms'
    });
  }

  //const { appendFields, removeFields } = docSettings;

  templateSchema.fields.forEach(f => {
    const processed = handleField(service, f, doc);
    if(processed) fields.push(processed);
  });

  // mark all unknown fields hidden to pass them through
  const keyed = keyedFields(fields);
  Object.keys(doc).forEach(key => {
    if(!keyed[key]) {
      fields.push({
        widget: 'hidden',
        name: key
      });
    }
  });

  return fields;
}

function createFileSchema(service, template, doc) {
  const templateSchema = service.getTemplate(template);
  const fields = traverseTemplateSchema(service, templateSchema, template, doc);

  return {
    label: doc.title || doc._key,
    name: doc._key,
    file: doc._file,
    fields: fields
  };
}

class NetlifyAdminService {
  constructor(ctx) {
    this.ctx = ctx;
    this.originalContext = { ...ctx };

    const netlifySettings = ctx.netlifySettings || {};
    const adminSettings = netlifySettings.admin;

    if(!adminSettings) {
      throw new Error(`netlify admin settings not defined`);
    }

    this.adminSettings = adminSettings;
    this.source = path.join(ctx.source, adminSettings.source);
    this.dest = path.join(ctx.dest, adminSettings.dest);

    this.ctx.source = path.join(ctx.source, adminSettings.source);
    this.ctx.dest = path.join(ctx.dest, adminSettings.dest);

    this.nodes = {};
    this.templates = {};
    this.collections = {};
    this.mappings = {};
    this.adminSettings = {};
  }

  async loadSchema() {
    console.log(this.ctx);
    log('loading schema...');
    const settings = await yaml.read(path.join(this.ctx.source, 'settings.yml'));
    this.baseSettings = settings.cms;
    delete settings.cms;
    this.settings = settings;

    log('loading mappings...');
    this.mappings = settings.mappings || {};

    log('loading templates...');
    const templates = await readDocuments(this.ctx, 'templates/*.yml');
    this.templates = templates.reduce((m, x) => {
      m[x.slug] = x;
      return m;
    }, {});

    log('loading nodes...');
    const nodes = await readDocuments(this.ctx, 'nodes/*.yml');
    this.nodes = nodes.reduce((m, x) => {
      m[x.slug] = x;
      return m;
    }, {});

  }

  async generateConfig() {
    const { collections, backend } = this.settings;
    let inject = {};

    if(!this.originalContext.development) {
      const branch = this.originalContext.branch || 'master';
      if(backend.branch) backend.branch = branch;
      inject.backend = backend;
    }

    await Promise.all(collections.map(x => {
      return this.createCollection(x);
    }));

    return {
      ...this.baseSettings,
      ...inject,
      collections: Object.values(this.collections)
    };
  }

  getTemplate(templateName) {
    const template = this.templates[templateName];
    if(!template) throw new Error(`template not found: ${templateName}`);
    return { ...template };
  }

  getNode(nodeName) {
    const node = this.nodes[nodeName];
    if(!node) throw new Error(`node not found: ${nodeName}`);
    return { ...node };
  }

  getNodeFromMapping(mappingName, propertyKey) {
    const mapping = this.mappings[mappingName];
    if(!mapping) throw new Error(`mapping not found: ${mappingName}`);

    let nodeName = mapping.default;
    if(mapping.mapping[propertyKey]) {
      nodeName = mapping.mapping[propertyKey];
    }

    return this.getNode(nodeName);
  }

  async createCollection(collection) {
    const { type } = collection;
    let collectionDefinition;

    switch(type) {
      case 'files':
        collectionDefinition = await this.createFileTreeCollection(collection);
        break;
      default:
        console.warn('unknown collection');
        break;
    }

    if(collectionDefinition) {
      this.collections[collection.name] = collectionDefinition;
    }
  }

  async createFileTreeCollection(collection) {
    const { name, label, pattern, template } = collection;
    const def = {
      name, label,
      files: []
    };

    const templateSchema = this.templates[template];
    if(!templateSchema) {
      throw new Error(`unknown template schema: ${template}`);
    }

    const documents = await readDocuments(this.originalContext, pattern);
    
    def.files = documents.map(doc => {
      console.log('DOC:', doc);
      const relativePath = relativeAdminPath(this.originalContext, doc._source);
      doc._file = relativePath;
      return createFileSchema(this, template, doc);
    });

    return def;
  }
}


module.exports = {
  async generateAdminConfig(ctx) {
    const adminContext = { ...ctx };

    const service = new NetlifyAdminService(adminContext);
    await service.loadSchema();

    console.log('netlifyAdminService:', service);
    const schema = await service.generateConfig();
    console.log(JSON.stringify(schema, true, 2));

    await yaml.write(path.join(service.dest, 'config.yml'), schema);
  }
};
