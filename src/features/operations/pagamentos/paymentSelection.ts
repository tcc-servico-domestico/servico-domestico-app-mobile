export interface PaymentSelection {
  readonly selectedId: string | null;
  readonly initialized: boolean;
}

export type PaymentSelectionAction =
  | { readonly type: 'loaded'; readonly trackedId?: string }
  | { readonly type: 'open'; readonly id: string }
  | { readonly type: 'back' };

export function paymentSelectionReducer(state: PaymentSelection, action: PaymentSelectionAction): PaymentSelection {
  if (action.type === 'open') return { initialized: true, selectedId: action.id };
  if (action.type === 'back') return { initialized: true, selectedId: null };
  if (state.initialized) return state;
  return { initialized: true, selectedId: state.selectedId ?? action.trackedId ?? null };
}
