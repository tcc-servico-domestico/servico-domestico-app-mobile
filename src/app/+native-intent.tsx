import { sessionStore } from '@/src/shared/runtime';

const protectedPaths = new Set(['/home', '/servicos', '/imoveis', '/agenda', '/pagamentos', '/profissional-perfil', '/perfil', '/conta', '/perfil-profissional']);

function routePath(path: string): string {
  try {
    const url = new URL(path, 'https://app.invalid');
    const pathname = url.protocol === 'servicodomestico:' ? `/${url.host}${url.pathname}` : url.pathname;
    return decodeURIComponent(pathname).replace(/^\/--(?=\/)/, '').replace(/\/+$|\/(?:\([^/]+\))(?=\/)/g, '') || '/';
  } catch {
    return '';
  }
}

export async function redirectSystemPath({ path }: { path: string }): Promise<string> {
  const route = routePath(path);
  if (!protectedPaths.has(route)) return path;
  try {
    const session = await sessionStore.load();
    if (!session || (['/perfil-profissional', '/profissional-perfil', '/agenda'].includes(route) && !session.roles.includes('Profissional')) || (route === '/imoveis' && !session.roles.includes('Cliente'))) {
      return '/acesso-negado';
    }
    return path;
  } catch {
    return '/acesso-negado';
  }
}
