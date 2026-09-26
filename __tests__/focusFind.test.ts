import { NativeEventEmitter, NativeModules } from 'react-native';

import { onFocusFind } from '../src/focusFind';

it('calls focus when the find command arrives', () => {
  const focus = jest.fn();
  NativeModules.FindFocus = {
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };
  const listeners: Array<() => void> = [];
  const spy = jest
    .spyOn(NativeEventEmitter.prototype, 'addListener')
    .mockImplementation((event, callback) => {
      if (event === 'focusFind') {
        listeners.push(callback as () => void);
      }
      return { remove: jest.fn() } as unknown as ReturnType<
        NativeEventEmitter['addListener']
      >;
    });

  const stop = onFocusFind(focus);
  listeners.forEach(call => call());
  stop();

  expect(focus).toHaveBeenCalledTimes(1);
  spy.mockRestore();
  delete NativeModules.FindFocus;
});

it('does nothing when the native module is absent', () => {
  delete NativeModules.FindFocus;
  const focus = jest.fn();

  const stop = onFocusFind(focus);
  stop();

  expect(focus).not.toHaveBeenCalled();
});
