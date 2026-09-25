// Configuração do Firebase — projeto "bloco-notas-paulo-xavier"
// -------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBpYDEdA7ydmNLHA3vPyfyO1uKxHkD8t-c",
  authDomain: "bloco-notas-paulo-xavier.firebaseapp.com",
  projectId: "bloco-notas-paulo-xavier",
  storageBucket: "bloco-notas-paulo-xavier.firebasestorage.app",
  messagingSenderId: "407045081673",
  appId: "1:407045081673:web:5c4a65aab30a0058130d98",
  measurementId: "G-L4B9DPKYZM"
};

const app = initializeApp(firebaseConfig);

// initializeAuth (em vez de getAuth) permite escolher explicitamente ONDE a
// sessão de login fica guardada no aparelho, com uma lista de prioridade:
// tenta IndexedDB primeiro (sobrevive a reiniciar o navegador, é o que
// permite abrir o app já logado mesmo sem internet); se o navegador não
// suportar, cai para localStorage; se nem isso (ex.: aba anônima com
// restrições), usa só memória — a pessoa continua logada nesta aba, mas
// precisa entrar de novo ao reabrir. Sem essa lista explícita, alguns
// navegadores/PWAs instalados podem silenciosamente "esquecer" a sessão ao
// reabrir offline.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence]
});

// Cache local persistente: notas criadas ou editadas offline ficam guardadas
// no dispositivo e são enviadas automaticamente assim que a conexão voltar.
// "persistentMultipleTabManager" deixa várias abas/janelas (ex.: app instalado +
// navegador) compartilharem o mesmo cache local sem conflito.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
