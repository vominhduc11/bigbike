const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const server = ['server.js', 'bigbike-web/server.js'].find(file => fs.existsSync(path.join(__dirname, file)));
if (!server) throw Error('Standalone entrypoint missing');
const directory = path.dirname(path.join(__dirname, server));
const entrypoint = path.join(directory, 'docker-entrypoint.mjs');
if (!fs.existsSync(entrypoint)) throw Error('Production startup entrypoint missing');
process.chdir(directory);
import(pathToFileURL(entrypoint).href).catch(() => {
  console.error('Production startup entrypoint failed');
  process.exitCode = 1;
});
