import { supabase } from '../../supabaseClient';

export async function callRpc<T = unknown>(
  functionName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw error;
  return data as T;
}
