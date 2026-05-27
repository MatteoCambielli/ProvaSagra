const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        // AUTENTICAZIONE E SICUREZZA (PIN protetto tramite Hash SHA-256)
        const HASH_PIN_SEGRETO = "499c7553b3b4f6b0bfbb864c8d5c49dc75dfa3b4e64f0288eb92043e06cfb99b";
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

        // STRUTTURE DATI REATTIVE
        const elencoCategorie = ref([]); 
        const menu = ref({});            
        const ordini = ref([]);          

        const nuovoPiattoListino = ref({ nome: '', prezzo: 5.00, categoria: '' });
        const nuovoOrdine = ref({ tavolo: '', note: '', carrello: [] });

        // FUNZIONE TOAST DI NOTIFICA
        function showToast(msg) {
            toastMsg.value = msg;
            setTimeout(() => { toastMsg.value = ''; }, 2200);
        }

        // Funzione asincrona per generare l'hash del PIN inserito
        async function calcolaSHA256(stringa) {
            const msgBuffer = new TextEncoder().encode(stringa);                    
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);       
            const hashArray = Array.from(new Uint8Array(hashBuffer));              
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');  
        }

        // ==========================================
        // CARICAMENTO E SINCRONIZZAZIONE SUPABASE
        // ==========================================
        function mappaOrdini(databaseData) {
            return databaseData.map(o => ({
                id: o.id,
                tavolo: o.tavolo,
                data: o.data,
                orario: o.orario,
                totale: parseFloat(o.totale),
                pagato: o.pagato,
                cucinaCompletata: o.cucina_completata, 
                note: o.note,
                piatti: o.piatti
            }));
        }

        async function fetchMenu() {
            try {
                const { data: catData, error: catErr } = await supabaseClient
                    .from('categorie')
                    .select('nome')
                    .order('nome', { ascending: true });
                
                if (catErr) throw catErr;
                elencoCategorie.value = catData.map(c => c.nome);

                const { data: piattiData, error: piattiErr } = await supabaseClient
                    .from('piatti')
                    .select('*')
                    .order('nome', { ascending: true });
                
                if (piattiErr) throw piattiErr;

                const menuStrutturato = {};
                elencoCategorie.value.forEach(c => {
                    menuStrutturato[c] = [];
                });

                piattiData.forEach(p => {
                    if (menuStrutturato[p.categoria]) {
                        menuStrutturato[p.categoria].push({
                            id: p.id,
                            nome: p.nome,
                            prezzo: parseFloat(p.prezzo)
                        });
                    }
                });

                menu.value = menuStrutturato;

                if (elencoCategorie.value.length > 0 && (!modalCategoriaAttiva.value || !menu.value[modalCategoriaAttiva.value])) {
                    modalCategoriaAttiva.value = elencoCategorie.value[0];
                    nuovoPiattoListino.value.categoria = elencoCategorie.value[0];
                }
            } catch (err) {
                console.error("Errore caricamento menu:", err.message);
            }
        }

        async function fetchOrdini() {
            try {
                const { data, error } = await supabaseClient
                    .from('ordini')
                    .select('*')
                    .order('id', { ascending: false });
                
                if (error) throw error;
                ordini.value = mappaOrdini(data);
            } catch (err) {
                console.error("Errore caricamento ordini:", err.message);
            }
        }

        // ==========================================
        // AUTO-AGGIORNAMENTO IN TEMPO REALE (REALTIME)
        // ==========================================
        function attivaRealtime() {
            supabaseClient
                .channel('sagra_realtime_globale')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'ordini' }, async () => {
                    await fetchOrdini();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'categorie' }, () => { fetchMenu(); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'piatti' }, () => { fetchMenu(); })
                .subscribe();
        }

        onMounted(() => {
            if (isAuthenticated.value) {
                fetchMenu();
                fetchOrdini();
                attivaRealtime(); 
            }
        });

        // GESTIONE LOGIN CON CONFRONTO HASH PROTETTO
        async function handleLogin() {
            // Calcoliamo l'hash del PIN digitato dall'utente
            const hashInserito = await calcolaSHA256(pinInput.value);
            
            // Confrontiamo i due hash blindati
            if (hashInserito === HASH_PIN_SEGRETO) { 
                isAuthenticated.value = true;
                localStorage.setItem('sagra_auth', 'true');
                loginError.value = false;
                fetchMenu();
                fetchOrdini();
                attivaRealtime(); 
            } else {
                loginError.value = true;
            }
            pinInput.value = '';
        }

        function logout() {
            isAuthenticated.value = false;
            localStorage.removeItem('sagra_auth');
            currentView.value = 'dashboard';
            supabaseClient.removeAllChannels();
        }

        // ==========================================
        // OPERAZIONI DATABASE - GESTIONE LISTINO
        // ==========================================
        async function aggiungiCategoria() {
            const nome = nuovaCategoriaInput.value.trim();
            if (!nome) return;
            if (menu.value[nome]) {
                alert("Questa categoria esiste già!");
                return;
            }
            try {
                const { error } = await supabaseClient.from('categorie').insert([{ nome: nome }]);
                if (error) throw error;
                nuovaCategoriaInput.value = '';
                showToast(`Categoria "${nome}" salvata!`);
            } catch (err) {
                alert("Errore nel salvataggio della categoria: " + err.message);
            }
        }

        async function rimuoviCategoria(categoria) {
            if (confirm(`Vuoi davvero eliminare la categoria "${categoria}"? Tutti i piatti al suo interno verranno rimossi permanentemente.`)) {
                try {
                    const { error } = await supabaseClient.from('categorie').delete().eq('nome', categoria);
                    if (error) throw error;
                    showToast(`Categoria rimossa.`);
                } catch (err) {
                    alert("Errore nella rimozione: " + err.message);
                }
            }
        }

        async function aggiungiAAListino() {
            if (!nuovoPiattoListino.value.nome || !nuovoPiattoListino.value.categoria) return;
            try {
                const { error } = await supabaseClient.from('piatti').insert([{
                    nome: nuovoPiattoListino.value.nome,
                    prezzo: parseFloat(nuovoPiattoListino.value.prezzo),
                    categoria: nuovoPiattoListino.value.categoria
                }]);
                if (error) throw error;
                nuovoPiattoListino.value.nome = '';
                nuovoPiattoListino.value.prezzo = 5.00;
                showToast("Piatto salvato nel listino cloud");
            } catch (err) {
                alert("Errore nell'inserimento del piatto: " + err.message);
            }
        }

        async function rimuoviDaListino(categoria, id) {
            try {
                const { error } = await supabaseClient.from('piatti').delete().eq('id', id);
                if (error) throw error;
                showToast("Piatto rimosso");
            } catch (err) {
                alert("Errore nella cancellazione del piatto: " + err.message);
            }
        }

        // ==========================================
        // OPERAZIONI DATABASE - GESTIONE COMANDE
        // ==========================================
        async function inviaOrdine() {
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
            
            try {
                const { error } = await supabaseClient.from('ordini').insert([{
                    tavolo: String(nuovoOrdine.value.tavolo),
                    data: getOggi(),
                    orario: orarioStringa,
                    totale: totaleCarrello.value,
                    note: nuovoOrdine.value.note || null,
                    piatti: nuovoOrdine.value.carrello, 
                    pagato: false,
                    cucina_completata: false
                }]);

                if (error) throw error;
                showToast(`Ordine Tavolo ${nuovoOrdine.value.tavolo} inviato!`);
                nuovoOrdine.value = { tavolo: '', note: '', carrello: [] };
            } catch (err) {
                alert("Impossibile inviare la comanda: " + err.message);
            }
        }

        async function evadiCucina(ordine) {
            try {
                const { error } = await supabaseClient.from('ordini').update({ cucina_completata: true }).eq('id', ordine.id);
                if (error) throw error;
                showToast(`Tavolo ${ordine.tavolo} pronto!`);
            } catch (err) {
                alert("Errore modifica stato cucina: " + err.message);
            }
        }

        async function incassaConto(ordine) {
            try {
                const { error } = await supabaseClient.from('ordini').update({ pagato: true }).eq('id', ordine.id);
                if (error) throw error;
                showToast(`Conto Tavolo ${ordine.tavolo} incassato.`);
            } catch (err) {
                alert("Errore registrazione pagamento: " + err.message);
            }
        }

        // ==========================================
        // LOGICA INTERFACCIA CARRELLO (LOCALE)
        // ==========================================
        function apriModalMenu() {
            if (elencoCategorie.value.length === 0) {
                alert("Crea prima almeno una categoria nella scheda 'Configura Listino'!");
                return;
            }
            if (!modalCategoriaAttiva.value || !menu.value[modalCategoriaAttiva.value]) {
                modalCategoriaAttiva.value = elencoCategorie.value[0];
            }
            isMenuModalOpen.value = true;
        }

        function aggiungiAlCarrello(piatto) {
            const esistente = nuovoOrdine.value.carrello.find(item => item.id === piatto.id);
            if (esistente) { esistente.qta++; } else { nuovoOrdine.value.carrello.push({ ...piatto, qta: 1 }); }
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

        // ==========================================
        // FILTRI E STATISTICHE REATTIVE
        // ==========================================
        const ordiniDiOggi = computed(() => ordini.value.filter(o => o.data === getOggi()));
        const incassoTotaleOggi = computed(() => ordiniDiOggi.value.filter(o => o.pagato).reduce((sum, o) => sum + o.totale, 0));
        const ordiniStoricoFiltrati = computed(() => ordini.value.filter(o => o.data === filtroDataStorico.value));
        const ordiniInCucina = computed(() => ordiniDiOggi.value.filter(o => !o.cucinaCompletata));
        const ordiniDaPagare = computed(() => ordiniDiOggi.value.filter(o => !o.pagato));

        return {
            isAuthenticated, pinInput, loginError, handleLogin, logout,
            currentView, viewTitles, menu, nuovoOrdine, ordini,
            aggiungiAlCarrello, rimuoviDalCarrello, totaleCarrello, inviaOrdine,
            ordiniInCucina, ordiniDaPagare, evadiCucina, incassaConto, incassoTotaleOggi, ordiniDiOggi,
            nuovoPiattoListino, aggiungiAAListino, rimuoviDaListino,
            isMenuModalOpen, modalCategoriaAttiva, quantitaNelCarrello, apriModalMenu,
            filtroDataStorico, ordiniStoricoFiltrati, toastMsg,
            nuovaCategoriaInput, aggiungiCategoria, rimuoviCategoria, elencoCategorie
        };
    }
}).mount('#app');
