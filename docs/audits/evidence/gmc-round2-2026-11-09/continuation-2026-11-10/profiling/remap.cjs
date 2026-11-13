const Module = require('node:module');
const path = require('node:path');
const root = '/tmp/bigbike-gmc-continue-20261110/isolated-web';
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...args) {
  if (typeof request === 'string' && request.startsWith('/app/')) request = path.join(root, request.slice(5));
  if (parent && typeof parent.filename === 'string' && parent.filename.startsWith('/app/')) {
    parent = {...parent, filename: path.join(root, parent.filename.slice(5)), paths: Module._nodeModulePaths(path.join(root, 'node_modules'))};
    if (request.startsWith('.')) request = path.resolve(path.dirname(parent.filename), request);
  }
  return resolve.call(this, request, parent, ...args);
};
