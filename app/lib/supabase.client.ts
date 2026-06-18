import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://ananwznqnjxvvqfkbvzm.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);
