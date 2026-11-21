import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import type { Pagamento } from '@/src/features/operations/contracts/pagamentos';
import type { TrackedPixCharge } from './paymentTrackingStore';
import { canCopyPix, formatPixExpiration, isPixExpired, paymentStatusLabel } from './paymentPresentation';

interface Props {
  readonly pagamento: Pagamento;
  readonly tracked: TrackedPixCharge | undefined;
  readonly showPixInstructions?: boolean;
}


function money(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function PixChargeCard({ pagamento, tracked, showPixInstructions = true }: Props) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copyFocused, setCopyFocused] = useState(false);
  const expired = tracked ? isPixExpired(tracked.expiraEm) : false;
  const pixCode = tracked?.pixCopiaECola;
  const canShowPix = showPixInstructions && canCopyPix(pagamento, pixCode, tracked?.expiraEm);

  const copy = async () => {
    if (!pixCode || !canCopyPix(pagamento, pixCode, tracked?.expiraEm)) {
      setCopyMessage('Código Pix indisponível ou expirado. Atualize o pagamento para consultar a situação.');
      return;
    }
    try {
      await Clipboard.setStringAsync(pixCode);
      setCopyMessage('Código Pix copiado. A situação só muda após confirmação do pagamento.');
    } catch {
      setCopyMessage('Não foi possível copiar o código. Tente novamente.');
    }
  };

  return <View style={styles.card} accessibilityLabel={showPixInstructions ? 'Pagamento Pix simulado' : 'Pagamento simulado'}>
    <Text accessibilityRole="header" style={styles.title}>{showPixInstructions ? 'Pagamento Pix simulado' : 'Pagamento simulado'}</Text>
    <Text accessibilityRole="alert" style={styles.notice}>Não realiza transação financeira real.</Text>
    <View style={[styles.financialStatus, pagamento.status === 'Confirmado' && styles.financialConfirmed]}>
      <Text style={styles.financialCaption}>SITUAÇÃO FINANCEIRA</Text>
      <Text style={styles.status}>{paymentStatusLabel(pagamento)}</Text>
    </View>
    <View style={styles.amountCard}>
      <Text style={styles.caption}>Valor do pagamento</Text>
      <Text style={styles.amount}>{money(pagamento.valor)}</Text>
    </View>
    {showPixInstructions && tracked ? <Text style={styles.expiration}>{formatPixExpiration(tracked.expiraEm)}</Text> : null}
    {showPixInstructions && pagamento.status === 'Pendente' && expired ? <Text accessibilityRole="alert" style={styles.expired}>Código Pix expirado. Atualize o pagamento para consultar a situação.</Text> : null}
    {showPixInstructions && pagamento.status === 'Pendente' && !expired && !pixCode ? <Text>Código Pix indisponível neste dispositivo. Atualize o pagamento para consultar a situação.</Text> : null}
    {canShowPix ? <>
      <View style={styles.qrCard}>
        <View accessible accessibilityRole="image" accessibilityLabel="Código QR para o Pix simulado" style={styles.qr}>
          <QRCode value={pixCode!} size={180} />
        </View>
        <Text style={styles.caption}>QR Code de demonstração</Text>
      </View>
      <Text accessibilityRole="header" style={styles.label}>Pix copia e cola</Text>
      <Text selectable accessibilityLabel="Código Pix copia e cola" style={styles.code}>{pixCode}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Copiar código Pix" onPress={() => void copy()} onFocus={() => setCopyFocused(true)} onBlur={() => setCopyFocused(false)} style={({ pressed }) => [styles.button, copyFocused && styles.focused, pressed && styles.pressed]}>
        <MaterialCommunityIcons name="content-copy" size={20} color="#FFFFFF" /><Text style={styles.buttonText}>Copiar código Pix</Text>
      </Pressable>
    </> : null}
    {copyMessage ? <Text accessibilityLiveRegion="polite">{copyMessage}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  financialStatus: { borderWidth: 1, borderColor: '#D4D1C9', backgroundColor: '#F1EEE7', borderRadius: 16, padding: 16, gap: 6 },
  financialConfirmed: { borderColor: '#AED5BF', backgroundColor: '#DCF1E8' },
  financialCaption: { color: '#465550', fontSize: 12, fontWeight: '700' },
  amountCard: { borderWidth: 1, borderColor: '#DDDAD1', backgroundColor: '#FFFDFA', borderRadius: 16, padding: 20, gap: 6, alignItems: 'center' },
  caption: { color: '#53655C', textAlign: 'center' },
  amount: { color: '#10251D', fontSize: 30, fontWeight: '800', textAlign: 'center' },
  status: { color: '#10251D', fontSize: 16, fontWeight: '700' },
  expiration: { color: '#614900', fontWeight: '700', textAlign: 'center' },
  label: { color: '#10251D', fontWeight: '700', fontSize: 16 },
  code: { borderWidth: 1, borderColor: '#AEB7AA', borderRadius: 12, padding: 12, color: '#10251D', backgroundColor: '#F1EEE7' },
  button: { minHeight: 56, borderRadius: 16, backgroundColor: '#005B44', flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', padding: 12 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.75 }, focused: { borderWidth: 3, borderColor: '#F8C562' },
  qrCard: { alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#DDDAD1', borderRadius: 16, backgroundColor: '#FFFDFA', padding: 20 },
  title: { fontSize: 18, fontWeight: '700' },
  notice: { color: '#614900', backgroundColor: '#FFF1CF', padding: 12, borderRadius: 12 },
  expired: { color: '#A3262E', fontWeight: '600' },
  qr: { alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12 },
});
