module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // 'react-native-reanimated/plugin', // Temporarily removed as text-on-story feature is disabled
    ],
  };
};
