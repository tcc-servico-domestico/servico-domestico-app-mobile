import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Avaliacao, AvaliacoesApi, ResumoAvaliacoes } from '../contracts/avaliacoes';
import { HttpProblemError } from '@/src/shared/contracts/http';
import type { Page } from '../contracts/imoveis';

type Props = { api: AvaliacoesApi; onBack: () => void } &
  ({ profissionalId: string; nomeExibicao?: string } | { profissionalId?: undefined; nomeExibicao?: undefined });

export function AvaliacoesScreen({ api, profissionalId, nomeExibicao, onBack }: Props) {
  const [pagina, setPagina] = useState(1);
  const [tentativa, setTentativa] = useState(0);
  const [resultado, setResultado] = useState<Page<Avaliacao> | ResumoAvaliacoes | null>(null);
  const [erro, setErro] = useState<'indisponivel' | 'transitorio' | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const consulta = profissionalId
      ? api.listar(profissionalId, pagina, controller.signal)
      : api.resumir(controller.signal);
    void consulta.then((resposta) => {
      if (!controller.signal.aborted) setResultado(resposta);
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setResultado(null);
      const indisponivel = cause instanceof HttpProblemError && cause.problem.status === 404 &&
        cause.problem.code === 'avaliacoes_nao_encontradas';
      setErro(indisponivel ? 'indisponivel' : 'transitorio');
    });
    return () => controller.abort();
  }, [api, profissionalId, pagina, tentativa]);

  const carregarPagina = (numero: number) => {
    setResultado(null);
    setPagina(numero);
  };

  return <ScrollView contentContainerStyle={styles.container}>
    <Button title="Voltar" onPress={onBack} />
    <Text accessibilityRole="header" style={styles.title}>
      {profissionalId ? 'Avaliações do profissional' : 'Minhas avaliações'}
    </Text>
    {nomeExibicao ? <Text>{nomeExibicao}</Text> : null}
    {erro === 'indisponivel' ? (
      <Text accessibilityRole="alert">As avaliações deste profissional estão indisponíveis.</Text>
    ) : erro ? <>
      <Text accessibilityRole="alert">Não foi possível consultar as avaliações.</Text>
      <Button title="Tentar novamente" onPress={() => { setErro(null); setTentativa((anterior) => anterior + 1); }} />
    </> : !resultado ? <ActivityIndicator accessibilityLabel="Carregando avaliações" /> : 'items' in resultado ? <>
      {resultado.total === 0 ? <Text>Ainda não há avaliações.</Text> : resultado.items.map((item, indice) => (
        <View key={indice} style={styles.card}>
          <Text style={styles.nota}>Nota: {item.nota}/5</Text>
          <Text>{item.comentario}</Text>
        </View>
      ))}
      {pagina > 1 ? <Button title="Página anterior" onPress={() => carregarPagina(pagina - 1)} /> : null}
      {resultado.page * resultado.pageSize < resultado.total
        ? <Button title="Próxima página" onPress={() => carregarPagina(pagina + 1)} /> : null}
    </> : resultado.quantidadeAvaliacoes === 0 ? <Text>Ainda não há avaliações.</Text> : <>
      <Text>Média: {resultado.avaliacaoMedia.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}/5</Text>
      <Text>Quantidade de avaliações: {resultado.quantidadeAvaliacoes}</Text>
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  card: { borderColor: '#ddd', borderWidth: 1, borderRadius: 8, padding: 12, gap: 4 },
  nota: { fontWeight: '600' },
});
