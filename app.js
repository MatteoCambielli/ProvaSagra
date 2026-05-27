
const { createApp, ref, computed } = Vue;

createApp({
    setup() {
        // AUTENTICAZIONE
        const isAuthenticated = ref(localStorage.getItem('sagra_auth') === 'true');
        const pinInput = ref('');
        const loginError = ref(false);

        // NAVIGAZIONE E STRUTTURE UI
        const currentView = ref('dashboard');
        const toastMsg = ref('');
        const isMenuModalOpen = ref(false);
        const modalCategoriaAttiva = ref('');
        const nuovaCategoriaInput = ref('');

        const viewTitles = {
            'dashboard': 'Pannello Principale',
            'nuovo-ordine': 'Crea Nuova Ordinazione',
            'cucina': 'Monitor Comande Cucina',
            'cassa': 'Registrazione Cassa e Scontrini',
            'storico': 'Archivio Storico Comande',
            'menu-manager': 'Configurazione Categorie e Piatti'
        };

        // GESTIONE DATA ODIERNA
        const getOggi = () => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const filtroDataStorico = ref(getOggi());

        // LISTINO MENU CON STRUTTURA AD OGGETTI CHIAVE-VALORE REATTIVA
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

        // Impostiamo la prima categoria disponibile come attiva di default per l'interfaccia
        if (Object.keys(menu.value).length > 0) {
            modalCategoriaAttiva.value = Object.keys(menu.value)[0];
        }

        const nuovoPiattoListino = ref({ nome: '', prezzo: 5.00, categoria: Object.keys(menu.value)[0] || '' });

        // STRUTTURA COMANDE
        const nuovoOrdine = ref({ tavolo: '', note: '', carrello: [] });
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

        // LOGICA DI ACCESSO
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

        // AGGIUNGI / RIMUOVI CATEGORIE DINAMICHE
        function aggiungiCategoria() {
            const nome = nuovaCategoriaInput.value.trim();
            if (!nome) return;
            if (menu.value[nome]) {
                alert("Questa categoria esiste già!");
                return;
            }
            
            // Crea una chiave vuota nell'oggetto listino
            menu.value[nome] = [];
            
            // Aggiorna i selettori se erano vuoti
            if (!modalCategoriaAttiva.value) modalCategoriaAttiva.value = nome;
            if (!nuovoPiattoListino.value.categoria) nuovoPiattoListino.value.categoria = nome;
            
            nuovaCategoriaInput.value = '';
            showToast(`Categoria "${nome}" creata!`);
        }

        function rimuoviCategoria(categoria) {
            if (confirm(`Vuoi davvero eliminare la categoria "${categoria}"? Tutti i piatti al suo interno verranno cancellati.`)) {
                delete menu.value[categoria];
                
                // Ricalcola i puntatori attivi per non rompere l'interfaccia grafica
                const chiaviRimaste = Object.keys(menu.value);
                if (chiaviRimaste.length > 0) {
                    modalCategoriaAttiva.value = chiaviRimaste[0];
                    nuovoPiattoListino.value.categoria = chiaviRimaste[0];
                } else {
                    modalCategoriaAttiva.value = '';
                    nuovoPiattoListino.value.categoria = '';
                }
                showToast(`Categoria rimossa.`);
            }
        }

        // CONTROLLO APERTURA MODAL ORDINE
        function apriModalMenu() {
            const chiavi = Object.keys(menu.value);
            if (chiavi.length === 0) {
                alert("Crea prima almeno una categoria nella scheda 'Configura Listino'!");
                return;
            }
            // Assicuriamoci che ci sia sempre una categoria selezionata aperta all'avvio
            if (!modalCategoriaAttiva.value || !menu.value[modalCategoriaAttiva.value]) {
                modalCategoriaAttiva.value = chiavi[0];
            }
            isMenuModalOpen.value = true;
        }

        // GESTIONE ELEMENTI COMANDA
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

        const quantitaNelCarrello = (piattoId) => {
            const trovato = nuovoOrdine.value.carrello.find(item => item.id === piattoId);
            return trovato ? trovato.qta : 0;
        };

        const totaleCarrello = computed(() => {
            return nuovoOrdine.value.carrello.reduce((acc, item) => acc + (item.prezzo * item.qta), 0);
        });

        function showToast(msg) {
            toastMsg.value = msg;
            setTimeout(() => { toastMsg.value = ''; }, 2200);
        }

        function inviaOrdine() {
            if (!nuovoOrdine.value.tavolo) {
                alert("Riempi il numero di tavolo!");
                return;
            }
            if (nuovoOrdine.value.carrello.length === 0) {
                alert("Il carrello è vuoto! Apri il menu per aggiungere piatti.");
                return;
            }

            const adesso = new Date();
            const orarioStringa = String(adesso.getHours()).padStart(2, '0') + ':' + String(adesso.getMinutes()).padStart(2, '0');
            
            const nuovo = {
                id: ordini.value.length > 0 ? Math.max(...ordini.value.map(o => o.id)) + 1 : 1,
                tavolo: nuovoOrdine.value.tavolo,
                data: getOggi(),
                note: nuovoOrdine.value.note,
                orario: orarioStringa,
                totale: totaleCarrello.value,
                pagato: false,
                cucinaCompletata: false,
                piatti: [...nuovoOrdine.value.carrello]
            };

            ordini.value.unshift(nuovo);
            nuovoOrdine.value = { tavolo: '', note: '', carrello: [] };
            showToast(`Ordine Tavolo ${nuovo.tavolo} inviato alla cucina!`);
        }

        // COMPUTED DI CALCOLO FILTRATE
        const ordiniDiOggi = computed(() => ordini.value.filter(o => o.data === getOggi()));
        
        const incassoTotaleOggi = computed(() => {
            return ordiniDiOggi.value.filter(o => o.pagato).reduce((sum, o) => sum + o.totale, 0);
        });

        const ordiniStoricoFiltrati = computed(() => {
            return ordini.value.filter(o => o.data === filtroDataStorico.value);
        });

        const ordiniInCucina = computed(() => ordiniDiOggi.value.filter(o => !o.cucinaCompletata));
        const ordiniDaPagare = computed(() => ordiniDiOggi.value.filter(o => !o.pagato));

        function evadiCucina(ordine) {
            ordine.cucinaCompletata = true;
            showToast(`Tavolo ${ordine.tavolo} pronto!`);
        }

        function incassaConto(ordine) {
            ordine.pagato = true;
            showToast(`Conto Tavolo ${ordine.tavolo} incassato.`);
        }

        // GESTIONE INTERNA PIATTI LISTINO
        function aggiungiAAListino() {
            if (!nuovoPiattoListino.value.nome || !nuovoPiattoListino.value.categoria) return;
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
            showToast("Piatto salvato");
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
            isMenuModalOpen, modalCategoriaAttiva, quantitaNelCarrello, apriModalMenu,
            filtroDataStorico, ordiniStoricoFiltrati, toastMsg,
            nuovaCategoriaInput, aggiungiCategoria, rimuoviCategoria
        };
    }
}).mount('#app');
