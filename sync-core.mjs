export const emptyState = () => ({tasks: [], people: [], travels: [], meals: '', shopping: ''});
export function nextRevision(remote, base) {
  const actual = remote?.revision ?? 0;
  if (!Number.isSafeInteger(actual) || actual < 0 || actual !== base) {
    throw new Error('conflict');
  }
  return actual + 1;
}
export function hasData(data) {
  return data.tasks.length + data.people.length + data.travels.length > 0 || !!data.meals || !!data.shopping || !!data.features?.routines?.length || !!data.features?.packingUrl;
}
