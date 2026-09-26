import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { DocumentSearch } from '../src/components/DocumentSearch';

it('keeps the field focused after Return', () => {
  const frames: Array<(time: number) => void> = [];
  jest
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation(callback => {
      frames.push(callback);
      return 1;
    });
  const onActive = jest.fn();
  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <DocumentSearch
        query="alpha"
        count={2}
        active={0}
        capped={false}
        onQuery={() => {}}
        onActive={onActive}
      />,
    );
  });

  const focus = jest.fn();
  const field = tree!.root.findByType(TextInput);
  const host = field.findAll(() => true).find(node => node.instance != null);
  if (host?.instance != null) {
    host.instance.focus = focus;
  }

  ReactTestRenderer.act(() => {
    field.props.onSubmitEditing();
  });

  expect(onActive).toHaveBeenCalledWith(1);
  expect(focus).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => {
    frames.forEach(callback => callback(0));
  });

  expect(focus).toHaveBeenCalledTimes(2);
});
