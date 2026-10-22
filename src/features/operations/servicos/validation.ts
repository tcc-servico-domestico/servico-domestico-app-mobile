import type { CreateServicoInput, RaioBuscaKm } from '@/src/features/operations/contracts/servicos';

export interface ChecklistFormValue {
  readonly id: string;
  readonly descricao: string;
}

export interface ServicoFormValues {
  readonly imovelId: string;
  readonly dataInicio: string;
  readonly horaInicio: string;
  readonly dataFim: string;
  readonly horaFim: string;
  readonly raioBuscaKm: RaioBuscaKm;
  readonly valor: string;
  readonly checklists: readonly ChecklistFormValue[];
}

export type ServicoFormErrors = Partial<Record<Exclude<keyof ServicoFormValues, 'checklists'> | 'checklists', string>> & {
  readonly checklistItems?: Readonly<Record<string, string>>;
};

export const allowedRadii: readonly RaioBuscaKm[] = [5, 10, 20, 30, 50];

export const emptyServicoForm: ServicoFormValues = {
  imovelId: '', dataInicio: '', horaInicio: '', dataFim: '', horaFim: '', raioBuscaKm: 10, valor: '',
  checklists: [{ id: 'first', descricao: '' }],
};

function parseDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const parsed = { year: Number(year), month: Number(month), day: Number(day) };
  const utc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  return utc.getUTCFullYear() === parsed.year && utc.getUTCMonth() === parsed.month - 1 && utc.getUTCDate() === parsed.day
    ? parsed : null;
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const parsed = { hour: Number(match[1]), minute: Number(match[2]) };
  return parsed.hour < 24 && parsed.minute < 60 ? parsed : null;
}

/** A agenda do contrato é fixa em America/Sao_Paulo (UTC-03:00 na versão atual). */
export function saoPauloToUtcIso(dateValue: string, timeValue: string): string | null {
  const date = parseDate(dateValue);
  const time = parseTime(timeValue);
  if (!date || !time) return null;
  const local = `${date.year.toString().padStart(4, '0')}-${date.month.toString().padStart(2, '0')}-${date.day.toString().padStart(2, '0')}T${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')}:00-03:00`;
  const instant = new Date(local);
  return Number.isNaN(instant.valueOf()) ? null : instant.toISOString();
}

function parseMoney(value: string): number | null {
  const raw = value.trim();
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const result = Number(normalized);
  return Number.isFinite(result) && result > 0 ? result : null;
}

export function validateServico(values: ServicoFormValues, now = Date.now()): ServicoFormErrors {
  const errors: ServicoFormErrors = {};
  const inicio = saoPauloToUtcIso(values.dataInicio, values.horaInicio);
  const fim = saoPauloToUtcIso(values.dataFim, values.horaFim);
  if (!values.imovelId) errors.imovelId = 'Selecione um imóvel.';
  if (!inicio) {
    errors.dataInicio = 'Informe uma data inicial válida no formato DD/MM/AAAA.';
    errors.horaInicio = 'Informe uma hora inicial válida no formato HH:mm.';
  } else if (new Date(inicio).valueOf() <= now) errors.dataInicio = 'O início previsto deve estar no futuro.';
  if (!fim) {
    errors.dataFim = 'Informe uma data final válida no formato DD/MM/AAAA.';
    errors.horaFim = 'Informe uma hora final válida no formato HH:mm.';
  } else if (inicio && new Date(fim).valueOf() <= new Date(inicio).valueOf()) errors.dataFim = 'O fim deve ser posterior ao início.';
  if (!allowedRadii.includes(values.raioBuscaKm)) errors.raioBuscaKm = 'Selecione um raio de busca permitido.';
  if (parseMoney(values.valor) === null) errors.valor = 'Informe um valor positivo com até duas casas decimais.';
  if (values.checklists.length === 0) errors.checklists = 'Inclua ao menos uma checklist.';
  const checklistItems: Record<string, string> = {};
  values.checklists.forEach((item) => {
    const length = item.descricao.trim().length;
    if (length < 1 || length > 300) checklistItems[item.id] = 'A checklist deve ter entre 1 e 300 caracteres.';
  });
  return Object.keys(checklistItems).length ? { ...errors, checklistItems } : errors;
}

export function toCreateServicoInput(values: ServicoFormValues): CreateServicoInput {
  const errors = validateServico(values);
  if (Object.keys(errors).length) throw new Error('Dados do serviço inválidos.');
  return {
    imovelId: values.imovelId,
    inicioPrevisto: saoPauloToUtcIso(values.dataInicio, values.horaInicio)!,
    fimPrevisto: saoPauloToUtcIso(values.dataFim, values.horaFim)!,
    raioBuscaKm: values.raioBuscaKm,
    valor: parseMoney(values.valor)!,
    checklists: values.checklists.map((item, index) => ({ descricao: item.descricao.trim(), ordem: index + 1 })),
  };
}
