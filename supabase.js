// Configurazione di Supabase (Pronto per essere collegato)
const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT_URL.supabase.co';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Inizializzazione del client globale
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
