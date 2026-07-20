import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- Elementos ---------- */
const authScreen   = document.getElementById("auth-screen");
const appScreen    = document.getElementById("app-screen");
const authForm     = document.getElementById("auth-form");
const authEmail    = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authError    = document.getElementById("auth-error");
const authSubmit   = document.getElementById("auth-submit");
const authToggle   = document.getElementById("auth-toggle");
const logoutBtn    = document.getElementById("logout-btn");
const syncStatus   = document.getElementById("sync-status");

const newNoteBtn   = document.getElementById("new-note-btn");
const searchInput  = document.getElementById("search-input");
const notesList    = document.getElementById("notes-list");
const emptyState   = document.getElementById("empty-state");

const noteModal    = document.getElementById("note-modal");
const modalTitle   = document.getElementById("modal-title");
const modalClose   = document.getElementById("modal-close");
const noteForm     = document.getElementById("note-form");
const noteTitle    = document.getElementById("note-title");
const noteDate     = document.getElementById("note-date");
const noteContent  = document.getElementById("note-content");
const printBtn     = document.getElementById("print-note-btn");
const deleteBtn    = document.getElementById("delete-note-btn");

const toast        = document.getElementById("toast");

/* ---------- Estado ---------- */
let isSignUpMode = false;
let currentUser = null;
let unsubscribeNotes = null;
let allNotes = [];
let editingNoteId = null;

/* ---------- Utilitários ---------- */
function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => (toast.hidden = true), 200);
  }, 2200);
}

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function setSyncStatus(state) {
  // state: "synced" | "syncing" | "offline"
  syncStatus.classList.remove("sync-ok", "sync-busy", "sync-off");
  if (state === "synced") {
    syncStatus.classList.add("sync-ok");
    syncStatus.title = "Sincronizado";
  } else if (state === "syncing") {
    syncStatus.classList.add("sync-busy");
    syncStatus.title = "Sincronizando…";
  } else {
    syncStatus.classList.add("sync-off");
    syncStatus.title = "Sem conexão — mudanças serão sincronizadas ao voltar online";
  }
}

/* ---------- Autenticação ---------- */
authToggle.addEventListener("click", () => {
  isSignUpMode = !isSignUpMode;
  authSubmit.textContent = isSignUpMode ? "Criar conta" : "Entrar";
  authToggle.textContent = isSignUpMode
    ? "Já tenho conta — entrar"
    : "Ainda não tenho conta — criar acesso";
  authError.hidden = true;
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.hidden = true;
  authSubmit.disabled = true;
  const email = authEmail.value.trim();
  const password = authPassword.value;

  try {
    if (isSignUpMode) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    authError.textContent = friendlyAuthError(err.code);
    authError.hidden = false;
  } finally {
    authSubmit.disabled = false;
  }
});

function friendlyAuthError(code) {
  const map = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Conta não encontrada. Verifique o e-mail ou crie uma conta.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com esse e-mail. Tente entrar.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres."
  };
  return map[code] || "Não foi possível concluir. Tente novamente.";
}

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    authScreen.hidden = true;
    appScreen.hidden = false;
    authForm.reset();
    listenToNotes(user.uid);
  } else {
    appScreen.hidden = true;
    authScreen.hidden = false;
    if (unsubscribeNotes) unsubscribeNotes();
    allNotes = [];
    renderNotes();
  }
});

/* ---------- Notas: leitura em tempo real ---------- */
function listenToNotes(uid) {
  setSyncStatus("syncing");
  const notesRef = collection(db, "users", uid, "notes");
  const q = query(notesRef, orderBy("date", "desc"));

  unsubscribeNotes = onSnapshot(
    q,
    (snapshot) => {
      allNotes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderNotes();
      setSyncStatus("synced");
    },
    (err) => {
      console.error(err);
      setSyncStatus("offline");
    }
  );
}

function renderNotes() {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = term
    ? allNotes.filter(
        (n) =>
          n.title.toLowerCase().includes(term) ||
          n.content.toLowerCase().includes(term)
      )
    : allNotes;

  notesList.innerHTML = "";
  emptyState.hidden = allNotes.length !== 0;

  if (filtered.length === 0 && allNotes.length > 0) {
    notesList.innerHTML = `<p class="no-results">Nenhuma nota encontrada para "${escapeHtml(
      searchInput.value
    )}".</p>`;
    return;
  }

  filtered.forEach((note) => {
    const card = document.createElement("article");
    card.className = "note-card";
    card.innerHTML = `
      <p class="note-card-date">${formatDate(note.date)}</p>
      <h3 class="note-card-title">${escapeHtml(note.title)}</h3>
      <p class="note-card-preview">${escapeHtml(note.content).slice(0, 140)}${
      note.content.length > 140 ? "…" : ""
    }</p>
    `;
    card.addEventListener("click", () => openModal(note));
    notesList.appendChild(card);
  });
}

function escapeHtml(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

searchInput.addEventListener("input", renderNotes);

/* ---------- Modal: criar / editar ---------- */
function openModal(note = null) {
  editingNoteId = note ? note.id : null;
  modalTitle.textContent = note ? "Editar nota" : "Nova nota";
  noteTitle.value = note ? note.title : "";
  noteContent.value = note ? note.content : "";
  noteDate.value = note ? note.date : new Date().toISOString().slice(0, 10);
  deleteBtn.hidden = !note;
  printBtn.hidden = !note;
  noteModal.hidden = false;
  setTimeout(() => noteTitle.focus(), 50);
}

function closeModal() {
  noteModal.hidden = true;
  editingNoteId = null;
  noteForm.reset();
}

newNoteBtn.addEventListener("click", () => openModal());
modalClose.addEventListener("click", closeModal);
noteModal.addEventListener("click", (e) => {
  if (e.target === noteModal) closeModal();
});

noteForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const payload = {
    title: noteTitle.value.trim(),
    content: noteContent.value.trim(),
    date: noteDate.value,
    attachments: [],
    updatedAt: serverTimestamp()
  };

  try {
    setSyncStatus("syncing");
    const notesRef = collection(db, "users", currentUser.uid, "notes");
    if (editingNoteId) {
      await updateDoc(doc(notesRef, editingNoteId), payload);
      showToast("Nota atualizada");
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(notesRef, payload);
      showToast("Nota criada");
    }
    closeModal();
  } catch (err) {
    console.error(err);
    showToast("Não foi possível salvar. Tente novamente.");
  }
});

deleteBtn.addEventListener("click", async () => {
  if (!editingNoteId || !currentUser) return;
  if (!confirm("Excluir esta nota? Essa ação não pode ser desfeita.")) return;
  try {
    const notesRef = collection(db, "users", currentUser.uid, "notes");
    await deleteDoc(doc(notesRef, editingNoteId));
    showToast("Nota excluída");
    closeModal();
  } catch (err) {
    console.error(err);
    showToast("Não foi possível excluir. Tente novamente.");
  }
});

/* ---------- Impressão ---------- */
printBtn.addEventListener("click", () => {
  document.getElementById("print-date").textContent = formatDate(noteDate.value);
  document.getElementById("print-title").textContent = noteTitle.value;
  document.getElementById("print-content").textContent = noteContent.value;
  window.print();
});

/* ---------- Estado de conexão ---------- */
window.addEventListener("online", () => setSyncStatus("synced"));
window.addEventListener("offline", () => setSyncStatus("offline"));

/* ---------- Service Worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch((err) => console.error("Falha ao registrar service worker:", err));
  });
}
