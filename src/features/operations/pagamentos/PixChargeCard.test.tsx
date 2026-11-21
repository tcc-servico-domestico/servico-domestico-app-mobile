import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PixChargeCard } from './PixChargeCard';
import type { Pagamento } from '@/src/features/operations/contracts/pagamentos';

const clipboard = vi.hoisted(() => ({ setStringAsync: vi.fn() }));
vi.mock('expo-clipboard', () => clipboard);
vi.mock('react-native-qrcode-svg', () => ({ default: () => null }));
vi.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({ default: () => null }));
vi.mock('react-native', async () => {
  const react = await import('react');
  const element = (name: string) => ({ children, ...props }: { children?: React.ReactNode }) => react.createElement(name, props, children);
  return { View: element('view'), Text: element('text'), Pressable: element('button'), StyleSheet: { create: (value: unknown) => value } };
});

const payment: Pagamento = { id: 'p', servicoId: 's', valor: 80, moeda: 'BRL', status: 'Pendente', custodiaStatus: 'NaoIniciada', requestedAt: '2026-01-01T00:00:00Z', aggregateVersion: 1, transacoes: [] };
const tracked = { pagamentoId: 'p', servicoId: 's', pixCopiaECola: 'CODIGO-SINTETICO', expiraEm: '2099-01-01T00:00:00Z' };

describe('cartão Pix', () => {
  beforeEach(() => { vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); });
  it('permite copiar código válido sem declarar pagamento confirmado', async () => {
    clipboard.setStringAsync.mockResolvedValue(undefined);
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<PixChargeCard pagamento={payment} tracked={tracked} />); });
    await act(async () => { view.root.findByType('button').props.onPress(); });
    expect(clipboard.setStringAsync).toHaveBeenCalledWith('CODIGO-SINTETICO');
    expect(JSON.stringify(view.toJSON())).toContain('A situação só muda após confirmação do pagamento');
    await act(async () => { view.unmount(); });
  });
  it('não oferece cópia ou código quando o Pix expirou', async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<PixChargeCard pagamento={payment} tracked={{ ...tracked, expiraEm: '2020-01-01T00:00:00Z' }} />); });
    expect(view.root.findAllByType('button')).toHaveLength(0);
    expect(JSON.stringify(view.toJSON())).toContain('Código Pix expirado');
    expect(JSON.stringify(view.toJSON())).not.toContain('CODIGO-SINTETICO');
    await act(async () => { view.unmount(); });
  });
  it('informa falha de cópia sem afirmar pagamento', async () => {
    clipboard.setStringAsync.mockRejectedValue(new Error('falha'));
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<PixChargeCard pagamento={payment} tracked={tracked} />); });
    await act(async () => { view.root.findByType('button').props.onPress(); });
    expect(JSON.stringify(view.toJSON())).toContain('Não foi possível copiar o código');
    expect(JSON.stringify(view.toJSON())).not.toContain('Código Pix copiado');
    await act(async () => view.unmount());
  });
  it('revalida a expiração no momento da cópia', async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<PixChargeCard pagamento={payment} tracked={tracked} />); });
    const now = vi.spyOn(Date, 'now').mockReturnValue(new Date('2100-01-01T00:00:00Z').valueOf());
    try {
      await act(async () => { view.root.findByType('button').props.onPress(); });
      expect(clipboard.setStringAsync).not.toHaveBeenCalled();
      expect(JSON.stringify(view.toJSON())).toContain('Código Pix indisponível ou expirado');
    } finally { now.mockRestore(); await act(async () => view.unmount()); }
  });

  it('não mostra instruções ou código Pix na experiência profissional', async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<PixChargeCard pagamento={payment} tracked={tracked} showPixInstructions={false} />); });
    const output = JSON.stringify(view.toJSON());
    expect(output).toContain('Pagamento simulado');
    expect(output).not.toContain('CODIGO-SINTETICO');
    expect(output).not.toContain('Pix copia e cola');
    expect(view.root.findAllByType('button')).toHaveLength(0);
    await act(async () => view.unmount());
  });

});
