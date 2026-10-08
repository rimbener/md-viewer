import { NativeEventEmitter, NativeModules } from 'react-native';

const modules = NativeModules as {
  OpenedFile?: {
    take: jest.Mock;
    addListener: jest.Mock;
    removeListeners: jest.Mock;
  };
};

function load(): typeof import('../src/openedFile') {
  let api: typeof import('../src/openedFile');
  jest.isolateModules(() => {
    api = require('../src/openedFile');
  });
  return api!;
}

afterEach(() => {
  delete modules.OpenedFile;
});

it('answers null when Finder opened nothing', async () => {
  await expect(load().takeOpenedFile()).resolves.toBeNull();
});

it('answers the path Finder handed over at launch', async () => {
  modules.OpenedFile = {
    take: jest.fn(async () => '/opened/readme.md'),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };

  await expect(load().takeOpenedFile()).resolves.toBe('/opened/readme.md');
});

it('reports a file Finder opens later', () => {
  modules.OpenedFile = {
    take: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };
  const onOpen = jest.fn();
  const listeners: Array<(event: { path: string }) => void> = [];
  const spy = jest
    .spyOn(NativeEventEmitter.prototype, 'addListener')
    .mockImplementation((event, callback) => {
      if (event === 'openedFile') {
        listeners.push(callback as (event: { path: string }) => void);
      }
      return { remove: jest.fn() } as unknown as ReturnType<
        NativeEventEmitter['addListener']
      >;
    });

  const stop = load().watchOpenedFile(onOpen);
  listeners.forEach(call => call({ path: '/opened/other.md' }));
  stop();

  expect(onOpen).toHaveBeenCalledWith('/opened/other.md');
  spy.mockRestore();
});

it('does nothing when the native module is absent', () => {
  const onOpen = jest.fn();

  const stop = load().watchOpenedFile(onOpen);
  stop();

  expect(onOpen).not.toHaveBeenCalled();
});
