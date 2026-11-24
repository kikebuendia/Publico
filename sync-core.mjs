export const emptyState = () => ({tasks: [], people: [], travels: [], meals: '', shopping: ''});
export function nextRevision(remote, base) {
  const actual = remote?.revision ?? 0;
  if (!Number.isSafeInteger(actual) || actual < 0 || actual !== base) {
    throw new Error('conflict');
  }
  return actual + 1;
}
export function hasData(data) {
  const personal = data.features?.personal;
  return !!(personal?.procedures?.length || personal?.savings?.length || personal?.plans?.length || personal?.purchases?.length)
    || !!data.features?.monthlyReminders?.length
    || Object.keys(data.features?.menu ?? {}).length > 0
    || Object.values(data.features?.records ?? {}).some(day => !!day['menu-descongelar'])
    || data.tasks.length + data.people.length + data.travels.length > 0 || !!data.meals || !!data.shopping || !!data.features?.routines?.length || !!data.features?.packingUrl;
}
