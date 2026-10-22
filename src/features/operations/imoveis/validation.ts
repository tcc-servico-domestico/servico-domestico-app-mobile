import type { SaveImovelInput } from '@/src/features/operations/contracts/imoveis';

export type ImovelFormValues = Record<
  'descricao' | 'metragemQuadrada' | 'latitude' | 'longitude' | 'logradouro' | 'numero' |
  'complemento' | 'bairro' | 'cidade' | 'uf' | 'cep',
  string
>;

export type ImovelFormErrors = Partial<Record<keyof ImovelFormValues, string>>;

export const emptyImovelForm: ImovelFormValues = {
  descricao: '', metragemQuadrada: '', latitude: '', longitude: '', logradouro: '', numero: '',
  complemento: '', bairro: '', cidade: '', uf: '', cep: '',
};

function numberFrom(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function required(value: string, max: number, field: string, min = 1): string | undefined {
  const length = value.trim().length;
  if (length < min || length > max) return `${field} deve ter entre ${min} e ${max} caracteres.`;
  return undefined;
}

export function validateImovel(values: ImovelFormValues): ImovelFormErrors {
  const errors: ImovelFormErrors = {};
  const descricao = values.descricao.trim();
  const metragem = numberFrom(values.metragemQuadrada);
  const latitude = numberFrom(values.latitude);
  const longitude = numberFrom(values.longitude);
  const numero = numberFrom(values.numero);

  if (descricao && (descricao.length > 200)) errors.descricao = 'Descrição deve ter no máximo 200 caracteres.';
  if (values.metragemQuadrada.trim() && (metragem === null || metragem <= 0)) errors.metragemQuadrada = 'Metragem deve ser maior que zero.';
  if (latitude === null || latitude < -90 || latitude > 90) errors.latitude = 'Latitude deve estar entre -90 e 90.';
  if (longitude === null || longitude < -180 || longitude > 180) errors.longitude = 'Longitude deve estar entre -180 e 180.';
  if (numero !== null && (!Number.isInteger(numero) || numero < 0)) errors.numero = 'Número deve ser um inteiro não negativo.';
  errors.logradouro = required(values.logradouro, 200, 'Logradouro');
  errors.bairro = required(values.bairro, 100, 'Bairro');
  errors.cidade = required(values.cidade, 80, 'Cidade');
  if (!/^[A-Za-z]{2}$/.test(values.uf.trim())) errors.uf = 'UF deve conter duas letras.';
  if (!/^\d{5}-?\d{3}$/.test(values.cep.trim())) errors.cep = 'CEP deve ter o formato 00000-000.';
  if (values.complemento.trim().length > 100) errors.complemento = 'Complemento deve ter no máximo 100 caracteres.';

  return Object.fromEntries(Object.entries(errors).filter(([, error]) => error)) as ImovelFormErrors;
}

export function toSaveImovelInput(values: ImovelFormValues): SaveImovelInput {
  const errors = validateImovel(values);
  if (Object.keys(errors).length > 0) throw new Error('Dados do imóvel inválidos.');

  return {
    descricao: values.descricao.trim() || null,
    metragemQuadrada: numberFrom(values.metragemQuadrada),
    latitude: numberFrom(values.latitude)!,
    longitude: numberFrom(values.longitude)!,
    endereco: {
      logradouro: values.logradouro.trim(),
      numero: numberFrom(values.numero),
      complemento: values.complemento.trim() || null,
      bairro: values.bairro.trim(),
      cidade: values.cidade.trim(),
      uf: values.uf.trim().toUpperCase(),
      cep: values.cep.trim(),
    },
  };
}

export function toImovelFormValues(input: SaveImovelInput): ImovelFormValues {
  return {
    descricao: input.descricao ?? '',
    metragemQuadrada: input.metragemQuadrada?.toString() ?? '',
    latitude: input.latitude.toString(), longitude: input.longitude.toString(),
    logradouro: input.endereco.logradouro, numero: input.endereco.numero?.toString() ?? '',
    complemento: input.endereco.complemento ?? '', bairro: input.endereco.bairro,
    cidade: input.endereco.cidade, uf: input.endereco.uf, cep: input.endereco.cep,
  };
}
