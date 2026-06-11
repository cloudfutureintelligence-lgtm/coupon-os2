import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ckmmidhudgkdhnocyruq.supabase.co';
const supabaseKey = 'sb_publishable_t9qD0UjaiG-JSX-DdJHXVQ_IAwqA8k7';

export const supabase = createClient(supabaseUrl, supabaseKey);
