const {
  expoImportMetaTransformPluginFactory,
} = require("babel-preset-expo/build/import-meta-transform-plugin");

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          unstable_transformImportMeta: true,
          native: {
            unstable_transformImportMeta: true,
          },
        },
      ],
    ],
    plugins: [expoImportMetaTransformPluginFactory(true)],
  };
};