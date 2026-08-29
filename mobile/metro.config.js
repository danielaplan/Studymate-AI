const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Workaround (2026-08-30): `@expo/google-fonts/playfair-display` and
// `@expo/google-fonts/inter` fail to resolve as bare module specifiers in this
// environment — Metro reports "could not be found" even though the packages are
// installed and valid at node_modules/@expo-google-fonts/*, and a relative
// require of their index.js succeeds. Intercept these two specifiers and return
// the exact entry path. All other modules delegate to Metro's normal resolver.
// (Not a missing package: reinstalls + cache clears did not help and resolution
// is deterministic. See CHANGES.md section 9.)
const FONT_MODULES = {
  '@expo/google-fonts/playfair-display': path.resolve(
    projectRoot,
    'node_modules/@expo-google-fonts/playfair-display/index.js'
  ),
  '@expo/google-fonts/inter': path.resolve(
    projectRoot,
    'node_modules/@expo-google-fonts/inter/index.js'
  ),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (FONT_MODULES[moduleName]) {
    return { filePath: FONT_MODULES[moduleName], type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
