import { describe, expect, it } from 'vitest';
import { editarPerfil, validarPerfil } from './validation';

const form = {
  habilidades: [' Limpeza ', 'Limpeza'],
  areas: [{ latitude: '-15,78', longitude: '-47.92' }],
  disponibilidades: [{ dia: '29/02/2028', horaInicio: '22:00', horaFim: '02:00' }],
};

describe('validação do perfil', () => {
  it('normaliza coordenadas, habilidades e horários locais na virada de dia', () => {
    expect(validarPerfil(form)).toEqual({ dados: {
      habilidades: ['Limpeza'],
      areas: [{ latitude: -15.78, longitude: -47.92 }],
      disponibilidades: [{ dia: '2028-02-29', horaInicio: '22:00:00', horaFim: '02:00:00' }],
    } });
  });

  it('valida limites inclusivos e aceita remover todas as faixas', () => {
    const resultado = validarPerfil({ ...form, areas: [{ latitude: '-90', longitude: '180' }], disponibilidades: [] });
    expect(resultado).toMatchObject({ dados: { areas: [{ latitude: -90, longitude: 180 }], disponibilidades: [] } });
  });

  it('identifica habilidades vazias, coordenadas fora do limite e data ou hora inválida', () => {
    expect(validarPerfil({
      habilidades: [' '],
      areas: [{ latitude: '-91', longitude: '' }],
      disponibilidades: [
        { dia: '29/02/2027', horaInicio: '25:00', horaFim: '22:00' },
        { dia: '2026-11-20', horaInicio: '10:00', horaFim: '10:00:00.000' },
      ],
    })).toMatchObject({ erros: {
      'habilidades.0': expect.any(String), 'areas.0.latitude': expect.any(String), 'areas.0.longitude': expect.any(String),
      'disponibilidades.0.dia': expect.any(String), 'disponibilidades.0.horaInicio': expect.any(String),
      'disponibilidades.1.horaFim': expect.any(String),
    } });
  });

  it('regrava coordenadas pequenas exibidas em notação científica', () => {
    const dados = { habilidades: ['Limpeza'], areas: [{ latitude: 1e-9, longitude: -2e-8 }], disponibilidades: [] };
    expect(validarPerfil(editarPerfil(dados))).toEqual({ dados });
  });

  it('preserva segundos e frações das faixas existentes', () => {
    const dados = {
      habilidades: ['Limpeza'],
      areas: [{ latitude: -15.78, longitude: -47.92 }],
      disponibilidades: [{ dia: '2026-11-20', horaInicio: '10:00:01.123456', horaFim: '14:00:01' }],
    };
    expect(validarPerfil(editarPerfil(dados))).toEqual({ dados });
  });
});
