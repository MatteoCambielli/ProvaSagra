// Configurazione di Supabase
const SUPABASE_URL = 'https://vcjfirupaltmfzszxbuo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_woZSZz90aAfJ53RN8QnyIw__h4PhKX8';

// Inizializzazione del client globale
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
