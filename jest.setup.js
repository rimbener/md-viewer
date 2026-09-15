// Both libraries resolve native modules at import time, which is unavailable
// under Jest. Every test drives them through these mocks instead.
jest.mock('@dr.pogodin/react-native-fs', () => ({
  readDir: jest.fn(async () => []),
  readFile: jest.fn(async () => ''),
  exists: jest.fn(async () => true),
}));

jest.mock('react-native-document-picker-macos', () => ({
  pickDirectory: jest.fn(async () => []),
  pickFile: jest.fn(async () => []),
}));

// AsyncStorage talks to a native module; tests drive this in-memory stand-in.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async key => (store.has(key) ? store.get(key) : null)),
      setItem: jest.fn(async (key, value) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async key => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
    },
  };
});
