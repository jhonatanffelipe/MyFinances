// Metro com o pacote compartilhado packages/core (TypeScript puro, resolvido pelo fonte).
// Não usa workspace hoisted: o mobile (React 19) e o desktop (React 18) mantêm
// node_modules separados; o core não tem dependências de runtime.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const coreRoot = path.resolve(projectRoot, '../packages/core');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders || []), coreRoot];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@myfinances/core': path.join(coreRoot, 'src'),
};
// Arquivos do core resolvem dependências só a partir do node_modules do mobile
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
