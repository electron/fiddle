import { Component, ComponentClass, createElement, createRef } from 'react';

import { render } from '@testing-library/react';

type ComponentConstructor<P = object, S = object> = new (
  props: P,
) => Component<P, S>;

/**
 * Renders a class component and returns the render result alongside the
 * component's instance.
 */
export function renderClassComponentWithInstanceRef<
  C extends ComponentConstructor = ComponentConstructor,
  P extends C extends ComponentClass<infer Props>
    ? Props
    : never = C extends ComponentClass<infer Props> ? Props : never,
  I = InstanceType<C>,
>(
  ClassComponent: C,
  props: P,
): {
  instance: I;
  renderResult: ReturnType<typeof render>;
} {
  // Hack: unlike Enzyme, RTL doesn't expose class components' instances, so we
  // need to improvise and pass a `ref` to get access to this instance.
  const ref = createRef<I>();

  const renderResult = render(
    createElement(ClassComponent, {
      ...props,
      ref,
    }),
  );

  return {
    instance: ref.current!,
    renderResult,
  };
}
