import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperienceProvider, useExperience } from './ExperienceContext';

let currentSession: { userId: string; roles: ('Cliente' | 'Profissional')[] } | null = null;
vi.mock('./AuthContext', () => ({ useAuth: () => ({ session: currentSession }) }));
function Probe() {
  const { role, selectRole } = useExperience();
  return <probe role={role} onChange={selectRole} />;
}
declare module 'react' { namespace JSX { interface IntrinsicElements { probe: any } } }

describe('experiência por papel', () => {
  beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); });
  it('permite alternar somente entre papéis autorizados e não transfere a escolha para outra conta', async () => {
    currentSession = { userId: 'a', roles: ['Cliente', 'Profissional'] };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ExperienceProvider><Probe /></ExperienceProvider>); });
    expect(view.root.findByType('probe').props.role).toBe('Cliente');
    await act(async () => view.root.findByType('probe').props.onChange('Profissional'));
    expect(view.root.findByType('probe').props.role).toBe('Profissional');
    currentSession = { userId: 'b', roles: ['Cliente'] };
    await act(async () => view.update(<ExperienceProvider><Probe /></ExperienceProvider>));
    expect(view.root.findByType('probe').props.role).toBe('Cliente');
    await act(async () => view.root.findByType('probe').props.onChange('Profissional'));
    expect(view.root.findByType('probe').props.role).toBe('Cliente');
    await act(async () => view.unmount());
  });
});
