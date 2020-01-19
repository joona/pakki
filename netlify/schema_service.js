const path = require('path');
const yaml = require('node-yaml');

const { readDocuments, readDocument } = require('../yaml_tasks');

const INTERNAL_DOC_FIELDS = new Set('_file', '_key', '_source');

/*
 *
  switch(widget) {
    case 'node-object':
      def = createNodeObjectField(service, def, data);
      break;
    case 'node-list':
      def = createNodeListField(service, def, data);
      break;
    case 'dynamic-node-list':
      return createHiddenField(field);
    case 'keyed-node-mapping':
      def = createKeyedNodeMappingField(service, def, data);
      break;
  }
*/

const fieldMappers = {
  'node-object': {
    handler: createNodeObjectField,
  },

  'node-list': {
    handler: createNodeListField
  },

  'dynamic-node-list': {
    // eslint-disable-next-line
    handler: createDynamicNodeListField
  },
  
  'keyed-node-mapping': {
    handler: createKeyedNodeMappingField
  }
};

function log(...args) {
  console.log('[NetlifyAdminService]', ...args);
}

function relativeAdminPath(ctx, file) {
  const source = path.join(ctx.source, '..');
  return path.relative(source, file);
}

function joinAdminPath(ctx, ...args) {
  return path.relative(path.join(ctx.source, '..'), path.join(ctx.source, ...args));
}

function keyedFields(fields) {
  return fields.reduce((obj, x) => {
    obj[x.name] = x;
    return obj;
  }, {});
}

/*
function arrayFields(fieldMap) {
  return Object.values(fieldMap);
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

*/

function processNodeFields(service, node, data) {
  return node.fields.map(x => {
    return handleField(service, x, data);
  });
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

function createDynamicNodeListField(service, field) {
  const { types } = field;

  const processedTypes = types.map(type => {
    type.widget = type.widget || 'object';
    
    if(type.node) {
      const node = service.getNode(type.node);
      type.fields = processNodeFields(service, node);
    } else {
      type.fields = type.fields.map(field => {
        return handleField(service, field);
      });
    }

    return type;
  });

  return {
    ...field,
    widget: 'list',
    types: processedTypes
  };
}

function createKeyedNodeMappingField(service, field, data) {
  const { name, mapping } = field;
  delete field.mapping;

  if(!data) {
    return createHiddenField(field);
  }

  const fieldData = data[name];
  if(!fieldData || typeof fieldData !== 'object' || Array.isArray(fieldData)) {
    return createHiddenField(field);
  }

  const fields = [];
  const keys = Object.keys(fieldData);

  keys.forEach(key => {
    const node = service.getNodeFromMapping(mapping, key);
    const objectFields = processNodeFields(service, node, data);

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

function createNodeListField(service, field, data) {
  const { name, node } = field;
  delete field.node;

  let fieldData = null;
  if(data && data[name] && Array.isArray(data[name])) {
    fieldData = data[name];
  }

  const nodeSchema = service.getNode(node);
  const nodeFields = processNodeFields(service, nodeSchema, fieldData);

  return {
    ...field,
    widget: 'list',
    fields: nodeFields
  };
}

function createNodeObjectField(service, field, doc) {
  const fields = processNodeFields(service, service.getNode(field.node), doc);

  delete field.node;

  return {
    ...field,
    widget: 'object',
    fields
  };
}

function handleField(service, field, data) {
  const { widget } = field;
  let def = { ...field };

  let maybeFieldMapper = fieldMappers[widget];
  if(maybeFieldMapper) {
    def = maybeFieldMapper.handler(service, def, data);
  }
  
  // show only if value exists in the doc
  if(def.when_exists) {
    delete def.when_exists;
    if(!data || !fieldExists(data, def)) {
      return createHiddenField(def);
    }
  }

  return def;
}

function traverseTemplateSchema(service, templateSchema, template, doc) {
  //let docSettings = doc.__admin || {};
  //let schemaFields = keyedFields(templateSchema.fields);
  let fields = [];

  if(doc.__admin) {
    fields.push({
      widget: 'hidden',
      name: '__admin'
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
    if(INTERNAL_DOC_FIELDS.has(key)) return;
    if(!keyed[key]) {
      fields.push({
        widget: 'hidden',
        name: key
      });
    }
  });

  return fields;
}

function createFolderFieldsSchema(service, template) {
  const templateSchema = service.getTemplate(template);
  const fields = [];

  templateSchema.fields.forEach(f => {
    const processed = handleField(service, f);
    if(processed) fields.push(processed);
  });

  return fields;
}

function createFileSchema(service, collection, template, doc, options = {}) {
  const templateSchema = service.getTemplate(template);
  const fields = traverseTemplateSchema(service, templateSchema, template, doc);

  let displayTitle = doc.title || doc._key;
  //console.log('displayTitle:', displayTitle, collection.displayKey, doc[collection.displayKey]);
  if(collection.displayKey && doc[collection.displayKey]) {
    displayTitle = doc[collection.displayKey];
  }

  return {
    label: options.label || displayTitle || doc._key,
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
      throw new Error('netlify admin settings not defined');
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
    //console.log(this.ctx);
    log('loading schema...');
    const settings = await yaml.read(path.join(this.ctx.source, 'settings.yml'));
    this.cmsSettings = settings.cms;
    this.settings = settings;

    log('loading mappings...');
    this.mappings = settings.mappings || {};

    log('loading templates...');
    const templates = await readDocuments(this.ctx, 'templates/*.yml');
    this.handleTemplates(templates);

    log('loading nodes...');
    const nodes = await readDocuments(this.ctx, 'nodes/*.yml');
    this.nodes = nodes.reduce((m, x) => {
      m[x.slug] = x;
      return m;
    }, {});

  }

  async handleTemplates(templates) {
    this.templates = templates.reduce((m, x) => {
      m[x.slug] = x;
      return m;
    }, {});

    function extendFieldsFromTemplate(service, originalFields, templateName) {
      const template = service.getTemplate(templateName);
      let fields = [ ...template.fields ];
      if(template.extends) {
        fields = extendFieldsFromTemplate(service, fields, template.extends);
      }

      return [ ...fields, ...originalFields ];
    }

    Object.values(this.templates).forEach(template => {
      if(template.extends) {
        template.fields = extendFieldsFromTemplate(this, template.fields, template.extends);
      }
    });
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
      ...this.cmsSettings, // base cms settings
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
      case 'folder':
        collectionDefinition = await this.createFolderCollection(collection);
        break;
      default:
        console.warn('unknown collection');
        break;
    }

    if(collectionDefinition) {
      this.collections[collection.name] = collectionDefinition;
    }
  }

  async createFolderCollection(collection) {
    const { name, label, template, create, folder } = collection;
    const options = collection.options || {};
    const def = {
      name, label, 
      create: create || false,
      fields: [],
      ...options
    };

    //const templateSchema = this.getTemplate(template);
    def.folder = joinAdminPath(this.originalContext, folder);
    def.fields = createFolderFieldsSchema(this, template);
    return def;
  }

  async createSpecificFilesCollection(collection, definition) {
    const files = await Promise.all(collection.files.map(async x => {
      const { label } = x;
      const fileTemplate = x.template || collection.template;

      const filePath = path.join(this.originalContext.source, x.path);
      const doc = await readDocument(this.originalContext, filePath, this.originalContext.source);

      const relativePath = relativeAdminPath(this.originalContext, doc._source);
      doc._file = relativePath;

      return createFileSchema(this, collection, fileTemplate, doc, {
        label
      });
    }));

    definition.files = files;
    return definition;
  }

  async createFileTreeCollection(collection) {
    const { name, label, pattern, template } = collection;
    const options = collection.options || {};
    const def = {
      name, label,
      files: [],
      ...options
    };

    if(collection.files) {
      return this.createSpecificFilesCollection(collection, def);
    }
    
    //const templateSchema = this.getTemplate(template);
    const documents = await readDocuments(this.originalContext, pattern);
    
    def.files = documents.map(doc => {
      const relativePath = relativeAdminPath(this.originalContext, doc._source);
      doc._file = relativePath;
      return createFileSchema(this, collection, template, doc);
    });

    return def;
  }
}


module.exports = {
  async generateAdminConfig(ctx) {
    const adminContext = { ...ctx };

    const service = new NetlifyAdminService(adminContext);
    await service.loadSchema();

    const schema = await service.generateConfig();
    //console.log('schema:', require('util').inspect(schema, true, 10));
    await yaml.write(path.join(service.dest, 'config.yml'), schema);
  }
};
