import { fetch } from 'expo/fetch';
import { getAccessToken } from './msAuth';

/** Acesso ao OneDrive pela Microsoft Graph API. */
const GRAPH = 'https://graph.microsoft.com/v1.0';

export interface DriveItem {
  id: string;
  name: string;
  size?: number;
  eTag?: string;
  /** Muda só quando o conteúdo muda (o eTag muda também com renomear/mover). */
  cTag?: string;
  lastModifiedDateTime?: string;
  folder?: { childCount: number };
  /** sha1Hash existe no OneDrive pessoal; serve para conferir o download. */
  file?: { mimeType?: string; hashes?: { sha1Hash?: string; quickXorHash?: string } };
  parentReference?: { id?: string; driveId?: string; path?: string };
}

export class GraphError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Erro de rede (sem internet, timeout) — a alteração fica pendente para reenviar. */
export class OfflineError extends Error {}

const ITEM_FIELDS = 'id,name,size,eTag,cTag,lastModifiedDateTime,folder,file,parentReference';

async function request(path: string, init: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
  const token = await getAccessToken();
  const method = init.method || 'GET';
  // O fetch do Android (OkHttp) tem cache em disco: sem isso, o download do /content
  // (redirecionado para a URL do OneDrive) pode devolver uma versão antiga do arquivo.
  const noCache: Record<string, string> = method === 'GET' ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : {};
  let res;
  try {
    res = await fetch(`${GRAPH}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...noCache, ...(init.headers || {}) },
      body: init.body,
    });
  } catch (err: any) {
    throw new OfflineError(err?.message || 'Sem conexão com a internet');
  }
  return res;
}

async function ensureOk(res: Awaited<ReturnType<typeof request>>, context: string) {
  if (res.ok) return res;
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message || '';
  } catch (_) {}
  throw new GraphError(res.status, `${context} (${res.status})${detail ? `: ${detail}` : ''}`);
}

function itemPathByParent(parentId: string, name: string) {
  return `/me/drive/items/${parentId}:/${encodeURIComponent(name)}:`;
}

export async function getProfile(): Promise<{ displayName?: string; userPrincipalName?: string; mail?: string }> {
  const res = await ensureOk(await request('/me?$select=displayName,userPrincipalName,mail'), 'Falha ao ler perfil');
  return res.json();
}

/** Lista o conteúdo de uma pasta (raiz quando folderId é null). */
export async function listChildren(folderId: string | null): Promise<DriveItem[]> {
  const base = folderId ? `/me/drive/items/${folderId}/children` : '/me/drive/root/children';
  let url: string | null = `${base}?$select=${ITEM_FIELDS}&$top=200`;
  const items: DriveItem[] = [];
  while (url) {
    const res = await ensureOk(await request(url), 'Falha ao listar pasta');
    const body: any = await res.json();
    items.push(...(body.value || []));
    const next: string | undefined = body['@odata.nextLink'];
    url = next ? next.replace(GRAPH, '') : null;
  }
  return items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export async function getItem(itemId: string): Promise<DriveItem> {
  const res = await ensureOk(await request(`/me/drive/items/${itemId}?$select=${ITEM_FIELDS}`), 'Falha ao ler arquivo');
  return res.json();
}

export async function downloadItem(itemId: string): Promise<Uint8Array> {
  const res = await ensureOk(await request(`/me/drive/items/${itemId}/content`), 'Falha ao baixar arquivo');
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Substitui o conteúdo de um arquivo somente se ele ainda estiver na versão `ifMatch`.
 * Retorna null quando o arquivo foi alterado por outro dispositivo (HTTP 412).
 */
export async function uploadItem(itemId: string, bytes: Uint8Array, ifMatch: string): Promise<DriveItem | null> {
  const res = await request(`/me/drive/items/${itemId}/content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream', 'If-Match': ifMatch },
    body: bytes,
  });
  if (res.status === 412) return null;
  await ensureOk(res, 'Falha ao enviar arquivo');
  return res.json();
}

/** Cria ou substitui um arquivo pelo nome dentro de uma pasta. */
export async function putFileInFolder(parentId: string, name: string, content: Uint8Array | string, contentType = 'application/octet-stream') {
  const res = await request(`${itemPathByParent(parentId, name)}/content`, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: content,
  });
  await ensureOk(res, `Falha ao gravar ${name}`);
  return (await res.json()) as DriveItem;
}

/** Lê um arquivo de texto pelo nome dentro de uma pasta (null se não existir). */
export async function readTextInFolder(parentId: string, name: string): Promise<string | null> {
  const res = await request(`${itemPathByParent(parentId, name)}/content`);
  if (res.status === 404) return null;
  await ensureOk(res, `Falha ao ler ${name}`);
  return res.text();
}

export async function deleteInFolder(parentId: string, name: string) {
  const res = await request(itemPathByParent(parentId, name), { method: 'DELETE' });
  if (res.status !== 404) await ensureOk(res, `Falha ao remover ${name}`);
}
