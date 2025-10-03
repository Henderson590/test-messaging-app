const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration for Firebase
config.resolver.assetExts.push('cjs');

module.exports = config;
