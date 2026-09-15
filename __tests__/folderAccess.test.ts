/**
 * Which dialog asks for the folder. The native panel is preferred because it
 * shows hidden files; the packaged picker only stands in when the native
 * module is absent.
 */

import { NativeModules } from 'react-native';
import { pickDirectory } from 'react-native-document-picker-macos';

const picker = pickDirectory as jest.Mock;
const modules = NativeModules as { FolderAccess?: { choose: jest.Mock } };

/** Loads the module fresh: it reads the native module once, on import. */
function load(): typeof import('../src/folderAccess') {
  let api: typeof import('../src/folderAccess');
  jest.isolateModules(() => {
    api = require('../src/folderAccess');
  });
  return api!;
}

beforeEach(() => {
  jest.clearAllMocks();
  picker.mockResolvedValue([]);
});

afterEach(() => {
  delete modules.FolderAccess;
});

it('asks the native panel and answers with the chosen path', async () => {
  modules.FolderAccess = { choose: jest.fn(async () => '/notes') };

  await expect(load().askForFolder()).resolves.toBe('/notes');
  expect(picker).not.toHaveBeenCalled();
});

it('answers null when the native panel was cancelled', async () => {
  modules.FolderAccess = { choose: jest.fn(async () => null) };

  await expect(load().askForFolder()).resolves.toBeNull();
});

it('falls back to the packaged picker without the native module', async () => {
  picker.mockResolvedValue([{ path: '/notes' }]);

  await expect(load().askForFolder()).resolves.toBe('/notes');
  expect(picker).toHaveBeenCalled();
});

it('answers null when the packaged picker was cancelled', async () => {
  await expect(load().askForFolder()).resolves.toBeNull();
});
