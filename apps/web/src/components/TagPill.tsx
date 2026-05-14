import { Badge } from './ui/Badge';
import { useTagCatalog, type TagTone } from '../hooks/useTagCatalog';

export function TagPill({ tag }: { tag: string }) {
  const q = useTagCatalog();
  const catalog = q.data ?? [];
  const norm = tag.trim().toLowerCase();
  const fromCatalog = catalog.find((t) => t.name.toLowerCase() === norm);
  const tone: TagTone =
    fromCatalog?.tone ??
    (norm === 'ui/ux improvement' || norm === 'ui ux improvement' || norm === 'ui/ux'
      ? 'indigo'
      : norm.includes('incident')
        ? 'rose'
        : norm.includes('sla')
          ? 'amber'
          : 'default');
  return <Badge tone={tone}>{tag}</Badge>;
}

