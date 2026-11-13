import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Button, StyleSheet, Text, View } from 'react-native';

import type { Pagamento } from '@/src/features/operations/contracts/pagamentos';
import type { TrackedPixCharge } from './paymentTrackingStore';
import { isPixExpired, paymentStatusLabel } from './paymentPresentation';

interface Props {
  readonly pagamento: Pagamento;
  readonly tracked: TrackedPixCharge | undefined;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

function money(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function PixChargeCard({ pagamento, tracked }: Props) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const expired = tracked ? isPixExpired(tracked.expiraEm) : false;
  const pixCode = tracked?.pixCopiaECola;
  const canShowPix = pagamento.status === 'Pendente' && !expired && Boolean(pixCode);

  const copy = async () => {
    if (!pixCode) return;
    try {
      await Clipboard.setStringAsync(pixCode);
      setCopyMessage('Código Pix copiado.');
    } catch {
      setCopyMessage('Não foi possível copiar o código. Tente novamente.');
    }
  };

  return <View style={styles.card} accessibilityLabel="Pagamento Pix simulado">
    <Text accessibilityRole="header" style={styles.title}>Pagamento Pix simulado</Text>
    <Text accessibilityRole="alert" style={styles.notice}>Não realiza transação financeira real.</Text>
    <Text>{paymentStatusLabel(pagamento)}</Text>
    <Text>Valor: {money(pagamento.valor)}</Text>
    {tracked ? <Text>Expira em {formatDate(tracked.expiraEm)}</Text> : null}
    {pagamento.status === 'Pendente' && expired ? <Text accessibilityRole="alert" style={styles.expired}>Código Pix expirado. Atualize o pagamento para consultar a situação.</Text> : null}
    {pagamento.status === 'Pendente' && !expired && !pixCode ? <Text>Código Pix indisponível neste dispositivo. Atualize o pagamento para consultar a situação.</Text> : null}
    {canShowPix ? <>
      <View accessible accessibilityRole="image" accessibilityLabel="Código QR para o Pix simulado" style={styles.qr}>
        <QRCode value={pixCode!} size={180} />
      </View>
      <Text selectable accessibilityLabel="Código Pix copia e cola">{pixCode}</Text>
      <Button title="Copiar código Pix" color="#175E55" onPress={() => void copy()} />
    </> : null}
    {copyMessage ? <Text accessibilityLiveRegion="polite">{copyMessage}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#175E55', backgroundColor: '#E3F2EC', borderRadius: 8, padding: 12, gap: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  notice: { color: '#805600' },
  expired: { color: '#A3262E', fontWeight: '600' },
  qr: { alignItems: 'center', backgroundColor: '#fff', padding: 12, alignSelf: 'flex-start' },
});
