const { createApp, ref, computed } = Vue;

createApp({
    setup() {
        // AUTENTICAZIONE E SICUREZZA
        const HASH_PIN_VALIDO = "a63b0e3df021b33946261cddc24eb066d18a28e50b1c94d3ed0d8ea9c8114f04"; // PIN 26863
        const isAuthenticated = ref(localStorage.getItem('sagra_auth') === 'true');
        const pinInput = ref('');
        const loginError = ref(false);

        // NAVIGAZIONE
        const currentView = ref('dashboard');
        const viewTitles = {
            'dashboard': 'Pannello Statistiche',
            'nuovo-ordine': 'Crea Nuova Ordinazione',
            'cucina': 'Monitor Comande Cucina',
            'cassa': 'Gestione Scontrini e Cassa',
            'menu-manager': 'Configurazione Listino Prezzi'
        };

        // GESTIONE LISTINO MENU
        const menu = ref({
            'Primi Piatti': [
                { id: 1, nome: 'Pasta al Ragù', prezzo: 10.00 },
                { id: 2, nome: 'Gnocchi al Cinghiale', prezzo: 12.00 }
            ],
            'Secondi Piatti': [
                { id: 4, nome: 'Grigliata Mista', prezzo: 15.00 },
                { id: 5, nome: 'Patatine Fritte', prezzo: 6.00 }
            ],
            'Bevande': [
                { id: 7, nome: 'Acqua Naturale 1L', prezzo: 2.00 },
                { id: 8, nome: 'Birra Artigianale', prezzo: 5.50 }
            ]
        });

        const nuovoPiattoListino = ref({ nome: '', prezzo: 5.00, categoria: 'Primi Piatti' });

        // STRUTTURA COMANDE
        const nuovoOrdine = ref({ tavolo: '', note: '', carrello: [] });
        const ordini = ref([
            {
                id: 1,
                tavolo: '12',
                orario: '20:15',
                totale: 28.00,
                pagato: false,
                cucinaCompletata: false,
                note: 'Gnocchi senza formaggio',
                piatti: [
                    { id: 2, nome: 'Gnocchi al Cinghiale', prezzo: 12.00, qta: 1 },
                    { id: 4, nome: 'Grigliata Mista', prezzo: 15.00, qta: 1 }
                ]
            }
        ]);

        // FUNZIONI DI AUTENTICAZIONE (Crypto nativo del browser)
        async function calcolaHash(stringa) {
            const msgUint8 = new TextEncoder().encode(stringa);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // Sostituisci la vecchia funzione handleLogin con questa:
function handleLogin() {
    // Controllo diretto del PIN senza crittografia (comodo per i test locali)
    if (pinInput.value === "26863") { 
        isAuthenticated.value = true;
        localStorage.setItem('sagra_auth', 'true');
        loginError.value = false;
    } else {
        loginError.value = true;
    }
    pinInput.value = '';
}

        function logout() {
            isAuthenticated.value = false;
            localStorage.removeItem('sagra_auth');
            currentView.value = 'dashboard';
        }

        // LOGICA CARRELLO/ORDINAZIONI
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

        function inviaOrdine() {
            if (!nuovoOrdine.value.tavolo) {
                alert("Assegna un numero di tavolo alla comanda!");
                return;
            }
            const adesso = new Date();
            const orarioStringa = adesso.getHours().toString().padStart(2, '0') + ':' + adesso.getMinutes().toString().padStart(2, '0');
            
            const nuovo = {
                id: ordini.value.length + 1,
                tavolo: nuovoOrdine.value.tavolo,
                note: nuovoOrdine.value.note,
                orario: orarioStringa,
                totale: totaleCarrello.value,
                pagato: false,
                cucinaCompletata: false,
                piatti: [...nuovoOrdine.value.carrello]
            };

            ordini.value.unshift(nuovo);
            nuovoOrdine.value = { tavolo: '', note: '', carrello: [] };
            currentView.value = 'dashboard';
        }

        // FLUSSO LAVORATIVO CUCINA & CASSA
        const ordiniInCucina = computed(() => ordini.value.filter(o => !o.cucinaCompletata));
        const ordiniDaPagare = computed(() => ordini.value.filter(o => !o.pagato));

        function evadiCucina(ordine) {
            ordine.cucinaCompletata = true;
        }

        function incassaConto(ordine) {
            ordine.pagato = true;
        }

        const incassoTotale = computed(() => {
            return ordini.value.filter(o => o.pagato).reduce((sum, o) => sum + o.totale, 0);
        });

        // MANAGEMENT LISTINO MENU
        function aggiungiAAListino() {
            if (!nuovoPiattoListino.value.nome) return;
            const targetCat = nuovoPiattoListino.value.categoria;
            const tuttiId = Object.values(menu.value).flatMap(cat => cat.map(p => p.id));
            const nuovoId = tuttiId.length > 0 ? Math.max(...tuttiId) + 1 : 1;

            menu.value[targetCat].push({
                id: nuovoId,
                nome: nuovoPiattoListino.value.nome,
                prezzo: parseFloat(nuovoPiattoListino.value.prezzo)
            });
            nuovoPiattoListino.value.nome = '';
        }

        function rimuoviDaListino(categoria, id) {
            menu.value[categoria] = menu.value[categoria].filter(p => p.id !== id);
        }

        return {
            isAuthenticated, pinInput, loginError, handleLogin, logout,
            currentView, viewTitles, menu, nuovoOrdine, ordini,
            aggiungiAlCarrello, rimuoviDalCarrello, totaleCarrello, inviaOrdine,
            ordiniInCucina, ordiniDaPagare, evadiCucina, incassaConto, incassoTotale,
            nuovoPiattoListino, aggiungiAAListino, rimuoviDaListino
        };
    }
}).mount('#app');
