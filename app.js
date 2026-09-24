import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  terminate,
  clearIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- Elementos ---------- */
const offlineBanner = document.getElementById("offline-banner");

const authScreen   = document.getElementById("auth-screen");
const appScreen    = document.getElementById("app-screen");
const authForm     = document.getElementById("auth-form");
const authEmail    = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authError    = document.getElementById("auth-error");
const authSubmit   = document.getElementById("auth-submit");
const authToggle   = document.getElementById("auth-toggle");
const logoutBtn    = document.getElementById("logout-btn");
const syncPill     = document.getElementById("sync-pill");
const syncStatus   = document.getElementById("sync-status");
const syncLabel    = document.getElementById("sync-label");

const newNoteBtn   = document.getElementById("new-note-btn");
const searchInput  = document.getElementById("search-input");
const notesList    = document.getElementById("notes-list");
const emptyState   = document.getElementById("empty-state");

const noteModal    = document.getElementById("note-modal");
const modalTitle   = document.getElementById("modal-title");
const modalClose   = document.getElementById("modal-close");
const noteForm     = document.getElementById("note-form");
const noteFormError = document.getElementById("note-form-error");
const noteTitle    = document.getElementById("note-title");
const noteDate     = document.getElementById("note-date");
const noteContent  = document.getElementById("note-content");
const noteSaveBtn  = document.getElementById("note-save-btn");
const printBtn     = document.getElementById("print-note-btn");
const deleteBtn    = document.getElementById("delete-note-btn");
const attachBtn    = document.getElementById("attach-btn");
const attachInput  = document.getElementById("attach-input");
const attachmentsList = document.getElementById("attachments-list");

const toast        = document.getElementById("toast");

/* ---------- Estado ---------- */
let isSignUpMode = false;
let currentUser = null;
let unsubscribeNotes = null;
let allNotes = [];
let editingNoteId = null;
let pendingWritesCount = 0;
let seenNoteIds = new Set(); // ids já exibidos, para não reanimar cards a cada busca/atualização
let searchDebounceId = null;
let updateReady = false; // true quando há uma nova versão do app esperando para ser aplicada
let reloadingForUpdate = false;
let currentAttachments = []; // anexos da nota aberta no momento no modal
let attachmentsDirty = false; // true se anexos foram adicionados/removidos nesta edição

// Guardados como base64 dentro do próprio documento da nota (e não no Firebase
// Storage): assim os anexos entram no mesmo cache offline das notas e não
// exigem habilitar um serviço pago. Em troca, cada nota inteira precisa caber
// no limite de 1 MB do Firestore — por isso os limites abaixo.
const MAX_ATTACHMENT_SIZE = 700 * 1024; // 700 KB por arquivo (antes de converter)
const MAX_ATTACHMENTS_TOTAL = 900 * 1024; // soma dos arquivos de uma mesma nota
const MAX_ATTACHMENTS_COUNT = 5;

function reloadForUpdate() {
  if (reloadingForUpdate) return;
  reloadingForUpdate = true;
  window.location.reload();
}

/* ---------- Utilitários ---------- */
function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  clearTimeout(showToast._h);
  showToast._t = setTimeout(() => {
    toast.classList.remove("show");
    showToast._h = setTimeout(() => (toast.hidden = true), 200);
  }, 2600);
}

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function setButtonBusy(button, busy) {
  const label = button.querySelector(".btn-label");
  const spinner = button.querySelector(".btn-spinner");
  button.disabled = busy;
  if (spinner) spinner.hidden = !busy;
  if (label) label.style.opacity = busy ? "0" : "1";
}

// Data local (YYYY-MM-DD). toISOString() usa UTC e, no Brasil, devolve o dia
// seguinte a partir do fim da tarde.
function todayLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// O Firestore só resolve a Promise de escrita quando o SERVIDOR confirma; offline
// ela fica pendente (a escrita já está na fila local). Por isso não esperamos
// para sempre: erros rápidos (ex.: regra negada) ainda aparecem no formulário e,
// se demorar, tratamos como "salvo no aparelho".
function commitWrite(promise) {
  let timedOut = false;
  const timer = new Promise((resolve) =>
    setTimeout(() => { timedOut = true; resolve("queued"); }, navigator.onLine ? 4000 : 0)
  );
  promise.catch((err) => {
    if (!timedOut) return;
    console.error(err);
    showToast("Uma alteração não pôde ser sincronizada e foi desfeita.");
  });
  return Promise.race([promise.then(() => "synced"), timer]);
}

/* ---------- Estado de conexão / sincronização ---------- */
// Estados possíveis: "synced" (tudo salvo), "syncing" (enviando ou baixando
// dados), "offline" (sem rede — o Firestore guarda tudo local e envia depois).
function setSyncStatus(state) {
  syncStatus.classList.remove("sync-ok", "sync-busy", "sync-off");
  const labels = {
    synced: "Sincronizado",
    syncing: "Sincronizando…",
    offline: "Sem conexão"
  };
  const titles = {
    synced: "Tudo sincronizado",
    syncing: "Sincronizando…",
    offline: "Sem conexão — mudanças serão sincronizadas ao voltar online"
  };
  const cls = state === "synced" ? "sync-ok" : state === "syncing" ? "sync-busy" : "sync-off";
  syncStatus.classList.add(cls);
  syncLabel.textContent = labels[state] || labels.synced;
  syncPill.title = titles[state] || titles.synced;
}

function updateOfflineBanner() {
  const isOffline = !navigator.onLine;
  offlineBanner.hidden = !isOffline;
  if (isOffline) setSyncStatus("offline");
}

window.addEventListener("online", () => {
  updateOfflineBanner();
  setSyncStatus(pendingWritesCount > 0 ? "syncing" : "synced");
  showToast("Conexão restabelecida");
});

window.addEventListener("offline", () => {
  updateOfflineBanner();
});

// Estado inicial: já mostra a faixa de offline se o app abrir sem conexão.
updateOfflineBanner();

/* ---------- Autenticação ---------- */
authToggle.addEventListener("click", () => {
  isSignUpMode = !isSignUpMode;
  authSubmit.querySelector(".btn-label").textContent = isSignUpMode ? "Criar conta" : "Entrar";
  authToggle.textContent = isSignUpMode
    ? "Já tenho conta — entrar"
    : "Ainda não tenho conta — criar acesso";
  authPassword.autocomplete = isSignUpMode ? "new-password" : "current-password";
  authError.hidden = true;
});

document.getElementById("auth-reset").addEventListener("click", async () => {
  const email = authEmail.value.trim();
  if (!email) {
    authError.textContent = "Digite seu e-mail acima e toque de novo em “Esqueci minha senha”.";
    authError.hidden = false;
    authEmail.focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    authError.hidden = true;
    showToast("Se o e-mail tiver conta, enviamos um link para redefinir a senha");
  } catch (err) {
    console.error(err);
    authError.textContent = friendlyAuthError(err.code);
    authError.hidden = false;
  }
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.hidden = true;

  if (!navigator.onLine) {
    authError.textContent = "Sem conexão. Conecte-se à internet para entrar ou criar sua conta.";
    authError.hidden = false;
    return;
  }

  setButtonBusy(authSubmit, true);
  const email = authEmail.value.trim();
  const password = authPassword.value;

  try {
    if (isSignUpMode) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    console.error(err);
    authError.textContent = friendlyAuthError(err.code);
    authError.hidden = false;
  } finally {
    setButtonBusy(authSubmit, false);
  }
});

function friendlyAuthError(code) {
  const map = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Conta não encontrada. Verifique o e-mail ou crie uma conta.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com esse e-mail. Tente entrar.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde um momento e tente novamente.",
    "auth/network-request-failed": "Falha de rede. Verifique sua conexão e tente novamente.",
    "auth/user-disabled": "Esta conta foi desativada."
  };
  return map[code] || "Não foi possível concluir. Tente novamente.";
}

logoutBtn.addEventListener("click", async () => {
  if (
    pendingWritesCount > 0 &&
    !confirm("Há notas que ainda não foram sincronizadas e seriam perdidas ao sair. Sair mesmo assim?")
  ) return;
  try {
    await signOut(auth);
  } catch (err) {
    console.error(err);
    showToast("Não foi possível sair agora. Tente novamente.");
    return;
  }
  // Apaga as notas guardadas neste aparelho (importante em aparelho compartilhado).
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (err) {
    console.error(err);
  }
  window.location.reload();
});

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
    if (unsubscribeNotes) { unsubscribeNotes(); unsubscribeNotes = null; }
    noteModal.hidden = true;
    editingNoteId = null;
    searchInput.value = "";
    allNotes = [];
    seenNoteIds = new Set();
    renderNotes();
  }
});

/* ---------- Notas: leitura em tempo real ---------- */
function listenToNotes(uid) {
  if (unsubscribeNotes) unsubscribeNotes();
  setSyncStatus(navigator.onLine ? "syncing" : "offline");
  seenNoteIds = new Set();
  const notesRef = collection(db, "users", uid, "notes");
  const q = query(notesRef, orderBy("date", "desc"));

  unsubscribeNotes = onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      // Mesma data: a mais recente primeiro. "estimate" evita createdAt nulo
      // enquanto a nota ainda está pendente de sincronização.
      allNotes = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))
        .sort(
          (a, b) =>
            (b.date || "").localeCompare(a.date || "") ||
            (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
        );
      renderNotes();

      pendingWritesCount = snapshot.docs.filter((d) => d.metadata.hasPendingWrites).length;

      if (!navigator.onLine) {
        setSyncStatus("offline");
      } else if (snapshot.metadata.fromCache || pendingWritesCount > 0) {
        setSyncStatus("syncing");
      } else {
        setSyncStatus("synced");
      }
    },
    (err) => {
      console.error(err);
      setSyncStatus("offline");
      showToast("Não foi possível atualizar as notas agora.");
    }
  );
}

function renderNotes() {
  const term = searchInput.value.trim().toLowerCase();
  // Acesso defensivo: title/content podem faltar em notas antigas ou criadas
  // manualmente no console do Firestore, sem passar pelo formulário.
  const filtered = term
    ? allNotes.filter(
        (n) =>
          (n.title || "").toLowerCase().includes(term) ||
          (n.content || "").toLowerCase().includes(term)
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

  let newCardIndex = 0;
  filtered.forEach((note) => {
    const title = note.title || "";
    const content = note.content || "";
    const isNew = !seenNoteIds.has(note.id);

    const card = document.createElement("article");
    // A classe/animação de entrada só é aplicada a cards ainda não vistos.
    // Sem isso, toda tecla digitada na busca recriava e reanimava a lista
    // inteira, causando um efeito de "piscar" incômodo.
    card.className = isNew ? "note-card note-card-enter" : "note-card";
    if (isNew) {
      card.style.animationDelay = `${Math.min(newCardIndex, 8) * 30}ms`;
      newCardIndex += 1;
    }
    // textContent (e não innerHTML): cortar texto já escapado quebrava
    // entidades como "&amp;" no meio da prévia.
    const dateEl = document.createElement("p");
    dateEl.className = "note-card-date";
    dateEl.textContent = formatDate(note.date);
    if (Array.isArray(note.attachments) && note.attachments.length > 0) {
      const attSpan = document.createElement("span");
      attSpan.className = "note-card-attachments";
      attSpan.textContent = `· 📎 ${note.attachments.length}`;
      dateEl.append(" ", attSpan);
    }
    const titleEl = document.createElement("h3");
    titleEl.className = "note-card-title";
    titleEl.textContent = title;
    const previewEl = document.createElement("p");
    previewEl.className = "note-card-preview";
    previewEl.textContent = content.slice(0, 140) + (content.length > 140 ? "…" : "");
    card.append(dateEl, titleEl, previewEl);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.addEventListener("click", () => openModal(note));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(note); }
    });
    notesList.appendChild(card);
  });

  allNotes.forEach((n) => seenNoteIds.add(n.id));
}

function escapeHtml(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceId);
  searchDebounceId = setTimeout(renderNotes, 120);
});

/* ---------- Anexos ---------- */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentsTotalSize(list) {
  return list.reduce((sum, a) => sum + (a.size || 0), 0);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function downloadAttachment(att) {
  const link = document.createElement("a");
  link.href = att.data;
  link.download = att.name || "anexo";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function renderAttachments() {
  attachmentsList.innerHTML = "";
  attachmentsList.hidden = currentAttachments.length === 0;

  currentAttachments.forEach((att, index) => {
    const chip = document.createElement("div");
    chip.className = "attachment-chip";

    const thumb = document.createElement("div");
    thumb.className = "attachment-thumb";
    if (att.type && att.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = att.data;
      img.alt = "";
      thumb.appendChild(img);
    } else {
      thumb.textContent = "📄";
    }

    const info = document.createElement("div");
    info.className = "attachment-info";
    const nameEl = document.createElement("span");
    nameEl.className = "attachment-name";
    nameEl.textContent = att.name || "Arquivo";
    const sizeEl = document.createElement("span");
    sizeEl.className = "attachment-size";
    sizeEl.textContent = formatBytes(att.size || 0);
    info.append(nameEl, sizeEl);

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "attachment-action";
    downloadBtn.title = "Baixar";
    downloadBtn.setAttribute("aria-label", `Baixar ${att.name || "arquivo"}`);
    downloadBtn.textContent = "⬇";
    downloadBtn.addEventListener("click", () => downloadAttachment(att));

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "attachment-action attachment-remove";
    removeBtn.title = "Remover";
    removeBtn.setAttribute("aria-label", `Remover ${att.name || "arquivo"}`);
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      currentAttachments.splice(index, 1);
      attachmentsDirty = true;
      renderAttachments();
    });

    chip.append(thumb, info, downloadBtn, removeBtn);
    attachmentsList.appendChild(chip);
  });
}

attachBtn.addEventListener("click", () => attachInput.click());

attachInput.addEventListener("change", async () => {
  const files = Array.from(attachInput.files || []);
  attachInput.value = ""; // permite escolher de novo o mesmo arquivo depois de removê-lo

  for (const file of files) {
    if (currentAttachments.length >= MAX_ATTACHMENTS_COUNT) {
      noteFormError.textContent = `Cada nota aceita no máximo ${MAX_ATTACHMENTS_COUNT} anexos.`;
      noteFormError.hidden = false;
      break;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      noteFormError.textContent = `"${file.name}" é maior que ${formatBytes(MAX_ATTACHMENT_SIZE)}. Escolha um arquivo menor.`;
      noteFormError.hidden = false;
      continue;
    }
    if (attachmentsTotalSize(currentAttachments) + file.size > MAX_ATTACHMENTS_TOTAL) {
      noteFormError.textContent = "Os anexos desta nota já somam o máximo permitido. Remova algum para adicionar outro.";
      noteFormError.hidden = false;
      continue;
    }
    try {
      const data = await fileToDataUrl(file);
      currentAttachments.push({ name: file.name, type: file.type || "", size: file.size, data });
      attachmentsDirty = true;
      noteFormError.hidden = true;
    } catch (err) {
      console.error(err);
      noteFormError.textContent = `Não foi possível ler "${file.name}".`;
      noteFormError.hidden = false;
    }
  }
  renderAttachments();
});

/* ---------- Modal: criar / editar ---------- */
function openModal(note = null) {
  editingNoteId = note ? note.id : null;
  modalTitle.textContent = note ? "Editar nota" : "Nova nota";
  noteTitle.value = note ? note.title || "" : "";
  noteContent.value = note ? note.content || "" : "";
  noteDate.value = (note && note.date) || todayLocal();
  noteFormError.hidden = true;
  deleteBtn.hidden = !note;
  printBtn.hidden = !note;
  currentAttachments = note && Array.isArray(note.attachments)
    ? note.attachments.map((a) => ({ ...a }))
    : [];
  attachmentsDirty = false;
  renderAttachments();
  modalSnapshot = formState();
  noteModal.hidden = false;
  setTimeout(() => noteTitle.focus(), 50);
}

let modalSnapshot = "";
const formState = () => JSON.stringify([noteTitle.value, noteDate.value, noteContent.value]);

function closeModal() {
  noteModal.hidden = true;
  editingNoteId = null;
  noteForm.reset();
  noteFormError.hidden = true;
  currentAttachments = [];
  attachmentsDirty = false;
  renderAttachments();
  // Se uma nova versão do app chegou a ser instalada enquanto o usuário
  // editava uma nota, ela só é aplicada agora, ao fechar — assim nada do
  // que estava sendo digitado se perde.
  if (updateReady) reloadForUpdate();
}

newNoteBtn.addEventListener("click", () => openModal());
function requestClose() {
  const hasChanges = formState() !== modalSnapshot || attachmentsDirty;
  if (hasChanges && !confirm("Descartar as alterações desta nota?")) return;
  closeModal();
}
modalClose.addEventListener("click", requestClose);
// Só fecha se o clique COMEÇOU no fundo: selecionar texto e soltar o mouse
// fora do modal não pode descartar o que foi digitado.
let backdropPressed = false;
noteModal.addEventListener("mousedown", (e) => { backdropPressed = e.target === noteModal; });
noteModal.addEventListener("click", (e) => {
  if (e.target === noteModal && backdropPressed) requestClose();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !noteModal.hidden) requestClose();
});

noteForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  noteFormError.hidden = true;
  const payload = {
    title: noteTitle.value.trim(),
    content: noteContent.value.trim(),
    date: noteDate.value,
    attachments: currentAttachments,
    updatedAt: serverTimestamp()
  };
  if (!payload.title || !payload.content) {
    noteFormError.textContent = "Preencha o título e o conteúdo da nota.";
    noteFormError.hidden = false;
    return;
  }

  setButtonBusy(noteSaveBtn, true);
  try {
    const notesRef = collection(db, "users", currentUser.uid, "notes");
    const wasEditing = !!editingNoteId;
    const write = wasEditing
      ? updateDoc(doc(notesRef, editingNoteId), payload)
      : setDoc(doc(notesRef), { ...payload, createdAt: serverTimestamp() });
    const result = await commitWrite(write);
    showToast(
      result === "synced"
        ? (wasEditing ? "Nota atualizada" : "Nota criada")
        : "Salvo no aparelho — será sincronizado quando a internet voltar"
    );
    closeModal();
  } catch (err) {
    console.error(err);
    noteFormError.textContent = "Não foi possível salvar. Verifique os dados e tente novamente.";
    noteFormError.hidden = false;
  } finally {
    setButtonBusy(noteSaveBtn, false);
  }
});

deleteBtn.addEventListener("click", async () => {
  if (!editingNoteId || !currentUser || deleteBtn.disabled) return;
  if (!confirm("Excluir esta nota? Essa ação não pode ser desfeita.")) return;
  deleteBtn.disabled = true;
  try {
    const notesRef = collection(db, "users", currentUser.uid, "notes");
    const result = await commitWrite(deleteDoc(doc(notesRef, editingNoteId)));
    showToast(result === "synced" ? "Nota excluída" : "Exclusão salva — será sincronizada ao voltar a conexão");
    closeModal();
  } catch (err) {
    console.error(err);
    noteFormError.textContent = "Não foi possível excluir. Tente novamente.";
    noteFormError.hidden = false;
  } finally {
    deleteBtn.disabled = false;
  }
});

/* ---------- Impressão ---------- */
printBtn.addEventListener("click", () => {
  document.getElementById("print-date").textContent = formatDate(noteDate.value);
  document.getElementById("print-title").textContent = noteTitle.value;
  document.getElementById("print-content").textContent = noteContent.value;
  window.print();
});

/* ---------- Service Worker: atualização automática ---------- */
// Quando uma nova versão do app é publicada (ex.: no GitHub Pages), o
// navegador baixa o novo service-worker.js sozinho. Como o service worker já
// chama skipWaiting()/clients.claim(), ele assume o controle na hora — falta
// só recarregar a página para os arquivos novos (HTML/CSS/JS) entrarem em
// uso. É isso que o trecho abaixo faz, sem exigir nenhuma ação do usuário.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => {
        // Verifica se já existe uma versão nova sempre que o app volta a
        // ficar em primeiro plano (ex.: usuário reabre depois de um tempo).
        // Os navegadores já fazem essa checagem sozinhos periodicamente;
        // isso só antecipa a verificação.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });
      })
      .catch((err) => console.error("Falha ao registrar service worker:", err));
  });

  // Na primeira visita não há controller anterior: o clients.claim() do SW
  // causaria um reload desnecessário (apagando o que estivesse digitado).
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;
    // Se o usuário estiver com o modal de nota aberto (editando ou criando),
    // adia o recarregamento até ele fechar o modal — closeModal() cuida
    // disso ao checar "updateReady". Caso contrário, recarrega na hora.
    if (!noteModal.hidden) {
      updateReady = true;
      showToast("Nova versão do app pronta — será aplicada ao fechar esta nota");
      return;
    }
    reloadForUpdate();
  });
}
