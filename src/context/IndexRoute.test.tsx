import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import Index from '@/src/app/index';

const mock = vi.hoisted(() => ({ status: 'loading' as 'loading' | 'anonymous' | 'authenticated' }));
vi.mock('@/src/context/AuthContext', () => ({ useAuth: () => ({ status: mock.status }) }));
vi.mock('expo-router', async () => {
  const react = await import('react');
  return { Redirect: ({ href }: { href: string }) => react.createElement('redirect', { href }) };
});

it('aguarda a sessão antes de direcionar para entrada ou início', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mock.status = 'loading';
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<Index />); });
  expect(view.toJSON()).toBeNull();
  mock.status = 'anonymous';
  await act(async () => view.update(<Index />));
  expect(view.root.findByType('redirect' as React.ElementType).props.href).toBe('/login');
  mock.status = 'authenticated';
  await act(async () => view.update(<Index />));
  expect(view.root.findByType('redirect' as React.ElementType).props.href).toBe('/home');
  await act(async () => view.unmount());
});
