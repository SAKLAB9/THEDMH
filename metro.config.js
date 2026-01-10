const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// 웹에서 react-native-pager-view 제외
config.resolver.platforms = ['web', 'ios', 'android', 'native'];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-pager-view') {
    return {
      type: 'empty',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { 
  input: './global.css',
  configPath: './tailwind.config.js'
});

