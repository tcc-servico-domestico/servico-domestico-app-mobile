import { ActivityIndicator, ScrollView, StyleSheet, Text, Pressable, View, useWindowDimensions } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useExperience } from '@/src/context/ExperienceContext';
import { usePrototypeFonts } from '@/src/context/TypographyContext';
import { imoveisApi, servicosApi } from '@/src/shared/runtime';
import { loadClientDashboard } from '@/src/features/operations/servicos/clientDashboard';
import { serviceStatusLabel } from '@/src/features/operations/servicos/servicePresentation';
import type { Servico } from '@/src/features/operations/contracts/servicos';

export default function Home() {
  const { logout, session } = useAuth();
  const router = useRouter();
  const { role } = useExperience();
  const customFonts = usePrototypeFonts();
  const { width, fontScale } = useWindowDimensions();
  const compactShortcuts = width >= 360 && fontScale <= 1.3;
  const [focused, setFocused] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<{ pending: Servico[]; upcoming: Servico[] } | null>(null);
  const [dashboardError, setDashboardError] = useState(false);
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    void revision; // Alterar a revisão solicita nova consulta após uma falha.
    let active = true;
    if (role !== 'Cliente' || !session?.userId) return () => { active = false; };
    setDashboard(null); setDashboardError(false);
    void loadClientDashboard(imoveisApi, servicosApi).then((result) => {
      if (active) setDashboard(result);
    }).catch(() => { if (active) setDashboardError(true); });
    return () => { active = false; };
  }, [revision, role, session?.userId]));
  const items = [
    ...(session?.roles.includes('Cliente') ? [{ title: 'Imóveis', text: 'Ver imóveis', icon: 'home-city-outline' as const, route: '/(tabs)/imoveis' as const }] : []),
    { title: 'Serviços', text: 'Ver serviços', icon: 'clipboard-list-outline' as const, route: '/(tabs)/servicos' as const },
    { title: 'Pagamentos', text: 'Ver pagamentos', icon: 'credit-card-outline' as const, route: '/(tabs)/pagamentos' as const },
  ];
  if (role === 'Profissional') return <Redirect href="/(tabs)/servicos" />;
  return <ScrollView contentContainerStyle={styles.container}>
    {session?.roles.includes('Cliente') ? <View style={styles.hero}>
      <MaterialCommunityIcons name="creation" size={92} color="rgba(255,255,255,0.1)" style={styles.heroDecoration} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <Text accessibilityRole="header" style={[styles.heroTitle, customFonts && { fontFamily: 'BricolageExtraBold' }]}>Precisa de ajuda em casa?</Text>
      <Text style={[styles.heroBody, customFonts && { fontFamily: 'AtkinsonRegular' }]}>Escolha o imóvel, o horário e as tarefas para solicitar seu serviço.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/(tabs)/servicos', params: { novo: String(Date.now()) } })} style={styles.heroButton}>
        <MaterialCommunityIcons name="plus" size={22} color="#0D251B" /><Text style={[styles.heroButtonText, customFonts && { fontFamily: 'AtkinsonBold' }]}>Solicitar serviço</Text>
      </Pressable>
    </View> : <View style={styles.intro}><Text style={styles.eyebrow}>SERVIÇO DOMÉSTICO</Text><Text accessibilityRole="header" style={styles.title}>Tudo em seu lugar</Text><Text style={styles.body}>Escolha uma área para acompanhar suas tarefas.</Text></View>}
    <Text accessibilityRole="header" style={[styles.subtitle, customFonts && { fontFamily: 'BricolageBold' }]}>Precisa da sua ação</Text>
    {dashboardError ? <View style={styles.sectionCard}><Text accessibilityRole="alert" style={styles.body}>Não foi possível carregar seus atendimentos.</Text><Pressable accessibilityRole="button" onPress={() => setRevision((value) => value + 1)} style={styles.secondary}><Text style={styles.link}>Tentar novamente</Text></Pressable></View> : !dashboard ? <ActivityIndicator accessibilityLabel="Carregando atendimentos" color="#005B44" /> : dashboard.pending.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyText}>Tudo em dia. Nenhum atendimento esperando por você.</Text></View> : dashboard.pending.map((item) => <DashboardCard key={item.id} item={item} onPress={() => router.push(item.status === 'AguardandoPagamento' ? '/(tabs)/pagamentos' : { pathname: '/(tabs)/servicos', params: { atendimento: item.id } })} />)}
    <Text accessibilityRole="header" style={[styles.subtitle, customFonts && { fontFamily: 'BricolageBold' }]}>Próximos atendimentos</Text>
    {dashboardError ? <Text style={styles.body}>Não foi possível consultar os próximos atendimentos.</Text> : !dashboard ? <ActivityIndicator accessibilityLabel="Carregando próximos atendimentos" color="#005B44" /> : dashboard.upcoming.length === 0 ? <View style={[styles.sectionCard, styles.emptyUpcoming]}><MaterialCommunityIcons name="calendar-clock-outline" size={28} color="#005B44" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /><Text style={[styles.cardTitle, customFonts && { fontFamily: 'BricolageBold' }]}>Nada agendado</Text><Text style={[styles.body, styles.emptyUpcomingText]}>Quando houver um atendimento, ele aparece aqui.</Text></View> : dashboard.upcoming.map((item) => <DashboardCard key={item.id} item={item} onPress={() => router.push({ pathname: '/(tabs)/servicos', params: { atendimento: item.id } })} />)}
    <Text accessibilityRole="header" style={[styles.subtitle, customFonts && { fontFamily: 'BricolageBold' }]}>Atalhos</Text>
    <View style={[styles.shortcuts, !compactShortcuts && styles.shortcutsStacked]}>
      {items.map((item) => <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.text}`} onPress={() => router.push(item.route)} onFocus={() => setFocused(item.title)} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.shortcut, !compactShortcuts && styles.shortcutWide, focused === item.title && styles.focused, pressed && styles.pressed]}>
        <MaterialCommunityIcons name={item.icon} size={24} color="#005B44" />
        <Text style={[styles.shortcutTitle, customFonts && { fontFamily: 'AtkinsonBold' }]}>{item.title}</Text>
        <Text style={[styles.shortcutText, customFonts && { fontFamily: 'AtkinsonRegular' }]}>{item.text}</Text>
      </Pressable>)}
    </View>
    {session?.roles.includes('Profissional') ? <Pressable accessibilityRole="button" onPress={() => router.push('/perfil-profissional')} style={styles.secondary}><Text style={styles.link}>Perfil profissional</Text></Pressable> : null}
    <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/conta')} onFocus={() => setFocused('conta')} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.secondary, focused === 'conta' && styles.focused, pressed && styles.pressed]}><Text style={styles.link}>Minha conta</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={async () => { await logout(); router.replace('/(auth)/login'); }} onFocus={() => setFocused('sair')} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.secondary, focused === 'sair' && styles.focused, pressed && styles.pressed]}><Text style={styles.link}>Sair da conta</Text></Pressable>
  </ScrollView>;
}

function DashboardCard({ item, onPress }: { item: Servico; onPress: () => void }) {
  const customFonts = usePrototypeFonts();
  const date = new Date(item.inicioPrevisto);
  const formatted = Number.isNaN(date.getTime()) ? 'Data indisponível' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date);
  const next = item.status === 'AguardandoPagamento' ? 'Consultar pagamento' : item.status === 'AguardandoSelecao' ? 'Escolher profissional' : 'Acompanhar serviço';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${serviceStatusLabel(item.status)}, ${formatted}. ${next}`} onPress={onPress} style={styles.sectionCard}>
    <View style={styles.cardHeading}><Text style={styles.badge}>{serviceStatusLabel(item.status)}</Text><Text style={[styles.cardTitle, customFonts && { fontFamily: 'BricolageBold' }]}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</Text></View>
    <Text style={[styles.cardTitle, customFonts && { fontFamily: 'BricolageBold' }]}>{formatted}</Text><Text style={styles.link}>{next} ›</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 12, backgroundColor: '#FAF6EE' },
  hero: { backgroundColor: '#005B44', borderRadius: 24, padding: 20, gap: 12, overflow: 'hidden' }, heroDecoration: { position: 'absolute', top: -8, right: -8 }, heroTitle: { color: '#FFFDFA', fontSize: 24, fontWeight: '800' }, heroBody: { color: '#FFFDFA', fontSize: 16 }, heroButton: { minHeight: 52, borderRadius: 16, backgroundColor: '#F8C562', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 8 }, heroButtonText: { color: '#0D251B', fontSize: 16, fontWeight: '700' },
  shortcuts: { flexDirection: 'row', gap: 8 }, shortcutsStacked: { flexDirection: 'column' }, shortcut: { flex: 1, minHeight: 104, backgroundColor: '#FFFDFA', borderRadius: 16, borderWidth: 1, borderColor: '#D4D1C9', padding: 12, gap: 4 }, shortcutWide: { minHeight: 72 }, shortcutTitle: { color: '#0D251B', fontWeight: '700', fontSize: 15 }, shortcutText: { color: '#465550', fontSize: 13 },
  sectionCard: { backgroundColor: '#FFFDFA', borderRadius: 16, borderWidth: 1, borderColor: '#D4D1C9', padding: 16, gap: 10 }, emptyUpcoming: { alignItems: 'center', padding: 24 }, emptyUpcomingText: { textAlign: 'center' }, cardHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, badge: { color: '#005B44', fontWeight: '700' }, emptyCard: { backgroundColor: '#D3F0E2', borderRadius: 16, padding: 16 }, emptyText: { color: '#005B44', fontSize: 16 },
  intro: { paddingVertical: 16, gap: 8 }, eyebrow: { color: '#175E55', fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', color: '#1B2421' }, subtitle: { fontSize: 18, fontWeight: '700', color: '#1B2421', marginBottom: 4 },
  body: { fontSize: 16, color: '#465550', flexShrink: 1 }, card: { minHeight: 80, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#6B7A74', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#E3F2EC', alignItems: 'center', justifyContent: 'center' }, cardText: { flex: 1, gap: 4 }, cardTitle: { fontSize: 18, fontWeight: '700', color: '#1B2421' },
  secondary: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#175E55' }, link: { color: '#175E55', fontWeight: '700', fontSize: 16 }, pressed: { opacity: 0.7 }, focused: { borderWidth: 3, borderColor: '#175E55' },
});
