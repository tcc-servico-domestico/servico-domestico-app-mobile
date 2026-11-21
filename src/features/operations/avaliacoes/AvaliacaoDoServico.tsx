import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Avaliacao, AvaliacoesApi } from '../contracts/avaliacoes';

export function AvaliacaoDoServico({ api, servicoId }: { api: AvaliacoesApi; servicoId: string }) {
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>();
  const [tentativa, setTentativa] = useState(0);
  const [erroConsulta, setErroConsulta] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const [nota, setNota] = useState('');
  const [comentario, setComentario] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void api.obterDoServico(servicoId, controller.signal).then((resultado) => {
      if (!controller.signal.aborted) setAvaliacao(resultado);
    }).catch(() => {
      if (!controller.signal.aborted) setErroConsulta(true);
    });
    return () => controller.abort();
  }, [api, servicoId, tentativa]);

  const verificar = () => {
    setErroConsulta(false);
    setErroEnvio(false);
    setAvaliacao(undefined);
    setTentativa((anterior) => anterior + 1);
  };

  const podeEnviar = /^[1-5]$/.test(nota.trim()) && comentario.trim().length > 0 && !comentario.includes('\0');

  async function enviar() {
    if (!podeEnviar || enviandoRef.current) return;
    enviandoRef.current = true;
    setErroEnvio(false);
    setEnviando(true);
    try {
      const salva = await api.registrar(servicoId, { nota: Number(nota), comentario: comentario.trim() });
      setAvaliacao(salva);
    } catch {
      setErroEnvio(true);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  return <View style={styles.section}>
    {avaliacao ? <>
      <Text accessibilityRole="header" style={styles.title}>Avaliação registrada</Text>
      <Text>Nota: {avaliacao.nota}/5</Text>
      <Text>{avaliacao.comentario}</Text>
    </> : <>
      <Text accessibilityRole="header" style={styles.title}>Avalie o atendimento</Text>
      {erroConsulta ? <>
        <Text accessibilityRole="alert">Não foi possível consultar a avaliação.</Text>
        <Button title="Tentar novamente" onPress={verificar} />
      </> : avaliacao === undefined ? <ActivityIndicator accessibilityLabel="Consultando avaliação do atendimento" /> : <>
        <Text>Nota de 1 a 5</Text>
        <TextInput accessibilityLabel="Nota de 1 a 5" keyboardType="number-pad" maxLength={1}
          value={nota} onChangeText={setNota} editable={!enviando} style={styles.input} />
        <Text>Comentário</Text>
        <TextInput accessibilityLabel="Comentário" multiline maxLength={1000} value={comentario}
          onChangeText={setComentario} editable={!enviando} style={styles.input} />
        {erroEnvio ? <>
          <Text accessibilityRole="alert">Não foi possível confirmar o envio. Verifique se a avaliação foi registrada.</Text>
          <Button title="Verificar avaliação" onPress={verificar} disabled={enviando} />
        </> : null}
        <Button title={enviando ? 'Enviando…' : 'Enviar avaliação'} onPress={() => void enviar()}
          disabled={!podeEnviar || enviando} />
      </>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 8, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  input: { borderColor: '#777', borderWidth: 1, borderRadius: 6, padding: 10 },
});
