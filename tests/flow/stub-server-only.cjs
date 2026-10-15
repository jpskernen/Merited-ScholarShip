const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'server-only') return {};
  return originalLoad.call(this, request, ...rest);
};
