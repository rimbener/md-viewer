module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // These dependencies ship untranspiled ESM, so Babel has to process them.
  transformIgnorePatterns: [
    'node_modules/(?!(?:jest-)?react-native|@react-native(-community)?|@dr\\.pogodin/react-native-fs|react-native-document-picker-macos|http-status-codes)/',
  ],
};
