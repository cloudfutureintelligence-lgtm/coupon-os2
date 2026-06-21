import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zreowomhxdepihnohmce.supabase.co';
const supabaseKey = 'sb_publishable_iRzuLHeNoPunGL0lfDUQuQ_jEpA09V5';

export const supabase = createClient(supabaseUrl, supabaseKey);
