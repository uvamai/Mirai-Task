import { useQuery } from '@tanstack/react-query';
import { apiJson } from '../api/client';

export type TagTone = 'default' | 'indigo' | 'amber' | 'rose' | 'emerald';
export type TagCatalogItem = { name: string; tone: TagTone };

export function useTagCatalog() {
  return useQuery({
    queryKey: ['tenant-tag-catalog'],
    queryFn: async () => {
      const res = await apiJson<{ settings: Record<string, unknown> }>('/tenant/settings');
      const raw = res.settings.tagCatalog;
      const arr = Array.isArray(raw) ? raw : [];
      const items: TagCatalogItem[] = [];
      for (const x of arr) {
        if (!x || typeof x !== 'object') continue;
        const o = x as Record<string, unknown>;
        const name = typeof o.name === 'string' ? o.name.trim() : '';
        const tone = typeof o.tone === 'string' ? (o.tone as TagTone) : 'default';
        if (!name) continue;
        if (!['default', 'indigo', 'amber', 'rose', 'emerald'].includes(tone)) continue;
        items.push({ name, tone });
      }
      return items;
    },
    staleTime: 5 * 60_000,
  });
}

