// Configurazione di Supabase
const SUPABASE_URL = 'https://xurlmqpdzgspvihridva.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1SIFclDhSwnsISlEEvjIgQ_QGH3BYkx';

// Inizializzazione del client globale
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
