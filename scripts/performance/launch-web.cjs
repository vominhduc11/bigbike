const fs = require('node:fs');
const path = require('node:path');
const server = ['server.js', 'bigbike-web/server.js'].find(file => fs.existsSync(path.join(__dirname, file)));
if (!server) throw Error('Standalone entrypoint missing');
require(path.join(__dirname, server));
