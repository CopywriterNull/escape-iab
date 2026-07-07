// Strict UUID shape guard: every id arriving from a form field must match
// a real PK shape before it is used in a DB filter. Prevents accidental
// "match many rows" writes from empty or partially-typed values.
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
