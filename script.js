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
const loginBtn = document.getElementById("login-btn"); // Ancien auth-btn
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

  if (currentUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (profile) {
      currentUser.profileData = profile;

      // NOUVEAU : On lance l'écouteur temps réel ici !
      setupRealtimeListener();
    }
  }
  updateAuthUI();
}

function updateAuthUI() {
  if (currentUser) {
    // CONNECTÉ : On cache Login, on affiche Profil
    if (loginBtn) loginBtn.style.display = "none";
    if (profileTriggerBtn) profileTriggerBtn.style.display = "inline-block";
  } else {
    // DECONNECTÉ : On affiche Login, on cache Profil
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (profileTriggerBtn) profileTriggerBtn.style.display = "none";
  }
}

// 1. Ouvrir la modale de connexion (Visiteur)
loginBtn.addEventListener("click", () => {
  authModal.classList.remove("hidden");
  resetAuthForm();
});

// ==========================================
// --- GESTION DU PROFIL & ABONNEMENT ---
// ==========================================

profileTriggerBtn.addEventListener("click", () => {
  // Sécurité : si pas connecté, on ne fait rien
  if (!currentUser) return;

  // 1. Récupération des éléments HTML de la modale
  const upgradeBtn = document.getElementById("upgrade-btn");
  const manageBtn = document.getElementById("manage-sub-btn");

  // Remplissage de l'email
  profileEmail.textContent = currentUser.email;

  // 2. Remplissage des données (Coins & Statut)
  if (currentUser.profileData) {
    profileCoins.textContent = currentUser.profileData.coins;

    const isPremium = currentUser.profileData.is_premium;

    // --- A. GESTION DU TEXTE STATUT ---
    profileStatus.textContent = isPremium ? "PREMIUM" : "FREEMIUM";
    // Vert si premium, noir sinon
    profileStatus.style.color = isPremium ? "#00aa00" : "inherit";

    // --- B. GESTION DES BOUTONS (Bascule) ---
    if (isPremium) {
      // === CAS PREMIUM : On affiche "GÉRER ABO" ===
      if (upgradeBtn) upgradeBtn.style.display = "none";
      if (manageBtn) {
        manageBtn.style.display = "inline-block";
        // Remise à zéro du texte (au cas où il est resté sur "Chargement...")
        manageBtn.textContent = "GÉRER ABO";

        // LOGIQUE DU PORTAIL CLIENT (Simple et Robuste)
        // LOGIQUE DU PORTAIL CLIENT (Ouvre dans un nouvel onglet)
        manageBtn.onclick = async (e) => {
          e.preventDefault();

          // 1. On ouvre l'onglet TOUT DE SUITE (pour éviter les bloqueurs de pop-up)
          // On peut mettre un petit message le temps que ça charge
          const portalTab = window.open("", "_blank");
          portalTab.document.write(
            "<html><body style='background:black; color:white; font-family:monospace; display:flex; justify-content:center; align-items:center; height:100vh;'>Chargement du portail Stripe...</body></html>"
          );

          manageBtn.textContent = "CHARGEMENT...";

          // 2. Appel à l'Edge Function
          const { data, error } = await supabase.functions.invoke(
            "create-portal-link"
          );

          if (error) {
            console.error("Erreur Supabase:", error);
            manageBtn.textContent = "ERREUR";
            showToast("ERREUR PORTAIL");

            // Si ça plante, on ferme l'onglet qui ne sert à rien
            portalTab.close();
          } else if (data?.url) {
            // 3. Succès : On redirige l'onglet déjà ouvert vers la bonne URL
            portalTab.location.href = data.url;

            // On remet le texte du bouton
            manageBtn.textContent = "GÉRER ABO";
          } else {
            console.error("Erreur:", data);
            manageBtn.textContent = "ERREUR";
            showToast("PAS DE COMPTE STRIPE TROUVÉ");
            portalTab.close();
          }
        };
      }
    } else {
      // === CAS FREEMIUM : On affiche "UPGRADE" ===
      if (manageBtn) manageBtn.style.display = "none";

      if (upgradeBtn) {
        upgradeBtn.style.display = "inline-block";
        const baseStripeUrl =
          "https://buy.stripe.com/test_dRmaEXgQueNd2gocPk7Zu00";

        // Construction de l'URL avec les infos utilisateur
        const customUrl = `${baseStripeUrl}?prefilled_email=${encodeURIComponent(
          currentUser.email
        )}&client_reference_id=${currentUser.id}`;

        upgradeBtn.href = customUrl;
      }
    }
  } else {
    // Cas de chargement ou erreur de profil
    profileCoins.textContent = "0";
    profileStatus.textContent = "CHARGEMENT...";
    if (upgradeBtn) upgradeBtn.style.display = "none";
    if (manageBtn) manageBtn.style.display = "none";
  }

  // 3. IMPORTANT : On affiche la modale à la fin
  profileModal.classList.remove("hidden");
});

// 3. Fermer la modale profil (Bouton Retour)
closeProfileBtn.addEventListener("click", () => {
  profileModal.classList.add("hidden");
});

// 4. Se déconnecter (Bouton dans la modale)
logoutBtn.addEventListener("click", async () => {
  profileModal.classList.add("hidden"); // Ferme la modale
  await signOut(); // Lance la déconnexion Supabase
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
  if (selectedFile.type !== "application/pdf") {
    showToast("SEULS LES PDF SONT ACCEPTÉS !");
    fileInput.value = ""; // Reset
    return;
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
    showToast("ERREUR: NON CONNECTE");
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
    // 1. Upload du fichier physique (Storage)
    const cleanName =
      Date.now() + "_" + selectedFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const { error: storageError } = await supabase.storage
      .from("pdfs")
      .upload(cleanName, selectedFile);

    if (storageError) throw storageError;

    const { data: urlData } = supabase.storage
      .from("pdfs")
      .getPublicUrl(cleanName);

    // 2. Insertion dans la base de données (Table files)
    // Note: Le fichier est inséré avec le statut 'pending' par défaut (grâce à ton SQL)
    const { data: insertedData, error: dbError } = await supabase
      .from("files")
      .insert([
        {
          name: selectedFile.name,
          file_url: urlData.publicUrl,
          etablissement: info.etab,
          formation: info.formation,
          subject: info.subject,
          prof: info.prof,
          type: info.type,
          year: info.year,
          // user_id est mis automatiquement
        },
      ])
      .select(); // .select() est important pour récupérer l'ID du fichier créé

    if (dbError) throw dbError;

    // 3. --- ANALYSE IA (Nouveau bloc) ---
    confirmUploadBtn.textContent = "ANALYSE IA...";
    showToast("ANALYSE EN COURS...");

    const insertedFile = insertedData[0]; // On récupère le fichier qu'on vient de créer

    // Appel à l'Edge Function
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
      showToast("ERREUR ANALYSE (Fichier en attente)");
      // On ferme quand même la modale, le fichier sera traité plus tard manuellement si besoin
    } else if (verdict.valid) {
      showToast("✅ FICHIER VALIDÉ & PUBLIÉ !");
      // Le trigger SQL s'occupe de donner les coins, pas besoin de le faire ici
    } else {
      showToast("❌ REFUSÉ : " + verdict.reason);
      // Le fichier reste en statut 'rejected', il n'apparaîtra pas
    }

    // 4. Nettoyage et Fermeture
    modalUpload.classList.add("hidden");
    fileInput.value = "";
    confirmUploadBtn.textContent = "ENVOYER";

    // On rafraîchit la liste (si le fichier est validé, il apparaîtra, sinon non)
    fetchFiles();

    // On met à jour les coins de l'utilisateur (car il vient peut-être d'en gagner 100)
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
    .eq("status", "approved") // <--- LA LIGNE MAGIQUE POUR FILTRER
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

// Fonction pour rafraîchir l'interface sans recharger la page
function refreshProfileUI(newProfileData) {
  // 1. On met à jour la mémoire locale
  currentUser.profileData = newProfileData;

  // 2. On met à jour le Header (Coins)
  const headerCoins = document.getElementById("user-coins");
  if (headerCoins) {
    headerCoins.textContent = newProfileData.is_premium
      ? "∞"
      : newProfileData.coins;
  }

  // 3. On met à jour la Modale (si elle est ouverte)
  if (!profileModal.classList.contains("hidden")) {
    profileCoins.textContent = newProfileData.coins;

    const isPremium = newProfileData.is_premium;
    profileStatus.textContent = isPremium ? "PREMIUM" : "FREEMIUM";
    profileStatus.style.color = isPremium ? "#00aa00" : "inherit";

    // Gestion des boutons (Upgrade vs Gérer)
    const upgradeBtn = document.getElementById("upgrade-btn");
    const manageBtn = document.getElementById("manage-sub-btn");

    if (isPremium) {
      if (upgradeBtn) upgradeBtn.style.display = "none";
      if (manageBtn) {
        manageBtn.style.display = "inline-block";
        manageBtn.textContent = "GÉRER ABO";
        // (On garde le onclick défini dans le listener principal)
      }
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
        event: "UPDATE", // On écoute uniquement les mises à jour
        schema: "public",
        table: "profiles",
        filter: `id=eq.${currentUser.id}`, // IMPORTANT : On écoute SEULEMENT notre propre ligne
      },
      (payload) => {
        console.log("⚡ Changement détecté !", payload.new);

        // On lance la mise à jour visuelle
        refreshProfileUI(payload.new);

        // Petit bonus : Notification visuelle
        showToast("DONNÉES MISES À JOUR !");
      }
    )
    .subscribe();
}

// --- 5. AFFICHER TABLEAU (MODIFIÉ POUR SECURITE) ---
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
            <td><a href="#" class="dl-link" data-id="${file.id}">[DL]</a></td>
        `;
    tableBody.appendChild(row);
  });

  document.querySelectorAll(".dl-link").forEach((link) => {
    link.addEventListener("click", async (e) => {
      e.preventDefault();

      if (!currentUser) {
        showToast("CONNECTE-TOI POUR TELECHARGER !");
        authModal.classList.remove("hidden");
        return;
      }

      // 1. ASTUCE : On ouvre l'onglet TOUT DE SUITE (avant l'attente)
      // On met une page blanche ou un petit message d'attente
      const newTab = window.open("", "_blank");
      newTab.document.write(
        "<h1>Chargement du fichier...</h1><p>Vérification de vos coins...</p>"
      );

      const fileId = e.target.getAttribute("data-id");
      e.target.textContent = "...";

      // 2. On fait la requête à Supabase (pendant ce temps, l'onglet est ouvert)
      const { data, error } = await supabase.rpc("download_file", {
        file_id: fileId,
      });

      if (error || (data && data.error)) {
        // CAS D'ERREUR
        console.error(error || data.error);
        showToast(data?.error || "ERREUR SYSTEME");
        e.target.textContent = "[X]";

        // IMPORTANT : On ferme l'onglet qui ne sert à rien
        newTab.close();
      } else {
        // SUCCÈS
        showToast("TELECHARGEMENT...");
        if (data.remaining !== undefined) {
          document.getElementById("profile-coins").textContent = data.remaining;
        }

        // 3. On redirige l'onglet ouvert vers le fichier PDF
        newTab.location.href = data.url;

        e.target.textContent = "[v]";
      }
    });
  });
}

checkUser();
fetchFiles();
