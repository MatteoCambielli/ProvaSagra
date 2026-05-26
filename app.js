const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        // Stato Autenticazione (PIN criptato in SHA-256 per massima sicurezza)
        const HASH_PIN_VALIDO = "a63b0e3df021b33946261cddc24eb066d18a28e50b1c94d3ed0d8ea9c8114f04"; // Corrisponde a 26863
        const isAuthenticated = ref(localStorage.getItem('sagra_auth') === 'true');
        const pinInput = ref('');
        const loginError = ref(false);

        // Navigazione delle viste
        const currentView = ref('dashboard');
        const viewTitles = {
            'dashboard': 'Dashboard Principale',
            'nuovo-ordine': 'Gestione Menu & Comande',
            'storico-ordini': 'Flusso Ordini (Cucina e Cassa)'
        };

        // Filtri per la vista Storico
        const filtroTavolo = ref('');
        const filtroStato = ref('tutti'); // 'tutti', 'pagato', 'non-pagato'

        // Database Menu Mock (Struttura adatta alla Sagra)
        const menu = ref({
            'Primi Piatti': [
                { id: 1, nome: 'Pasta al Ragù', prezzo: 10.00 },
                { id: 2, nome: 'Gnocchi al Ragù di Cinghiale', prezzo: 12.00 },
                { id: 3, nome: 'Risotto ai Funghi', prezzo: 10.00 }
            ],
            'Secondi & Contorni': [
                { id: 4, nome: 'Grigliata Mista di Carne', prezzo: 15.00 },
                { id: 5, nome: 'Patatine Fritte', prezzo: 6.00 },
                { id: 6, nome: 'Verdure alla Griglia', prezzo: 5.00 }
            ],
            'Bevande': [
                { id: 7, nome: 'Acqua Naturale/Frizzante', prezzo: 2.00 },
                { id: 8, nome: 'Birra Artigianale 0.4L', prezzo: 5.50 },
                { id: 9, nome: 'Vino Rosso locale (Litro)', prezzo: 8.00 }
            ]
        });

        // Stato Nuovo Ordine in creazione
        const nuovoOrdine = ref({
            tavolo: '',
            note: '',
            carrello: []
        });

        // Storico Ordini (Caricato inizialmente con l'ordine delle tue foto per test immediato)
        const ordini = ref([
            {
                id: 13,
                tavolo: '78',
                orario: '18:29',
                totale: 16.00,
                pagato: true,
                cucinaCompletata: true,
                orarioCucina: '18:29',
                orarioPagamento: '18:29',
                note: 'Tutto insieme',
                piatti: [
                    { id: 1, nome: 'Pasta al Ragù', prezzo: 10.00, qta: 1 },
                    { id: 5, nome: 'Patatine Fritte', prezzo: 6.00, qta: 1 }
                ]
            }
        ]);

        // FUNZIONI LOGIN (Crittografia nativa del browser)
        async function calcolaHash(stringa) {
            const msgUint8 = new TextEncoder().encode(stringa);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        async function handleLogin() {
            const hashInserito = await calcolaHash(pinInput.value);
            if (hashInserito === HASH_PIN_VALIDO) {
                isAuthenticated.value = true;
                localStorage.setItem('sagra_auth', 'true');
                loginError.value = false;
                pinInput.value = '';
            } else {
                loginError.value = true;
                pinInput.value = '';
            }
        }

        function logout() {
            isAuthenticated.value = false;
            localStorage.removeItem('sagra_auth');
            currentView.value = 'dashboard';
        }

        // LOGICA CARRELLO
        function aggiungiAlCarrello(piatto) {
            const esistente = nuovoOrdine.value.carrello.find(item => item.id === piatto.id);
            if (esistente) {
                esistente.qta++;
            } else {
                nuovoOrdine.value.carrello.push({ ...piatto, qta: 1 });
            }
        }

        function rimuoviDalCarrello(piatto) {
            const esistente = nuovoOrdine.value.carrello.find(item => item.id === piatto.id);
            if (esistente) {
                esistente.qta--;
                if (esistente.qta <= 0) {
                    nuovoOrdine.value.carrello = nuovoOrdine.value.carrello.filter(item => item.id !== piatto.id);
                }
            }
        }

        const totaleCarrello = computed(() => {
            return nuovoOrdine.value.carrello.reduce((acc, item) => acc + (item.prezzo * item.qta), 0);
        });

        // INVIO ORDINE (Collegabile a Supabase)
        function inviaOrdine() {
            if (!nuovoOrdine.value.tavolo) {
                alert("Per favore inserisci il numero del tavolo!");
                return;
            }

            const adesso = new Date();
            const orarioStringa = adesso.getHours().toString().padStart(2, '0') + ':' + adesso.getMinutes().toString().padStart(2, '0');

            const idNuovo = ordini.value.length > 0 ? Math.max(...ordini.value.map(o => o.id)) + 1 : 1;

            const ordineFinito = {
                id: idNuovo,
                tavolo: nuovoOrdine.value.tavolo,
                note: nuovoOrdine.value.note,
                orario: orarioStringa,
                totale: totaleCarrello.value,
                pagato: false,
                cucinaCompletata: false,
                orarioCucina: '',
                orarioPagamento: '',
                piatti: [...nuovoOrdine.value.carrello]
            };

            // Inserimento nello storico locale (Per ora)
            ordini.value.unshift(ordineFinito);

            // TODO: INTEGRAZIONE SUPABASE
            // supabaseClient.from('ordini').insert([ordineFinito]).then(...)

            // Resetta modulo
            nuovoOrdine.value.tavolo = '';
            nuovoOrdine.value.note = '';
            nuovoOrdine.value.carrello = [];
            
            // Vai allo storico per vedere lo stato dell'ordine
            currentView.value = 'storico-ordini';
        }

        // CAMBIO STATO FLUSSI (CUCINA / CASSA)
        function toggleCucina(ordine) {
            ordine.cucinaCompletata = !ordine.cucinaCompletata;
            if (ordine.cucinaCompletata) {
                const adesso = new Date();
                ordine.orarioCucina = adesso.getHours().toString().padStart(2, '0') + ':' + adesso.getMinutes().toString().padStart(2, '0');
            }
            // TODO: Aggiorna su Supabase .update()
        }

        function togglePagamento(ordine) {
            ordine.pagato = !ordine.pagato;
            if (ordine.pagato) {
                const adesso = new Date();
                ordine.orarioPagamento = adesso.getHours().toString().padStart(2, '0') + ':' + adesso.getMinutes().toString().padStart(2, '0');
            }
            // TODO: Aggiorna su Supabase .update()
        }

        // AGGREGATORI E STATISTICHE COMPUTED
        const incassoTotale = computed(() => {
            return ordini.value.filter(o => o.pagato).reduce((acc, o) => acc + o.totale, 0);
        });

        const ordiniAttivi = computed(() => {
            return ordini.value.filter(o => !o.cucinaCompletata || !o.pagato).length;
        });

        const ordiniFiltrati = computed(() => {
            return ordini.value.filter(o => {
                const matchTavolo = o.tavolo.toString().includes(filtroTavolo.value);
                const matchStato = 
                    filtroStato.value === 'tutti' ? true :
                    filtroStato.value === 'pagato' ? o.pagato : !o.pagato;
                return matchTavolo && matchStato;
            });
        });

        return {
            isAuthenticated, pinInput, loginError, handleLogin, logout,
            currentView, viewTitles, menu, nuovoOrdine, ordini,
            aggiungiAlCarrello, rimuoviDalCarrello, totaleCarrello, inviaOrdine,
            filtroTavolo, filtroStato, ordiniFiltrati, incassoTotale, ordiniAttivi,
            toggleCucina, togglePagamento
        };
    }
}).mount('#app');
