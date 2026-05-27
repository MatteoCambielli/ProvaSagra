
const { createApp, ref, computed } = Vue;

createApp({
    setup() {
        // AUTENTICAZIONE
        const isAuthenticated = ref(localStorage.getItem('sagra_auth') === 'true');
        const pinInput = ref('');
        const loginError = ref(false);

        // NAVIGAZIONE E UI
        const currentView = ref('dashboard');
        const toastMsg = ref('');
        const isMenuModalOpen = ref(false);
        const modalCategoriaAttiva = ref('Primi Piatti');

        const viewTitles = {
            'dashboard': 'Pannello di Controllo',
            'nuovo-ordine': 'Prendi Ordinazione',
            'cucina': 'Monitor Comande',
            'cassa': 'Punto Cassa',
            'storico': 'Archivio Storico',
            'menu-manager': 'Gestione Listino'
        };

        // GESTIONE DATA ODIERNA (Formato YYYY-MM-DD per default)
        const getOggi = () => {
            const d = new Date();
            // Evita problemi di fuso orario prendendo le componenti locali
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const filtroDataStorico = ref(getOggi());

        // LISTINO MENU
        const menu = ref({
            'Primi Piatti': [
                { id: 1, nome: 'Pasta al Ragù', prezzo: 10.00 },
                { id: 2, nome: 'Gnocchi al Cinghiale', prezzo: 12.00 },
                { id: 3, nome: 'Polenta e Funghi', prezzo: 9.00 }
            ],
            'Secondi Piatti': [
                { id: 4, nome: 'Grigliata Mista', prezzo: 15.00 },
                { id: 5, nome: 'Patatine Fritte', prezzo: 6.00 },
                { id: 6, nome: 'Salsiccia alla Piastra', prezzo: 8.00 }
            ],
            'Bevande': [
                { id: 7, nome: 'Acqua Naturale 1L', prezzo: 2.00 },
                { id: 8, nome: 'Birra Artigianale', prezzo: 5.50 },
                { id: 9, nome: 'Vino Rosso 1/2L', prezzo: 5.00 }
            ]
        });

        const nuovoPiattoListino = ref({ nome: '', prezzo: 5.00, categoria: 'Primi Piatti' });

        // STRUTTURA COMANDE
        const nuovoOrdine = ref({ tavolo: '', note: '', carrello: [] });
        
        // Ordine di esempio pre-caricato
        const ordini = ref([
            {
                id: 1,
                tavolo: '12',
                data: getOggi(),
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

        // LOGIN
        function handleLogin() {
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

        // FUNZIONI CARRELLO
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

        // Funzione helper per l'interfaccia (mostra badge qt nel modal)
        const quantitaNelCarrello = (piattoId) => {
            const trovato = nuovoOrdine.value.carrello.find(item => item.id === piattoId);
            return trovato ? trovato.qta : 0;
        };

        const totaleCarrello = computed(() => {
            return nuovoOrdine.value.carrello.reduce((acc, item) => acc + (item.prezzo * item.qta), 0);
        });

        function showToast(msg) {
            toastMsg.value = msg;
            setTimeout(() => { toastMsg.value = ''; }, 2500);
        }

        // INVIA ORDINE (RIMANE NELLA STESSA PAGINA)
        function inviaOrdine() {
            if (!nuovoOrdine.value.tavolo) {
                alert("Assegna un numero di tavolo alla comanda!");
                return;
            }
            if (nuovoOrdine.value.carrello.length === 0) {
                alert("Il carrello è vuoto!");
                return;
            }

            const adesso = new Date();
            const orarioStringa = String(adesso.getHours()).padStart(2, '0') + ':' + String(adesso.getMinutes()).padStart(2, '0');
            
            const nuovo = {
                id: ordini.value.length > 0 ? Math.max(...ordini.value.map(o => o.id)) + 1 : 1,
                tavolo: nuovoOrdine.value.tavolo,
                data: getOggi(), // Assegna la data odierna all'ordine
                note: nuovoOrdine.value.note,
                orario: orarioStringa,
                totale: totaleCarrello.value,
                pagato: false,
                cucinaCompletata: false,
                piatti: [...nuovoOrdine.value.carrello]
            };

            ordini.value.unshift(nuovo);
            
            // Svuota il form ma NON cambia currentView
            nuovoOrdine.value = { tavolo: '', note: '', carrello: [] };
            
            // Mostra avviso visivo di successo
            showToast(`Ordine Tavolo ${nuovo.tavolo} Inviato!`);
        }

        // FILTRI E STATISTICHE DASHBOARD/STORICO
        const ordiniDiOggi = computed(() => ordini.value.filter(o => o.data === getOggi()));
        
        const incassoTotaleOggi = computed(() => {
            return ordiniDiOggi.value.filter(o => o.pagato).reduce((sum, o) => sum + o.totale, 0);
        });

        const ordiniStoricoFiltrati = computed(() => {
            return ordini.value.filter(o => o.data === filtroDataStorico.value);
        });

        // FLUSSO LAVORATIVO CUCINA & CASSA (Filtrati sempre per oggi)
        const ordiniInCucina = computed(() => ordiniDiOggi.value.filter(o => !o.cucinaCompletata));
        const ordiniDaPagare = computed(() => ordiniDiOggi.value.filter(o => !o.pagato));

        function evadiCucina(ordine) {
            ordine.cucinaCompletata = true;
        }

        function incassaConto(ordine) {
            ordine.pagato = true;
        }

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
            nuovoPiattoListino.value.prezzo = 5.00;
        }

        function rimuoviDaListino(categoria, id) {
            menu.value[categoria] = menu.value[categoria].filter(p => p.id !== id);
        }

        return {
            isAuthenticated, pinInput, loginError, handleLogin, logout,
            currentView, viewTitles, menu, nuovoOrdine, ordini,
            aggiungiAlCarrello, rimuoviDalCarrello, totaleCarrello, inviaOrdine,
            ordiniInCucina, ordiniDaPagare, evadiCucina, incassaConto, incassoTotaleOggi, ordiniDiOggi,
            nuovoPiattoListino, aggiungiAAListino, rimuoviDaListino,
            isMenuModalOpen, modalCategoriaAttiva, quantitaNelCarrello,
            filtroDataStorico, ordiniStoricoFiltrati, toastMsg
        };
    }
}).mount('#app');
