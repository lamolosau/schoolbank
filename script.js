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
const loginBtn = document.getElementById("login-btn");
const profileTriggerBtn = document.getElementById("profile-trigger-btn");
const profileModal = document.getElementById("profile-modal");
const closeProfileBtn = document.getElementById("close-profile-btn");
const logoutBtn = document.getElementById("logout-btn");
const authModal = document.getElementById("auth-modal");
const authTitle = document.getElementById("auth-title");
const authEmailInput = document.getElementById("auth-email");
const authPassInput = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authCancelBtn = document.getElementById("auth-cancel-btn");
const toggleAuthModeLink = document.getElementById("toggle-auth-mode");

// Element Toast (Notification)
const toastElement = document.getElementById("pixel-toast");

// Elements internes à la modale profil
const profileEmail = document.getElementById("profile-email");
const profileCoins = document.getElementById("profile-coins");
const profileStatus = document.getElementById("profile-status");

let selectedFile = null;
let currentUser = null;
let isLoginMode = true;

// ==========================================
// --- FONCTION NOTIFICATION (TOAST) ---
// ==========================================
function showToast(message) {
  toastElement.textContent = message;
  toastElement.className = "show";
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

  if (currentUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (profile) {
      currentUser.profileData = profile;
      setupRealtimeListener();
    }
  }
  updateAuthUI();
}

function updateAuthUI() {
  if (currentUser) {
    if (loginBtn) loginBtn.style.display = "none";
    if (profileTriggerBtn) profileTriggerBtn.style.display = "inline-block";
  } else {
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (profileTriggerBtn) profileTriggerBtn.style.display = "none";
  }
}

loginBtn.addEventListener("click", () => {
  authModal.classList.remove("hidden");
  resetAuthForm();
});

// ==========================================
// --- GESTION DU PROFIL & ABONNEMENT ---
// ==========================================

profileTriggerBtn.addEventListener("click", () => {
  if (!currentUser) return;

  const upgradeBtn = document.getElementById("upgrade-btn");
  const manageBtn = document.getElementById("manage-sub-btn");

  profileEmail.textContent = currentUser.email;

  if (currentUser.profileData) {
    profileCoins.textContent = currentUser.profileData.coins;
    const isPremium = currentUser.profileData.is_premium;

    profileStatus.textContent = isPremium ? "PREMIUM" : "FREEMIUM";
    profileStatus.style.color = isPremium ? "#00aa00" : "inherit";

    // Gestion UI des boutons (La vraie sécurité est côté serveur/RPC)
    if (isPremium) {
      if (upgradeBtn) upgradeBtn.style.display = "none";
      if (manageBtn) {
        manageBtn.style.display = "inline-block";
        manageBtn.textContent = "GÉRER ABO";

        manageBtn.onclick = async (e) => {
          e.preventDefault();
          const portalTab = window.open("", "_blank");
          portalTab.document.write(
            "<html><body style='background:black; color:white; font-family:monospace; display:flex; justify-content:center; align-items:center; height:100vh;'>Chargement...</body></html>"
          );
          manageBtn.textContent = "CHARGEMENT...";

          const { data, error } = await supabase.functions.invoke(
            "create-portal-link"
          );

          if (error) {
            console.error("Erreur Supabase:", error);
            manageBtn.textContent = "ERREUR";
            showToast("ERREUR PORTAIL");
            portalTab.close();
          } else if (data?.url) {
            portalTab.location.href = data.url;
            manageBtn.textContent = "GÉRER ABO";
          } else {
            manageBtn.textContent = "ERREUR";
            showToast("PAS DE COMPTE TROUVÉ");
            portalTab.close();
          }
        };
      }
    } else {
      if (manageBtn) manageBtn.style.display = "none";
      if (upgradeBtn) {
        upgradeBtn.style.display = "inline-block";
        const baseStripeUrl =
          "https://buy.stripe.com/test_dRmaEXgQueNd2gocPk7Zu00";
        const customUrl = `${baseStripeUrl}?prefilled_email=${encodeURIComponent(
          currentUser.email
        )}&client_reference_id=${currentUser.id}`;
        upgradeBtn.href = customUrl;
      }
    }
  } else {
    profileCoins.textContent = "0";
    profileStatus.textContent = "CHARGEMENT...";
    if (upgradeBtn) upgradeBtn.style.display = "none";
    if (manageBtn) manageBtn.style.display = "none";
  }
  profileModal.classList.remove("hidden");
});

closeProfileBtn.addEventListener("click", () => {
  profileModal.classList.add("hidden");
});

logoutBtn.addEventListener("click", async () => {
  profileModal.classList.add("hidden");
  await signOut();
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
    showToast("REMPLIR TOUS LES CHAMPS !");
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
      showToast("CONNEXION REUSSIE !");
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      currentUser = data.user;
      showToast("COMPTE CREE !");
    }
    authModal.classList.add("hidden");
    updateAuthUI();
  } catch (error) {
    console.error(error);
    showToast("ERREUR: " + error.message);
  } finally {
    authSubmitBtn.textContent = isLoginMode ? "GO" : "CREER";
  }
});

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (!error) {
    currentUser = null;
    updateAuthUI();
    showToast("DECONNECTE.");
  }
}

// ==========================================
// --- GESTION DES UPLOADS ---
// ==========================================

uploadTriggerBtn.addEventListener("click", () => {
  if (!currentUser) {
    showToast("CONNECTE-TOI D'ABORD !");
    authModal.classList.remove("hidden");
    return;
  }
  fileInput.click();
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    // Petite sécu JS (mais doit être renforcée côté Supabase Storage)
    if (selectedFile.type !== "application/pdf") {
      showToast("SEULS LES PDF SONT ACCEPTÉS !");
      fileInput.value = "";
      selectedFile = null;
      return;
    }
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
  if (!selectedFile || !currentUser) return;

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

    // NOTE: On ne récupère plus l'URL publique ici pour l'insérer en base
    // C'est le serveur qui gérera l'URL sécurisée au téléchargement.
    // On peut stocker le path ou laisser null si ton backend le gère.
    // Pour ton code actuel, on récupère le path public mais on ne le montrera pas aux autres.
    const { data: urlData } = supabase.storage
      .from("pdfs")
      .getPublicUrl(cleanName);

    const { data: insertedData, error: dbError } = await supabase
      .from("files")
      .insert([
        {
          name: selectedFile.name,
          file_url: urlData.publicUrl, // Stocké en base, mais ne sera pas SELECT par les autres
          etablissement: info.etab,
          formation: info.formation,
          subject: info.subject,
          prof: info.prof,
          type: info.type,
          year: info.year,
        },
      ])
      .select();

    if (dbError) throw dbError;

    confirmUploadBtn.textContent = "ANALYSE IA...";
    showToast("ANALYSE EN COURS...");

    const insertedFile = insertedData[0];
    const { data: verdict, error: aiError } = await supabase.functions.invoke(
      "analyze-document",
      {
        body: {
          fileId: insertedFile.id,
          fileUrl: urlData.publicUrl,
          filePath: cleanName,
          metadata: info,
        },
      }
    );

    if (aiError) {
      console.error("Erreur IA", aiError);
      showToast("ERREUR ANALYSE (En attente)");
    } else if (verdict.valid) {
      showToast("✅ FICHIER VALIDÉ & PUBLIÉ !");
    } else {
      showToast("❌ REFUSÉ : " + verdict.reason);
    }

    modalUpload.classList.add("hidden");
    fileInput.value = "";
    confirmUploadBtn.textContent = "ENVOYER";
    fetchFiles();
    await checkUser();
  } catch (error) {
    console.error(error);
    showToast("ERREUR UPLOAD...");
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
// --- RECUPERATION DES FICHIERS (SECURISÉE) ---
// ==========================================

async function fetchFiles() {
  const filterEtab = document.getElementById("filter-etab").value;
  const filterFormation = document.getElementById("filter-formation").value;
  const filterSubject = document.getElementById("filter-subject").value;
  const filterProf = document.getElementById("filter-prof").value;
  const filterType = document.getElementById("filter-type").value;
  const filterYear = document.getElementById("filter-year").value;

  // 🔒 SECURITÉ: On ne sélectionne PAS 'file_url' !
  // On ne prend que ce qui est nécessaire pour l'affichage.
  let query = supabase
    .from("files")
    .select(
      "id, name, etablissement, formation, subject, prof, type, year, created_at"
    )
    .eq("status", "approved")
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

function refreshProfileUI(newProfileData) {
  currentUser.profileData = newProfileData;
  const headerCoins = document.getElementById("user-coins");
  if (headerCoins) {
    headerCoins.textContent = newProfileData.is_premium
      ? "∞"
      : newProfileData.coins;
  }
  if (!profileModal.classList.contains("hidden")) {
    profileCoins.textContent = newProfileData.coins;
    const isPremium = newProfileData.is_premium;
    profileStatus.textContent = isPremium ? "PREMIUM" : "FREEMIUM";
    profileStatus.style.color = isPremium ? "#00aa00" : "inherit";

    const upgradeBtn = document.getElementById("upgrade-btn");
    const manageBtn = document.getElementById("manage-sub-btn");
    if (isPremium) {
      if (upgradeBtn) upgradeBtn.style.display = "none";
      if (manageBtn) manageBtn.style.display = "inline-block";
    } else {
      if (manageBtn) manageBtn.style.display = "none";
      if (upgradeBtn) upgradeBtn.style.display = "inline-block";
    }
  }
}

function setupRealtimeListener() {
  if (!currentUser) return;
  supabase
    .channel("public:profiles")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${currentUser.id}`,
      },
      (payload) => {
        refreshProfileUI(payload.new);
        showToast("DONNÉES MISES À JOUR !");
      }
    )
    .subscribe();
}

// ==========================================
// --- AFFICHAGE TABLEAU (SECURISÉ XSS) ---
// ==========================================

function renderTable(files) {
  tableBody.innerHTML = ""; // Vide le tableau

  files.forEach((file) => {
    const row = document.createElement("tr");

    // Fonction helper pour créer une cellule textuelle sécurisée
    // textContent empêche l'injection de HTML (XSS)
    const createCell = (text) => {
      const td = document.createElement("td");
      td.textContent = text || "-";
      return td;
    };

    row.appendChild(createCell(file.name));
    row.appendChild(createCell(file.subject));
    row.appendChild(createCell(file.type));
    row.appendChild(createCell(file.prof));
    row.appendChild(createCell(file.year));

    // Cellule de téléchargement
    const dlCell = document.createElement("td");
    const link = document.createElement("a");
    link.href = "#";
    link.className = "dl-link";
    link.textContent = "[DL]";

    // On attache l'objet file entier à l'élément pour l'utiliser au clic
    // C'est plus propre que dataset pour des objets complexes, mais ici dataset suffit pour l'ID
    link.dataset.id = file.id;

    // Écouteur d'événement direct (Closure sécurisée)
    link.addEventListener("click", (e) => handleDownloadClick(e, file.id));

    dlCell.appendChild(link);
    row.appendChild(dlCell);

    tableBody.appendChild(row);
  });
}

// Fonction séparée pour gérer le téléchargement
async function handleDownloadClick(e, fileId) {
  e.preventDefault();
  const linkElement = e.target;

  if (!currentUser) {
    showToast("CONNECTE-TOI POUR TELECHARGER !");
    authModal.classList.remove("hidden");
    return;
  }

  const newTab = window.open("", "_blank");
  newTab.document.write(
    "<h1>Chargement du fichier...</h1><p>Vérification de vos coins...</p>"
  );

  linkElement.textContent = "...";

  const { data, error } = await supabase.rpc("download_file", {
    file_id: fileId,
  });

  if (error || (data && data.error)) {
    console.error(error || data.error);
    showToast(data?.error || "ERREUR SYSTEME");
    linkElement.textContent = "[X]";
    newTab.close();
  } else {
    showToast("TELECHARGEMENT...");
    if (data.remaining !== undefined) {
      document.getElementById("profile-coins").textContent = data.remaining;
    }
    newTab.location.href = data.url;
    linkElement.textContent = "[v]";
  }
}

checkUser();
fetchFiles();
