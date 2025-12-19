// --- INIT SUPABASE ---
// On vérifie si supabase existe déjà, sinon on le crée
var supabase;

if (window.supabase && window.supabase.createClient) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.error("La bibliothèque Supabase n'est pas chargée !");
}

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
  // 1. Récupérer la session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentUser = session?.user || null;

  if (currentUser) {
    // 2. Récupérer les infos du profil (Coins, Premium...)
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (profile) {
      currentUser.profileData = profile;
      refreshProfileUI(profile); // Met à jour l'UI immédiatement
    }

    // 3. Récupérer les achats (Pour les boutons ACCÉDER)
    const { data: purchases } = await supabase
      .from("purchases")
      .select("file_id")
      .eq("user_id", currentUser.id);

    // On stocke les IDs des fichiers achetés
    currentUser.owned_files = purchases ? purchases.map((p) => p.file_id) : [];

    setupRealtimeListener();
  } else {
    // Si pas connecté, on nettoie
    if (profileCoins) profileCoins.textContent = "0";
    if (profileStatus) profileStatus.textContent = "...";
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      showToast("CONNEXION REUSSIE !");
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      showToast("COMPTE CREE ! VERIFIE TES EMAILS.");
    }

    authModal.classList.add("hidden");

    // --- C'EST ICI LA MAGIE ---
    showToast("CHARGEMENT PROFIL...");
    await checkUser(); // On attend d'avoir chargé le profil et les achats
    fetchFiles(); // On redessine le tableau avec les boutons verts "ACCÉDER"
    // -------------------------
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

    // Mise à zéro visuelle immédiate
    document.getElementById("profile-coins").textContent = "0";
    document.getElementById("profile-status").textContent = "DECONNECTÉ";

    updateAuthUI();
    fetchFiles(); // Recharge le tableau pour enlever les boutons "ACCÉDER"
    showToast("DECONNECTE.");
  }
}

// Fonction pour calculer l'empreinte numérique (Hash) d'un fichier
async function calculateFileHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

  // Récupération des données du formulaire
  const info = {
    etab: document.getElementById("input-etab").value,
    formation: document.getElementById("input-formation").value,
    subject: document.getElementById("input-subject").value,
    prof:
      document.getElementById("input-prof").value.toUpperCase() || "INCONNU",
    type: document.getElementById("input-type").value,
    year: document.getElementById("input-year").value,
  };

  confirmUploadBtn.textContent = "VERIFICATION...";

  try {
    // 1. CALCUL DU HASH (Anti-Doublon Local)
    const fileHash = await calculateFileHash(selectedFile);

    // 2. VERIFICATION EN BASE (Est-ce qu'on l'a déjà ?)
    const { data: existingFile } = await supabase
      .from("files")
      .select("id")
      .eq("file_hash", fileHash)
      .maybeSingle();

    if (existingFile) {
      showToast("❌ FICHIER DÉJÀ PRÉSENT DANS LA BANQUE !");
      confirmUploadBtn.textContent = "ENVOYER";
      return; // On arrête tout ici
    }

    // 3. UPLOAD PHYSIQUE (Nécessaire pour que l'IA puisse le lire)
    confirmUploadBtn.textContent = "ENVOI...";
    const cleanName =
      Date.now() + "_" + selectedFile.name.replace(/[^a-zA-Z0-9.]/g, "_");

    const { error: storageError } = await supabase.storage
      .from("pdfs")
      .upload(cleanName, selectedFile);

    if (storageError) throw storageError;

    // Récupération de l'URL publique pour l'IA
    const { data: urlData } = supabase.storage
      .from("pdfs")
      .getPublicUrl(cleanName);
    const publicUrl = urlData.publicUrl;

    // 4. ANALYSE IA & VERIFICATION DE COHERENCE
    confirmUploadBtn.textContent = "ANALYSE IA...";
    showToast("L'IA VÉRIFIE VOTRE FICHIER...");

    // On appelle ta Edge Function 'analyze-document'
    // Elle doit comparer le contenu du PDF avec 'info' (tes inputs)
    const { data: analysis, error: aiError } = await supabase.functions.invoke(
      "analyze-document",
      {
        body: {
          fileUrl: publicUrl,
          userInputs: info, // On envoie ce que l'user prétend que c'est
        },
      }
    );

    if (aiError) {
      console.error("Erreur IA:", aiError);
      // En cas d'erreur technique IA, on supprime le fichier par sécurité ?
      // Ou on accepte manuellement ? Ici je choisis la sécurité : on annule.
      await supabase.storage.from("pdfs").remove([cleanName]);
      showToast("ERREUR IA : UPLOAD ANNULÉ");
      confirmUploadBtn.textContent = "ENVOYER";
      return;
    }

    // 5. VERDICT DE L'IA
    if (!analysis.valid) {
      // SI C'EST UN FAUX OU INCOHÉRENT :
      showToast(`❌ REFUSÉ : ${analysis.reason}`);
      // On supprime immédiatement le fichier du stockage ("Poubelle")
      await supabase.storage.from("pdfs").remove([cleanName]);
      confirmUploadBtn.textContent = "ENVOYER";
      return;
    }

    // 6. SUCCÈS : INSERTION EN BASE (Seulement si tout est bon)
    const { error: dbError } = await supabase.from("files").insert([
      {
        name: selectedFile.name,
        user_id: currentUser.id, // <--- IMPORTANT : Lier le fichier à l'utilisateur
        file_url: urlData.publicUrl,
        file_hash: fileHash,
        etablissement: info.etab,
        formation: info.formation,
        subject: info.subject,
        prof: info.prof,
        type: info.type,
        year: info.year,
        status: "approved", // <--- INDISPENSABLE : Pour qu'il s'affiche
      },
    ]);

    if (dbError) throw dbError;

    showToast("✅ FICHIER VALIDÉ ET PUBLIÉ !");
    modalUpload.classList.add("hidden");
    fileInput.value = "";
    confirmUploadBtn.textContent = "ENVOYER";

    // --- AJOUT : REMISE À ZÉRO DES FILTRES ---
    document.getElementById("filter-etab").value = "";
    document.getElementById("filter-formation").value = "";
    document.getElementById("filter-subject").value = "";
    document.getElementById("filter-type").value = "";
    document.getElementById("filter-year").value = "";
    document.getElementById("filter-prof").value = "";
    // -----------------------------------------

    // Rafraîchissement automatique
    await checkUser();
    await fetchFiles();
  } catch (error) {
    console.error(error);
    showToast("ERREUR TECHNIQUE...");
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

    // --- LOGIQUE D'AFFICHAGE DU BOUTON ---
    // On vérifie si l'ID du fichier actuel est dans les fichiers possédés
    const isOwned = currentUser?.owned_files?.includes(file.id);

    if (isOwned) {
      link.textContent = "[ACCÉDER]";
      link.classList.add("owned");
      link.style.color = "#008800"; // Vert foncé
    } else {
      link.textContent = "[ACHETER - 50c]";
    }
    // -------------------------------------

    link.dataset.id = file.id;
    link.addEventListener("click", (e) => handleDownloadClick(e, file.id));

    dlCell.appendChild(link);
    row.appendChild(dlCell);
    tableBody.appendChild(row);
  });
}

let currentPurchaseFileId = null; // Pour stocker l'ID du fichier en cours d'achat

async function handleDownloadClick(e, fileId) {
  e.preventDefault();
  const linkElement = e.target;

  if (!currentUser) {
    showToast("CONNECTE-TOI POUR ACCÉDER !");
    authModal.classList.remove("hidden");
    return;
  }

  // Vérifie si le bouton affiche déjà "ACCÉDER"
  const isAlreadyOwned = linkElement.textContent.includes("ACCÉDER");

  if (isAlreadyOwned) {
    // Si déjà possédé, on lance directement le téléchargement
    executeDownload(fileId, linkElement);
  } else {
    // Sinon, on ouvre la modale de confirmation personnalisée
    currentPurchaseFileId = fileId;
    const purchaseModal = document.getElementById("purchase-modal");
    purchaseModal.classList.remove("hidden");

    // On lie l'élément du lien pour pouvoir le modifier après l'achat
    window.lastClickedLink = linkElement;
  }
}

// Fonction qui fait l'appel réel à Supabase
async function executeDownload(fileId, linkElement) {
  const originalText = linkElement.textContent;
  linkElement.textContent = "...";

  // Conversion explicite en nombre pour correspondre au type BIGINT de la base
  const cleanId = parseInt(fileId, 10);

  const { data, error } = await supabase.rpc("download_file", {
    p_file_id: cleanId, // Assure-toi que c'est bien p_file_id ici
  });

  if (error || (data && data.error)) {
    console.error("Erreur détaillée:", error || data.error);
    showToast(data?.error || "ERREUR DE TRANSACTION");
    linkElement.textContent = originalText;
  } else {
    showToast("OUVERTURE...");
    if (data.remaining !== undefined) {
      document.getElementById("profile-coins").textContent = data.remaining;
    }
    window.open(data.url, "_blank");
    if (currentUser && !currentUser.owned_files.includes(cleanId)) {
      currentUser.owned_files.push(cleanId); // On l'ajoute à la liste locale
    }
    // Transforme le bouton en vert foncé "ACCÉDER"
    linkElement.textContent = "[ACCÉDER]";
    linkElement.classList.add("owned");
  }
}

// Gestionnaires pour les boutons de la modale de confirmation
document.getElementById("cancel-purchase-btn").addEventListener("click", () => {
  document.getElementById("purchase-modal").classList.add("hidden");
});

document
  .getElementById("confirm-purchase-btn")
  .addEventListener("click", async () => {
    document.getElementById("purchase-modal").classList.add("hidden");
    if (currentPurchaseFileId && window.lastClickedLink) {
      await executeDownload(currentPurchaseFileId, window.lastClickedLink);
    }
  });

checkUser().then(() => {
  fetchFiles();
});
