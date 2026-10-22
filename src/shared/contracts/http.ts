export type QueryValue = string | number | boolean | null | undefined;

export interface ProblemDetails {
  readonly type?: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly code?: string;
  readonly traceId?: string;
  readonly correlationId?: string;
  readonly errors?: Readonly<Record<string, readonly string[]>>;
}

export interface HttpRequestOptions {
  readonly query?: Readonly<Record<string, QueryValue>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export interface HttpClientOptions {
  readonly baseUrl: string;
  readonly getAccessToken?: () => Promise<string | null>;
  readonly onUnauthorized?: () => Promise<void> | void;
}

export class HttpProblemError extends Error {
  constructor(public readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'HttpProblemError';
  }
}

export interface OperationsHttpClient {
  get<TResponse>(path: string, options?: HttpRequestOptions): Promise<TResponse>;
  post<TResponse>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<TResponse>;
  put<TResponse>(path: string, body: unknown, options?: HttpRequestOptions): Promise<TResponse>;
  patch<TResponse>(path: string, body: unknown, options?: HttpRequestOptions): Promise<TResponse>;
  delete<TResponse>(path: string, options?: HttpRequestOptions): Promise<TResponse>;
}
