module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel',
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@app': './app',
            '@components': './src/components',
            '@hooks': './src/hooks',
            '@services': './src/services',
            '@store': './src/store',
            '@types': './src/types',
            '@utils': './src/utils',
            '@constants': './src/constants',
            '@config': './src/config',
          },
        },
      ],
    ],
  };
};
