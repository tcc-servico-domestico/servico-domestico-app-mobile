import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HttpProblemError } from '@/src/shared/contracts/http';
import type {
  DadosPerfilProfissional, PerfilProfissional, PerfilProfissionalApi, ResultadoSalvamentoPerfil,
} from '../contracts/perfilProfissional';
import { editarPerfil, validarPerfil, type PerfilForm } from './validation';
import type { AvaliacoesApi, ResumoAvaliacoes } from '../contracts/avaliacoes';

const verde = '#175E55';

function Button({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean; color?: string }) {
  const [focado, setFocado] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}
    onFocus={() => setFocado(true)} onBlur={() => setFocado(false)}
    style={({ pressed }) => [styles.acao, focado && styles.acaoFocada, disabled && styles.acaoDesabilitada, pressed && styles.acaoPressionada]}>
    <Text style={styles.textoAcao}>{title}</Text>
  </Pressable>;
}

function mensagemDeFalha(erro: unknown, fallback: string): string {
  if (erro instanceof HttpProblemError) {
    if (erro.problem.code === 'core_identity_not_found') return 'O cadastro do perfil está indisponível para sua conta.';
    if (erro.problem.status === 403) return 'Seu acesso ao perfil profissional está indisponível.';
    if (erro.problem.status === 400) return 'Confira os dados informados antes de salvar novamente.';
  }
  return fallback;
}

function Campo({ label, value, onChange, erro, bloqueado, placeholder }: {
  label: string; value: string; onChange: (valor: string) => void; erro?: string; bloqueado: boolean; placeholder?: string;
}) {
  return (
    <View style={styles.campo}>
      <Text>{label}</Text>
      <TextInput accessibilityLabel={label} accessibilityHint={erro} value={value} placeholder={placeholder} autoCorrect={false}
        editable={!bloqueado} onChangeText={onChange} style={[styles.input, erro && styles.inputErro]} />
      {erro ? <Text accessibilityRole="alert" style={styles.erro}>{erro}</Text> : null}
    </View>
  );
}

function substituir<T>(itens: T[], indice: number, valor: T) {
  return itens.map((item, i) => i === indice ? valor : item);
}

export function PerfilProfissionalScreen({ api, avaliacoesApi }: { api: PerfilProfissionalApi; avaliacoesApi?: Pick<AvaliacoesApi, 'resumir'> }) {
  const [form, setForm] = useState<PerfilForm>(() => editarPerfil());
  const [versao, setVersao] = useState<number | null>(null);
  const [perfilSalvo, setPerfilSalvo] = useState<PerfilProfissional | null>(null);
  const [editando, setEditando] = useState(false);
  const [resumo, setResumo] = useState<ResumoAvaliacoes | null>(null);
  const [erroResumo, setErroResumo] = useState(false);
  const [tentativaResumo, setTentativaResumo] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [falhaConsulta, setFalhaConsulta] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [conflito, setConflito] = useState<PerfilProfissional | null>(null);
  const [aVerificar, setAVerificar] = useState<DadosPerfilProfissional | null>(null);
  const consulta = useRef<AbortController | null>(null);
  const envio = useRef<AbortController | null>(null);

  const carregar = useCallback(async () => {
    consulta.current?.abort();
    const controller = new AbortController();
    consulta.current = controller;
    setCarregando(true);
    setFalhaConsulta(null);
    try {
      const perfil = await api.obter(controller.signal);
      if (controller.signal.aborted) return;
      setForm(editarPerfil(perfil ?? undefined));
      setPerfilSalvo(perfil);
      setVersao(perfil?.aggregateVersion ?? null);
    } catch (erro) {
      if (!controller.signal.aborted) setFalhaConsulta(mensagemDeFalha(erro, 'Não foi possível consultar o perfil profissional.'));
    } finally {
      if (!controller.signal.aborted) setCarregando(false);
    }
  }, [api]);

  useEffect(() => {
    void carregar();
    return () => {
      consulta.current?.abort();
      envio.current?.abort();
    };
  }, [carregar]);

  useEffect(() => {
    if (!avaliacoesApi) return;
    const controller = new AbortController();
    setResumo(null); setErroResumo(false);
    void avaliacoesApi.resumir(controller.signal).then((valor) => { if (!controller.signal.aborted) setResumo(valor); })
      .catch(() => { if (!controller.signal.aborted) setErroResumo(true); });
    return () => controller.abort();
  }, [avaliacoesApi, tentativaResumo]);

  function editar<K extends keyof PerfilForm>(campo: K, valor: PerfilForm[K]) {
    setForm(anterior => ({ ...anterior, [campo]: valor }));
    if (Object.keys(erros).length) setErros({});
    if (mensagem && !conflito && !aVerificar) setMensagem(null);
  }

  function aplicarResultado(resultado: ResultadoSalvamentoPerfil, dados: DadosPerfilProfissional) {
    switch (resultado.estado) {
      case 'salvo':
        setVersao(resultado.perfil.aggregateVersion);
        setPerfilSalvo(resultado.perfil);
        setEditando(false);
        setForm(editarPerfil(resultado.perfil));
        setAVerificar(null);
        setConflito(null);
        setMensagem('Perfil profissional salvo.');
        break;
      case 'divergente':
        setConflito(resultado.perfil);
        setAVerificar(null);
        setMensagem('Os dados salvos são diferentes. Revise antes de salvar novamente.');
        break;
      case 'ausente':
        setAVerificar(null);
        setMensagem(versao === null ? 'O perfil ainda não foi cadastrado. Você pode tentar salvar novamente.'
          : 'O perfil salvo não foi encontrado. Consulte novamente antes de editar.');
        break;
      case 'incerto':
        setAVerificar(dados);
        setMensagem('Não foi possível confirmar o salvamento. Verifique o estado do perfil.');
        break;
    }
  }

  async function executar(dados: DadosPerfilProfissional, verificar = false) {
    if (envio.current) return;
    const controller = new AbortController();
    envio.current = controller;
    setSalvando(true);
    setMensagem(null);
    try {
      const resultado = verificar ? await api.verificar(dados, controller.signal) : await api.salvar(dados, versao, controller.signal);
      if (!controller.signal.aborted) aplicarResultado(resultado, dados);
    } catch (erro) {
      if (!controller.signal.aborted) setMensagem(mensagemDeFalha(erro, 'Não foi possível salvar o perfil profissional. Tente novamente.'));
    } finally {
      if (envio.current === controller) envio.current = null;
      if (!controller.signal.aborted) setSalvando(false);
    }
  }

  function salvar() {
    const validacao = validarPerfil(form);
    if ('erros' in validacao) {
      setErros(validacao.erros);
      setMensagem('Corrija os campos indicados antes de salvar.');
      return;
    }
    setErros({});
    void executar(validacao.dados);
  }

  if (carregando) return <View style={styles.central}><ActivityIndicator accessibilityLabel="Carregando perfil profissional" /></View>;
  if (falhaConsulta) return (
    <View style={styles.central}>
      <View style={styles.resumoCard}>
        <Text accessibilityRole="header" style={styles.titulo}>Perfil indisponível</Text>
        <Text accessibilityRole="alert">{falhaConsulta}</Text>
        <Button color={verde} title="Tentar novamente" onPress={() => void carregar()} />
      </View>
    </View>
  );

  if (!editando) return <ScrollView contentContainerStyle={styles.conteudo}>
    <Text style={styles.titulo} accessibilityRole="header">Perfil profissional</Text>
    {avaliacoesApi ? <View style={styles.resumoCard}>
      <Text style={styles.resumoLabel}>Sua reputação</Text>
      {erroResumo ? <><Text accessibilityRole="alert">Não foi possível consultar sua reputação.</Text><Button color={verde} title="Tentar consultar reputação" onPress={() => setTentativaResumo((value) => value + 1)} /></> : resumo ? <Text style={styles.resumoValor}>{resumo.quantidadeAvaliacoes ? `★ ${resumo.avaliacaoMedia.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} · ${resumo.quantidadeAvaliacoes} ${resumo.quantidadeAvaliacoes === 1 ? 'avaliação' : 'avaliações'}` : 'Ainda não há avaliações.'}</Text> : <ActivityIndicator accessibilityLabel="Carregando reputação" />}
    </View> : null}
    {mensagem ? <Text accessibilityLiveRegion="polite" style={styles.mensagem}>{mensagem}</Text> : null}
    {!perfilSalvo ? <><View style={styles.resumoCard}><Text style={styles.secao}>Você ainda não tem perfil profissional</Text><Text>Cadastre habilidades, locais e disponibilidade para apresentar seu perfil.</Text></View><Button color={verde} title="Começar cadastro" onPress={() => setEditando(true)} /></> : <>
      <Button color={verde} title="Editar perfil profissional" onPress={() => setEditando(true)} />
      <Text style={styles.secao} accessibilityRole="header">Habilidades</Text>
      <View style={styles.resumoCard}><Text>{perfilSalvo.habilidades.join(' · ') || 'Nenhuma habilidade cadastrada.'}</Text></View>
      <Text style={styles.secao} accessibilityRole="header">Locais de atuação</Text>
      <View style={styles.resumoCard}>{perfilSalvo.areas.length ? perfilSalvo.areas.map((area, i) => <Text key={i}>Local {i + 1}: {area.latitude}, {area.longitude}</Text>) : <Text>Nenhum local cadastrado.</Text>}</View>
      <Text style={styles.secao} accessibilityRole="header">Disponibilidade</Text>
      <View style={styles.resumoCard}>{perfilSalvo.disponibilidades.length ? perfilSalvo.disponibilidades.map((faixa, i) => <Text key={i}>{faixa.dia} · {faixa.horaInicio}–{faixa.horaFim}</Text>) : <Text>Nenhuma faixa cadastrada.</Text>}</View>
    </>}
  </ScrollView>;

  const bloqueado = salvando || aVerificar !== null;
  return (
    <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
      <Button color={verde} title="Voltar ao resumo" disabled={salvando} onPress={() => setEditando(false)} />
      <Text style={styles.titulo} accessibilityRole="header">{versao === null ? 'Cadastrar perfil profissional' : 'Editar perfil profissional'}</Text>
      <Text style={styles.secao} accessibilityRole="header">Habilidades</Text>
      {form.habilidades.map((valor, i) => (
        <View style={styles.item} key={i}>
          <Campo label={`Habilidade ${i + 1}`} value={valor} erro={erros[`habilidades.${i}`]} bloqueado={bloqueado}
            onChange={texto => editar('habilidades', substituir(form.habilidades, i, texto))} />
          {form.habilidades.length > 1 && <Button color={verde} title={`Remover habilidade ${i + 1}`} disabled={bloqueado}
            onPress={() => editar('habilidades', form.habilidades.filter((_, indice) => indice !== i))} />}
        </View>
      ))}
      <Button color={verde} title="Adicionar habilidade" disabled={bloqueado}
        onPress={() => editar('habilidades', [...form.habilidades, ''])} />

      <Text style={styles.secao} accessibilityRole="header">Locais de atuação</Text>
      {form.areas.map((area, i) => (
        <View style={styles.item} key={i}>
          <Campo label={`Latitude do local ${i + 1}`} value={area.latitude} erro={erros[`areas.${i}.latitude`]} bloqueado={bloqueado}
            onChange={latitude => editar('areas', substituir(form.areas, i, { ...area, latitude }))} placeholder="-15,78" />
          <Campo label={`Longitude do local ${i + 1}`} value={area.longitude} erro={erros[`areas.${i}.longitude`]} bloqueado={bloqueado}
            onChange={longitude => editar('areas', substituir(form.areas, i, { ...area, longitude }))} placeholder="-47,92" />
          {form.areas.length > 1 && <Button color={verde} title={`Remover local ${i + 1}`} disabled={bloqueado}
            onPress={() => editar('areas', form.areas.filter((_, indice) => indice !== i))} />}
        </View>
      ))}
      <Button color={verde} title="Adicionar local" disabled={bloqueado}
        onPress={() => editar('areas', [...form.areas, { latitude: '', longitude: '' }])} />

      <Text style={styles.secao} accessibilityRole="header">Disponibilidade</Text>
      <Text>Horários de Brasília. Sem faixas cadastradas, seu perfil não aparece nas buscas.</Text>
      {form.disponibilidades.map((faixa, i) => (
        <View style={styles.item} key={i}>
          <Campo label={`Data da faixa ${i + 1}`} value={faixa.dia} erro={erros[`disponibilidades.${i}.dia`]} bloqueado={bloqueado}
            onChange={dia => editar('disponibilidades', substituir(form.disponibilidades, i, { ...faixa, dia }))} placeholder="DD/MM/AAAA" />
          <Campo label={`Início da faixa ${i + 1}`} value={faixa.horaInicio} erro={erros[`disponibilidades.${i}.horaInicio`]}
            bloqueado={bloqueado} onChange={horaInicio => editar('disponibilidades', substituir(form.disponibilidades, i, { ...faixa, horaInicio }))}
            placeholder="HH:mm" />
          <Campo label={`Fim da faixa ${i + 1}`} value={faixa.horaFim} erro={erros[`disponibilidades.${i}.horaFim`]}
            bloqueado={bloqueado} onChange={horaFim => editar('disponibilidades', substituir(form.disponibilidades, i, { ...faixa, horaFim }))}
            placeholder="HH:mm" />
          <Button color={verde} title={`Remover faixa ${i + 1}`} disabled={bloqueado}
            onPress={() => editar('disponibilidades', form.disponibilidades.filter((_, indice) => indice !== i))} />
        </View>
      ))}
      <Button color={verde} title="Adicionar faixa" disabled={bloqueado}
        onPress={() => editar('disponibilidades', [...form.disponibilidades, { dia: '', horaInicio: '', horaFim: '' }])} />

      {mensagem && <Text accessibilityLiveRegion="polite" style={styles.mensagem}>{mensagem}</Text>}
      {conflito && (
        <View style={styles.item}>
          <Text style={styles.secao} accessibilityRole="header">Dados salvos</Text>
          <Text>Habilidades: {conflito.habilidades.join(', ') || 'nenhuma'}</Text>
          <Text>Locais: {conflito.areas.map(x => `${x.latitude}, ${x.longitude}`).join(' · ') || 'nenhum'}</Text>
          <Text>Faixas: {conflito.disponibilidades.map(x => `${x.dia} ${x.horaInicio}–${x.horaFim}`).join(' · ') || 'nenhuma'}</Text>
          <Button color={verde} title="Manter rascunho e revisar" onPress={() => {
            setVersao(conflito.aggregateVersion);
            setPerfilSalvo(conflito);
            setConflito(null);
            setMensagem('Revise o rascunho antes de salvar novamente.');
          }} />
          <Button color={verde} title="Usar dados salvos" onPress={() => {
            setVersao(conflito.aggregateVersion);
            setForm(editarPerfil(conflito));
            setPerfilSalvo(conflito);
            setConflito(null);
            setErros({});
            setMensagem(null);
          }} />
        </View>
      )}
      {aVerificar
        ? <Button color={verde} title="Verificar salvamento" disabled={salvando} onPress={() => void executar(aVerificar, true)} />
        : <Button color={verde} title={salvando ? 'Salvando…' : 'Salvar perfil profissional'} disabled={salvando || conflito !== null} onPress={salvar} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: { padding: 20, paddingBottom: 40, gap: 12, backgroundColor: '#F8F4EB' },
  resumoCard: { borderWidth: 1, borderColor: '#DDDAD1', backgroundColor: '#FFFDFA', borderRadius: 16, padding: 16, gap: 8 },
  resumoLabel: { color: '#53655C', fontSize: 14, fontWeight: '700' },
  resumoValor: { color: '#10251D', fontSize: 18, fontWeight: '700' },
  central: { flex: 1, justifyContent: 'center', padding: 20, gap: 16, backgroundColor: '#F8F4EB' },
  acao: { minHeight: 48, borderRadius: 16, backgroundColor: '#005B44', alignItems: 'center', justifyContent: 'center', padding: 12 },
  textoAcao: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  acaoFocada: { borderWidth: 3, borderColor: '#F8C562' },
  acaoDesabilitada: { opacity: 0.5 }, acaoPressionada: { opacity: 0.75 },
  titulo: { fontSize: 21, fontWeight: '700', color: '#17352F' },
  secao: { fontSize: 17, fontWeight: '600', marginTop: 8, color: '#17352F' },
  item: { gap: 8, padding: 16, backgroundColor: '#FFFDFA', borderWidth: 1, borderColor: '#D4D1C9', borderRadius: 16 },
  campo: { gap: 4 },
  input: { minHeight: 48, padding: 10, borderWidth: 1, borderRadius: 12, borderColor: '#829D94', color: '#17352F', backgroundColor: '#FFFFFF' },
  inputErro: { borderColor: '#9B2424' },
  erro: { color: '#9B2424' },
  mensagem: { color: '#17352F', marginTop: 12 },
});
