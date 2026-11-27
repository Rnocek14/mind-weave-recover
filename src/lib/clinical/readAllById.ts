// PostgREST may apply a lower row cap than the requested page size. Stop only
// at an empty page and use the primary key, so a retry cannot shift an offset.
export async function readAllById<T extends { id: string }>(
  read: (after: string | null) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  let after: string | null = null;
  for (;;) {
    const { data, error } = await read(after);
    if (error) throw error;
    if (!data) throw new Error("Missing data page");
    if (!data.length) return rows;
    const next = data[data.length - 1].id;
    if (after !== null && next <= after) throw new Error("The data cursor did not advance");
    rows.push(...data);
    after = next;
  }
}
