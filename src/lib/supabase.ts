import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://svtivgfdskqxkkqlhaej.supabase.co';
const supabaseAnonKey = 'sb_publishable_uvLwLTsBcT8JKQdZx8tykw_L89WW0UB';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
