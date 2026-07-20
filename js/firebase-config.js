// Configuração do Firebase — projeto "bloco-notas-paulo-xavier"
// -------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

export const auth = getAuth(app);
export const db = getFirestore(app);
