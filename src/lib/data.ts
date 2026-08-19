import { supabase } from '../supabaseClient';

export async function getRecords<T>(
  table: string,
  options: { select?: string; filters?: Record<string, string | string[]>; order?: string } = {},
): Promise<T[]> {
  let query = supabase.from(table).select(options.select ?? '*');
  for (const [column, value] of Object.entries(options.filters ?? {})) {
    query = Array.isArray(value) ? query.in(column, value) : query.eq(column, value);
  }
  if (options.order) query = query.order(options.order);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function insertRecord<T>(table: string, row: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data as T;
}
