module.exports = function override(config) {
  config.resolve = {
    ...(config.resolve || {}),
    fallback: {
      ...(config.resolve ? config.resolve.fallback : {}),
      crypto: require.resolve('crypto-browserify')
    }
  };
  return config;
};
