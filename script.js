// --- INIT SUPABASE ---
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ELEMENTS ---
const fileInput = document.getElementById("file-upload-input");
const tableBody = document.querySelector(".pixel-table tbody");
const searchButton = document.getElementById("search-btn");
const uploadTriggerBtn = document.getElementById("upload-trigger-btn");

// Elements Modale Upload
const modalUpload = document.getElementById("upload-modal");
const modalFilename = document.getElementById("modal-filename");
const cancelUploadBtn = document.getElementById("cancel-btn");
const confirmUploadBtn = document.getElementById("confirm-upload-btn");

// Elements Auth
const authBtn = document.getElementById("auth-btn");
const userDisplay = document.getElementById("user-display");
const authModal = document.getElementById("auth-modal");
const authTitle = document.getElementById("auth-title");
const authEmailInput = document.getElementById("auth-email");
const authPassInput = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authCancelBtn = document.getElementById("auth-cancel-btn");
const toggleAuthModeLink = document.getElementById("toggle-auth-mode");

// Element Toast (Notification)
const toastElement = document.getElementById("pixel-toast");

let selectedFile = null;
let currentUser = null;
let isLoginMode = true;

// ==========================================
// --- FONCTION NOTIFICATION (TOAST) ---
// ==========================================
function showToast(message) {
  toastElement.textContent = message;
  toastElement.className = "show";

  // Enlève la classe après 3 secondes (correspond à l'animation CSS)
  setTimeout(function () {
    toastElement.className = toastElement.className.replace("show", "");
  }, 3000);
}

// ==========================================
// --- GESTION DE L'AUTHENTIFICATION ---
// ==========================================

async function checkUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentUser = session?.user || null;
  updateAuthUI();
}

function updateAuthUI() {
  if (currentUser) {
    authBtn.textContent = "LOGOUT";
    userDisplay.style.display = "inline";
    userDisplay.textContent = currentUser.email.split("@")[0];
  } else {
    authBtn.textContent = "LOGIN";
    userDisplay.style.display = "none";
  }
}

authBtn.addEventListener("click", () => {
  if (currentUser) {
    signOut();
  } else {
    authModal.classList.remove("hidden");
    resetAuthForm();
  }
});

authCancelBtn.addEventListener("click", () => {
  authModal.classList.add("hidden");
});

toggleAuthModeLink.addEventListener("click", (e) => {
  e.preventDefault();
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    authTitle.textContent = "> CONNEXION_";
    toggleAuthModeLink.textContent = "Pas de compte ? S'inscrire";
    authSubmitBtn.textContent = "GO";
  } else {
    authTitle.textContent = "> INSCRIPTION_";
    toggleAuthModeLink.textContent = "Déjà un compte ? Se connecter";
    authSubmitBtn.textContent = "CREER";
  }
});

authSubmitBtn.addEventListener("click", async () => {
  const email = authEmailInput.value;
  const password = authPassInput.value;

  if (!email || !password) {
    showToast("REMPLIR TOUS LES CHAMPS !"); // Remplacé alert
    return;
  }

  authSubmitBtn.textContent = "...";

  try {
    if (isLoginMode) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      currentUser = data.user;
      showToast("CONNEXION REUSSIE !"); // Remplacé alert
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      currentUser = data.user;
      showToast("COMPTE CREE !"); // Remplacé alert
    }

    authModal.classList.add("hidden");
    updateAuthUI();
  } catch (error) {
    console.error(error);
    showToast("ERREUR: " + error.message); // Remplacé alert
  } finally {
    authSubmitBtn.textContent = isLoginMode ? "GO" : "CREER";
  }
});

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (!error) {
    currentUser = null;
    updateAuthUI();
    showToast("DECONNECTE."); // Remplacé alert
  }
}

// ==========================================
// --- GESTION DES UPLOADS ---
// ==========================================

uploadTriggerBtn.addEventListener("click", () => {
  if (!currentUser) {
    showToast("CONNECTE-TOI D'ABORD !"); // Remplacé alert
    authModal.classList.remove("hidden");
    return;
  }
  fileInput.click();
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    modalFilename.textContent = selectedFile.name;
    modalUpload.classList.remove("hidden");
  }
});

cancelUploadBtn.addEventListener("click", () => {
  modalUpload.classList.add("hidden");
  fileInput.value = "";
  selectedFile = null;
});

confirmUploadBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  if (!currentUser) {
    showToast("ERREUR: NON CONNECTE"); // Remplacé alert
    return;
  }

  const info = {
    etab: document.getElementById("input-etab").value,
    formation: document.getElementById("input-formation").value,
    subject: document.getElementById("input-subject").value,
    prof:
      document.getElementById("input-prof").value.toUpperCase() || "INCONNU",
    type: document.getElementById("input-type").value,
    year: document.getElementById("input-year").value,
  };

  confirmUploadBtn.textContent = "ENVOI...";

  try {
    const cleanName =
      Date.now() + "_" + selectedFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const { error: storageError } = await supabase.storage
      .from("pdfs")
      .upload(cleanName, selectedFile);

    if (storageError) throw storageError;

    const { data: urlData } = supabase.storage
      .from("pdfs")
      .getPublicUrl(cleanName);

    const { error: dbError } = await supabase.from("files").insert([
      {
        name: selectedFile.name,
        file_url: urlData.publicUrl,
        etablissement: info.etab,
        formation: info.formation,
        subject: info.subject,
        prof: info.prof,
        type: info.type,
        year: info.year,
      },
    ]);

    if (dbError) throw dbError;

    showToast("UPLOAD SUCCESS !"); // Remplacé alert
    modalUpload.classList.add("hidden");
    fileInput.value = "";
    confirmUploadBtn.textContent = "ENVOYER";
    fetchFiles();
  } catch (error) {
    console.error(error);
    showToast("ERREUR UPLOAD..."); // Remplacé alert
    confirmUploadBtn.textContent = "ENVOYER";
  }
});

function resetAuthForm() {
  authEmailInput.value = "";
  authPassInput.value = "";
  isLoginMode = true;
  authTitle.textContent = "> CONNEXION_";
  toggleAuthModeLink.textContent = "Pas de compte ? S'inscrire";
  authSubmitBtn.textContent = "GO";
}

// ==========================================
// --- RECUPERATION DES FICHIERS ---
// ==========================================

async function fetchFiles() {
  const filterEtab = document.getElementById("filter-etab").value;
  const filterFormation = document.getElementById("filter-formation").value;
  const filterSubject = document.getElementById("filter-subject").value;
  const filterProf = document.getElementById("filter-prof").value;
  const filterType = document.getElementById("filter-type").value;
  const filterYear = document.getElementById("filter-year").value;

  let query = supabase
    .from("files")
    .select("*")
    .order("created_at", { ascending: false });

  if (filterEtab) query = query.eq("etablissement", filterEtab);
  if (filterFormation) query = query.eq("formation", filterFormation);
  if (filterSubject) query = query.eq("subject", filterSubject);
  if (filterType) query = query.eq("type", filterType);
  if (filterYear) query = query.eq("year", filterYear);
  if (filterProf) query = query.ilike("prof", `%${filterProf}%`);

  const { data, error } = await query;

  if (error) {
    console.error("Erreur Fetch:", error);
    tableBody.innerHTML = '<tr><td colspan="6">ERREUR CHARGEMENT...</td></tr>';
  } else {
    if (data.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="6">AUCUN FICHIER TROUVE...</td></tr>';
    } else {
      renderTable(data);
    }
  }
}

searchButton.addEventListener("click", () => {
  searchButton.textContent = "CHARGEMENT...";
  fetchFiles().then(() => {
    searchButton.textContent = "CHERCHER";
  });
});

function renderTable(files) {
  tableBody.innerHTML = "";
  files.forEach((file) => {
    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${file.name}</td>
            <td>${file.subject}</td>
            <td>${file.type}</td>
            <td>${file.prof}</td>
            <td>${file.year}</td>
            <td><a href="${file.file_url}" target="_blank" class="dl-link">[v]</a></td>
        `;
    tableBody.appendChild(row);
  });
}

checkUser();
fetchFiles();
