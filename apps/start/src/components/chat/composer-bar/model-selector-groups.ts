import { getCatalogModel } from '@/lib/shared/ai-catalog'
import type { CatalogProviderId } from '@/lib/shared/ai-catalog/provider-tools'

/** Keeps policy-filtered options intact while separating legacy rows per provider. */
export function groupModelsByProvider<T extends { readonly id: string }>(
  options: readonly T[],
) {
  const groups = new Map<
    CatalogProviderId,
    { providerId: CatalogProviderId; current: T[]; legacy: T[] }
  >()
  for (const option of options) {
    const model = getCatalogModel(option.id)
    if (!model) continue
    let group = groups.get(model.providerId)
    if (!group) {
      group = { providerId: model.providerId, current: [], legacy: [] }
      groups.set(model.providerId, group)
    }
    group[model.legacy ? 'legacy' : 'current'].push(option)
  }
  return Array.from(groups.values())
}
