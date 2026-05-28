/**
 * Archetype access tiers.
 *
 * Free users (Initiate) get a preview of the encyclopedia: two archetypes —
 * TDI ("The Playette") and TJI ("The Social Butterfly"). The remaining six
 * are gated behind Strategist. Admins always bypass at the route/component
 * level via the `useSubscription().isAdmin` flag.
 *
 * Keep this list in sync with `personalityTypes.ts`. If you add a new free
 * archetype, you also need to update:
 *   - LandingPage ARCHETYPES preview list
 *   - PricingPage features list and comparison table copy
 */
export const FREE_ARCHETYPE_IDS = ['TDI', 'TJI'] as const;

export type FreeArchetypeId = typeof FREE_ARCHETYPE_IDS[number];

/** True if the archetype id is part of the free preview tier. */
export function isFreeArchetype(id: string): boolean {
  return (FREE_ARCHETYPE_IDS as readonly string[]).includes(id);
}
