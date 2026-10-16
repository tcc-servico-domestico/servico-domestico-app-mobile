export type QueryValue = string | number | boolean | null | undefined;

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly code: string;
  readonly traceId: string;
  readonly errors?: Readonly<Record<string, readonly string[]>>;
}

export interface HttpRequestOptions {
  readonly query?: Readonly<Record<string, QueryValue>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export interface OperationsHttpClient {
  get<TResponse>(path: string, options?: HttpRequestOptions): Promise<TResponse>;
  post<TResponse>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<TResponse>;
  put<TResponse>(path: string, body: unknown, options?: HttpRequestOptions): Promise<TResponse>;
  patch<TResponse>(path: string, body: unknown, options?: HttpRequestOptions): Promise<TResponse>;
  delete<TResponse>(path: string, options?: HttpRequestOptions): Promise<TResponse>;
}
