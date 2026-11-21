import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import type { OperationsRole } from '@/src/shared/contracts/session';

type Experience = { role: OperationsRole; selectRole: (role: OperationsRole) => void };
const Context = createContext<Experience | null>(null);

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const fallback: OperationsRole = session?.roles.includes('Cliente') ? 'Cliente' : 'Profissional';
  const [choice, setChoice] = useState<{ userId: string; role: OperationsRole } | null>(null);
  const role = choice && choice.userId === session?.userId && session.roles.includes(choice.role) ? choice.role : fallback;
  useEffect(() => { if (!session) setChoice(null); }, [session]);
  const value = useMemo(() => ({ role, selectRole: (next: OperationsRole) => {
    if (session?.roles.includes(next)) setChoice({ userId: session.userId, role: next });
  } }), [role, session]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useExperience() {
  const value = useContext(Context);
  if (!value) throw new Error('Experiência deve estar dentro do provedor de navegação');
  return value;
}
