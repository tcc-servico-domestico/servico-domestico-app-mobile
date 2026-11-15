import type { DadosPerfilProfissional } from '../contracts/perfilProfissional';

export interface PerfilForm {
  habilidades: string[];
  areas: { latitude: string; longitude: string }[];
  disponibilidades: { dia: string; horaInicio: string; horaFim: string }[];
}

type Validacao = { dados: DadosPerfilProfissional } | { erros: Record<string, string> };

export function editarPerfil(dados?: DadosPerfilProfissional): PerfilForm {
  return {
    habilidades: dados?.habilidades.length ? [...dados.habilidades] : [''],
    areas: dados?.areas.length ? dados.areas.map(x => ({
      latitude: String(x.latitude), longitude: String(x.longitude),
    })) : [{ latitude: '', longitude: '' }],
    disponibilidades: (dados?.disponibilidades ?? []).map(x => ({
      ...x, dia: x.dia.split('-').reverse().join('/'),
    })),
  };
}

function coordenada(valor: string, limite: number): number | null {
  const texto = valor.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(texto)) return null;
  const numero = Number(texto.replace(',', '.'));
  return Number.isFinite(numero) && Math.abs(numero) <= limite ? numero : null;
}

function diaIso(valor: string): string | null {
  const texto = valor.trim();
  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  const iso = local ? [local[3], local[2], local[1]].join('-') : texto;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso.startsWith('0000')) return null;
  const data = new Date(iso + 'T00:00:00Z');
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === iso ? iso : null;
}

function horaLocal(valor: string): string | null {
  const campos = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:[.,](\d{1,6}))?)?$/.exec(valor.trim());
  if (!campos) return null;
  const fracao = campos[4]?.replace(/0+$/, '');
  const hora = [campos[1], campos[2], campos[3] ?? '00'].join(':');
  return fracao ? hora + '.' + fracao : hora;
}

export function normalizarPerfil(dados: DadosPerfilProfissional): DadosPerfilProfissional {
  const areas = dados.areas.map(({ latitude, longitude }) => ({ latitude, longitude }));
  const faixas = dados.disponibilidades.map(({ dia, horaInicio, horaFim }) => ({
    dia, horaInicio: horaLocal(horaInicio) ?? horaInicio, horaFim: horaLocal(horaFim) ?? horaFim,
  }));
  const chaves = <T>(itens: readonly T[]) => [...new Map(itens.map(item => [JSON.stringify(item), item])).entries()]
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, item]) => item);
  return { habilidades: [...new Set(dados.habilidades.map(x => x.trim()))].sort(),
    areas: chaves(areas), disponibilidades: chaves(faixas) };
}

export function validarPerfil(form: PerfilForm): Validacao {
  const erros: Record<string, string> = {};
  if (!form.habilidades.length) erros.habilidades = 'Informe ao menos uma habilidade.';
  form.habilidades.forEach((texto, i) => {
    if (!texto.trim()) erros[`habilidades.${i}`] = 'Informe a habilidade.';
  });
  if (!form.areas.length) erros.areas = 'Informe ao menos um local de atuação.';
  const areas = form.areas.flatMap((area, i) => {
    const latitude = coordenada(area.latitude, 90);
    const longitude = coordenada(area.longitude, 180);
    if (latitude === null) erros[`areas.${i}.latitude`] = 'Informe uma latitude entre -90 e 90.';
    if (longitude === null) erros[`areas.${i}.longitude`] = 'Informe uma longitude entre -180 e 180.';
    return latitude === null || longitude === null ? [] : [{ latitude, longitude }];
  });
  const disponibilidades = form.disponibilidades.flatMap((faixa, i) => {
    const dia = diaIso(faixa.dia);
    const horaInicio = horaLocal(faixa.horaInicio);
    const horaFim = horaLocal(faixa.horaFim);
    if (!dia) erros[`disponibilidades.${i}.dia`] = 'Informe uma data válida.';
    if (!horaInicio) erros[`disponibilidades.${i}.horaInicio`] = 'Informe o início em HH:mm.';
    if (!horaFim) erros[`disponibilidades.${i}.horaFim`] = 'Informe o fim em HH:mm.';
    else if (horaInicio === horaFim) erros[`disponibilidades.${i}.horaFim`] = 'O fim deve ser diferente do início.';
    return !dia || !horaInicio || !horaFim ? [] : [{ dia, horaInicio, horaFim }];
  });
  if (Object.keys(erros).length) return { erros };
  return { dados: normalizarPerfil({ habilidades: form.habilidades, areas, disponibilidades }) };
}
