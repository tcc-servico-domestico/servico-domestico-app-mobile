import {
  HttpClientOptions,
  HttpProblemError,
  HttpRequestOptions,
  OperationsHttpClient,
  ProblemDetails,
  QueryValue,
} from '@/src/shared/contracts/http';

function appendQuery(url: URL, query?: Readonly<Record<string, QueryValue>>) {
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  });
}

function fallbackProblem(status: number, correlationId: string | null): ProblemDetails {
  return {
    title: 'Não foi possível concluir a solicitação.',
    status,
    correlationId: correlationId ?? undefined,
  };
}

export function createFetchHttpClient(config: HttpClientOptions): OperationsHttpClient {
  async function request<TResponse>(
    method: string,
    path: string,
    body?: unknown,
    options: HttpRequestOptions = {},
  ): Promise<TResponse> {
    const url = new URL(path, `${config.baseUrl.replace(/\/$/, '')}/`);
    appendQuery(url, options.query);

    const token = await config.getAccessToken?.();
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: options.signal,
      });
    } catch (cause) {
      throw new HttpProblemError({
        title: 'Serviço indisponível.',
        status: 0,
        detail: cause instanceof Error ? cause.message : undefined,
        code: 'network_error',
      });
    }

    if (response.status === 401) await config.onUnauthorized?.();
    if (!response.ok) {
      const contentType = response.headers.get('content-type') ?? '';
      const problem = contentType.includes('json')
        ? ((await response.json()) as ProblemDetails)
        : fallbackProblem(response.status, response.headers.get('x-correlation-id'));
      throw new HttpProblemError({ ...fallbackProblem(response.status, null), ...problem, status: response.status });
    }

    if (response.status === 204) return undefined as TResponse;
    return (await response.json()) as TResponse;
  }

  return {
    get: (path, options) => request('GET', path, undefined, options),
    post: (path, body, options) => request('POST', path, body, options),
    put: (path, body, options) => request('PUT', path, body, options),
    patch: (path, body, options) => request('PATCH', path, body, options),
    delete: (path, options) => request('DELETE', path, undefined, options),
  };
}
