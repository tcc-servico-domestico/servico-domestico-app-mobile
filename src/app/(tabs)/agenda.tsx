import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Button, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from '@/src/context/AuthContext';
import { useExperience } from '@/src/context/ExperienceContext';
import type { Servico } from '@/src/features/operations/contracts/servicos';
import { serviceStatusLabel } from '@/src/features/operations/servicos/servicePresentation';
import { servicosApi } from '@/src/shared/runtime';

export default function Agenda() {
  const { session } = useAuth();
  const { role } = useExperience();
  const router = useRouter();
  const [items, setItems] = useState<readonly Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestGeneration = useRef(0);
  const load = useCallback(async () => {
    if (!session || role !== 'Profissional') return;
    const request = ++requestGeneration.current;
    setLoading(true); setError(false);
    try {
      const all: Servico[] = [];
      const seen = new Set<string>();
      let expectedTotal: number | undefined;
      for (let page = 1; page <= 100; page++) {
        const result = await servicosApi.list({ page, pageSize: 100 });
        if (result.page !== page || !Number.isSafeInteger(result.total) || result.total < 0 ||
          (expectedTotal !== undefined && expectedTotal !== result.total)) throw new Error('Página inconsistente');
        expectedTotal = result.total;
        for (const item of result.items) {
          if (!item.id || seen.has(item.id)) throw new Error('Atendimento repetido');
          seen.add(item.id);
          all.push(item);
        }
        if (all.length > result.total) throw new Error('Total inconsistente');
        if (all.length === result.total) {
          if (request !== requestGeneration.current) return;
          setItems(all.filter((item) => item.profissionalId === session.userId && ['Aceito', 'EmExecucao', 'Concluido'].includes(item.status)).sort((a, b) => a.inicioPrevisto.localeCompare(b.inicioPrevisto)));
          return;
        }
        if (result.items.length === 0) throw new Error('Página incompleta');
      }
      throw new Error('Limite de páginas excedido');
    } catch { if (request === requestGeneration.current) { setItems([]); setError(true); } } finally { if (request === requestGeneration.current) setLoading(false); }
  }, [session, role]);
  useFocusEffect(useCallback(() => {
    const generation = requestGeneration;
    void load();
    return () => { generation.current++; };
  }, [load]));
  if (role !== 'Profissional' || !session?.roles.includes('Profissional')) return null;
  const upcoming = items.filter((item) => item.status !== 'Concluido');
  const next = upcoming.find((item) => item.status === 'EmExecucao') ?? upcoming[0];
  const later = upcoming.filter((item) => item.id !== next?.id);
  const completed = items.filter((item) => item.status === 'Concluido').slice().reverse();
  const renderItem = (item: Servico) => <View style={styles.card} key={item.id}>
    <View style={styles.cardHeader}><Text style={styles.badge}>{serviceStatusLabel(item.status)}</Text><Text style={styles.value}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</Text></View>
    <Text style={styles.subtitle}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(item.inicioPrevisto))}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Ver atendimento" onPress={() => router.push({ pathname: '/(tabs)/servicos', params: { agenda: item.id } })} style={styles.link}><Text style={styles.linkText}>Ver atendimento ›</Text></Pressable>
  </View>;
  return <ScrollView contentContainerStyle={styles.container}>
    <Text accessibilityRole="header" style={styles.title}>Sua agenda</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Carregando agenda" /> : error ? <View style={styles.card}><Text accessibilityRole="alert">Não foi possível carregar sua agenda.</Text><Button color="#005B44" title="Tentar novamente" onPress={() => void load()} /></View> : <>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Próximo serviço</Text>
      {next ? renderItem(next) : <View style={styles.emptyCard}>
        <MaterialCommunityIcons name="calendar-blank-outline" size={28} color="#005B44" />
        <Text style={styles.subtitle}>Nenhum serviço agendado</Text><Text style={styles.description}>Aceite uma oferta para ela entrar na sua agenda.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/servicos')} style={styles.emptyAction}><Text style={styles.linkText}>Ver ofertas</Text></Pressable>
      </View>}
      {later.length ? <><Text accessibilityRole="header" style={styles.sectionTitle}>Depois</Text>{later.map(renderItem)}</> : null}
      {completed.length ? <><Text accessibilityRole="header" style={styles.sectionTitle}>Concluídos</Text>{completed.map(renderItem)}</> : null}
    </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 12, backgroundColor: '#FAF6EE' },
  title: { color: '#0D251B', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#0D251B', fontSize: 18, fontWeight: '700' },
  card: { backgroundColor: '#FFFDFA', borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: '#DDDAD1' },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFFDFA', borderRadius: 16, padding: 20, gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D4D1C9' },
  sectionTitle: { color: '#10251D', fontSize: 16, fontWeight: '700', marginTop: 6 },
  description: { color: '#53655C', textAlign: 'center' },
  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { color: '#005B44', fontWeight: '700', flexShrink: 1 },
  value: { color: '#10251D', fontWeight: '700' },
  link: { minHeight: 48, justifyContent: 'center' },
  emptyAction: { minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, borderWidth: 1, borderColor: '#A9C5B9', borderRadius: 12 },
  linkText: { color: '#005B44', fontWeight: '700' },
});
