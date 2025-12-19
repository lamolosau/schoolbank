var supabase;
if (window.supabase && window.supabase.createClient) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.error("Erreur: Supabase non chargé");
}

const fileInput = document.getElementById("file-upload-input");
const tableBody = document.querySelector(".pixel-table tbody");
const searchButton = document.getElementById("search-btn");
const uploadTriggerBtn = document.getElementById("upload-trigger-btn");
const modalUpload = document.getElementById("upload-modal");
const modalFilename = document.getElementById("modal-filename");
const cancelUploadBtn = document.getElementById("cancel-btn");
const confirmUploadBtn = document.getElementById("confirm-upload-btn");
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
const toastElement = document.getElementById("pixel-toast");
const profileEmail = document.getElementById("profile-email");
const profileCoins = document.getElementById("profile-coins");
const profileStatus = document.getElementById("profile-status");

let selectedFile = null;
let currentUser = null;
let isLoginMode = true;
let userIsPremium = false;
let currentPurchaseFileId = null;

function showToast(message) {
  toastElement.textContent = message;
  toastElement.className = "show";
  setTimeout(() => {
    toastElement.className = toastElement.className.replace("show", "");
  }, 3000);
}

async function checkUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentUser = session?.user || null;

  if (currentUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("coins, is_premium")
      .eq("id", currentUser.id)
      .single();

    if (profile) {
      currentUser.profileData = profile;
      userIsPremium = profile.is_premium;
      refreshProfileUI(profile);
    }

    const { data: purchases } = await supabase
      .from("purchases")
      .select("file_id")
      .eq("user_id", currentUser.id);

    currentUser.owned_files = purchases ? purchases.map((p) => p.file_id) : [];
    setupRealtimeListener();
  } else {
    userIsPremium = false;
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

    if (isPremium) {
      if (upgradeBtn) upgradeBtn.style.display = "none";
      if (manageBtn) {
        manageBtn.style.display = "inline-block";
        manageBtn.textContent = "GÉRER ABO";
        manageBtn.onclick = async (e) => {
          e.preventDefault();
          manageBtn.textContent = "CHARGEMENT...";
          const { data, error } = await supabase.functions.invoke(
            "create-portal-link"
          );
          if (error || !data?.url) {
            manageBtn.textContent = "ERREUR";
            showToast("ERREUR PORTAIL");
          } else {
            window.open(data.url, "_blank");
            manageBtn.textContent = "GÉRER ABO";
          }
        };
      }
    } else {
      if (manageBtn) manageBtn.style.display = "none";
      if (upgradeBtn) {
        upgradeBtn.style.display = "inline-block";
        const baseStripeUrl =
          "https://buy.stripe.com/test_dRmaEXgQueNd2gocPk7Zu00"; // REMPLACE PAR TON URL LIVE ICI SI NECESSAIRE
        upgradeBtn.href = `${baseStripeUrl}?prefilled_email=${encodeURIComponent(
          currentUser.email
        )}&client_reference_id=${currentUser.id}`;
      }
    }
  }
  profileModal.classList.remove("hidden");
});

closeProfileBtn.addEventListener("click", () => {
  profileModal.classList.add("hidden");
});
authCancelBtn.addEventListener("click", () => {
  authModal.classList.add("hidden");
});

logoutBtn.addEventListener("click", async () => {
  profileModal.classList.add("hidden");
  await supabase.auth.signOut();
  currentUser = null;
  userIsPremium = false;
  updateAuthUI();
  fetchFiles();
  showToast("DECONNECTE.");
});

toggleAuthModeLink.addEventListener("click", (e) => {
  e.preventDefault();
  isLoginMode = !isLoginMode;
  authTitle.textContent = isLoginMode ? "> CONNEXION_" : "> INSCRIPTION_";
  toggleAuthModeLink.textContent = isLoginMode
    ? "Pas de compte ? S'inscrire"
    : "Déjà un compte ? Se connecter";
  authSubmitBtn.textContent = isLoginMode ? "GO" : "CREER";
});

authSubmitBtn.addEventListener("click", async () => {
  const email = authEmailInput.value;
  const password = authPassInput.value;
  if (!email || !password) return showToast("REMPLIR TOUS LES CHAMPS !");
  authSubmitBtn.textContent = "...";

  try {
    const { error } = isLoginMode
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) throw error;

    showToast(
      isLoginMode ? "CONNEXION REUSSIE !" : "COMPTE CREE ! VERIFIE TES EMAILS."
    );
    authModal.classList.add("hidden");
    await checkUser();
    fetchFiles();
  } catch (error) {
    showToast("ERREUR: " + error.message);
  } finally {
    authSubmitBtn.textContent = isLoginMode ? "GO" : "CREER";
  }
});

async function calculateFileHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

  confirmUploadBtn.textContent = "VERIFICATION...";
  try {
    const fileHash = await calculateFileHash(selectedFile);
    const { data: existingFile } = await supabase
      .from("files")
      .select("id")
      .eq("file_hash", fileHash)
      .maybeSingle();

    if (existingFile) {
      showToast("❌ FICHIER DÉJÀ PRÉSENT !");
      confirmUploadBtn.textContent = "ENVOYER";
      return;
    }

    confirmUploadBtn.textContent = "ENVOI...";
    const cleanName =
      Date.now() + "_" + selectedFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const { error: storageError } = await supabase.storage
      .from("pdfs")
      .upload(cleanName, selectedFile);
    if (storageError) throw storageError;

    const { data: urlData } = supabase.storage
      .from("pdfs")
      .getPublicUrl(cleanName);
    confirmUploadBtn.textContent = "ANALYSE IA...";
    showToast("L'IA VÉRIFIE VOTRE FICHIER...");

    const { data: analysis, error: aiError } = await supabase.functions.invoke(
      "analyze-document",
      {
        body: { fileUrl: urlData.publicUrl, userInputs: info },
      }
    );

    if (aiError || !analysis.valid) {
      await supabase.storage.from("pdfs").remove([cleanName]);
      showToast(aiError ? "ERREUR IA" : `❌ REFUSÉ : ${analysis.reason}`);
      confirmUploadBtn.textContent = "ENVOYER";
      return;
    }

    const { error: dbError } = await supabase.from("files").insert([
      {
        name: selectedFile.name,
        user_id: currentUser.id,
        file_url: urlData.publicUrl,
        file_hash: fileHash,
        etablissement: info.etab,
        formation: info.formation,
        subject: info.subject,
        prof: info.prof,
        type: info.type,
        year: info.year,
        status: "approved",
      },
    ]);

    if (dbError) throw dbError;

    showToast("✅ FICHIER VALIDÉ ET PUBLIÉ !");
    modalUpload.classList.add("hidden");
    fileInput.value = "";
    confirmUploadBtn.textContent = "ENVOYER";

    // Reset Filters
    ["etab", "formation", "subject", "type", "year", "prof"].forEach(
      (id) => (document.getElementById(`filter-${id}`).value = "")
    );

    await checkUser();
    await fetchFiles();
  } catch (error) {
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

async function fetchFiles() {
  const getVal = (id) => document.getElementById(id).value;
  let query = supabase
    .from("files")
    .select("id, name, etablissement, formation, subject, prof, type, year")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (getVal("filter-etab"))
    query = query.eq("etablissement", getVal("filter-etab"));
  if (getVal("filter-formation"))
    query = query.eq("formation", getVal("filter-formation"));
  if (getVal("filter-subject"))
    query = query.eq("subject", getVal("filter-subject"));
  if (getVal("filter-type")) query = query.eq("type", getVal("filter-type"));
  if (getVal("filter-year")) query = query.eq("year", getVal("filter-year"));
  if (getVal("filter-prof"))
    query = query.ilike("prof", `%${getVal("filter-prof")}%`);

  const { data, error } = await query;
  if (error || !data) {
    tableBody.innerHTML = '<tr><td colspan="6">ERREUR CHARGEMENT...</td></tr>';
  } else if (data.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="6">AUCUN FICHIER TROUVE...</td></tr>';
  } else {
    renderTable(data);
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
  if (!profileModal.classList.contains("hidden")) {
    profileCoins.textContent = newProfileData.coins;
    const isPremium = newProfileData.is_premium;
    profileStatus.textContent = isPremium ? "PREMIUM" : "FREEMIUM";
    profileStatus.style.color = isPremium ? "#00aa00" : "inherit";

    const upgradeBtn = document.getElementById("upgrade-btn");
    const manageBtn = document.getElementById("manage-sub-btn");
    if (upgradeBtn)
      upgradeBtn.style.display = isPremium ? "none" : "inline-block";
    if (manageBtn)
      manageBtn.style.display = isPremium ? "inline-block" : "none";
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
        currentUser.profileData = payload.new;
        userIsPremium = payload.new.is_premium;
        refreshProfileUI(payload.new);
        fetchFiles();
        showToast("DONNÉES MISES À JOUR !");
      }
    )
    .subscribe();
}

function renderTable(files) {
  tableBody.innerHTML = "";
  files.forEach((file) => {
    const row = document.createElement("tr");

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

    const dlCell = document.createElement("td");
    const link = document.createElement("a");
    link.href = "#";
    link.className = "dl-link";

    if (userIsPremium) {
      link.textContent = "[ACCÈS PREMIUM ⭐]";
      link.classList.add("owned");
      link.style.color = "#d4af37";
      link.style.fontWeight = "bold";
    } else if (currentUser?.owned_files?.includes(file.id)) {
      link.textContent = "[ACCÉDER]";
      link.classList.add("owned");
      link.style.color = "#008800";
    } else {
      link.textContent = "[ACHETER - 50c]";
    }

    link.addEventListener("click", (e) => handleDownloadClick(e, file.id));
    dlCell.appendChild(link);
    row.appendChild(dlCell);

    const reportCell = document.createElement("td");
    const reportBtn = document.createElement("button");
    reportBtn.className = "report-btn";
    reportBtn.textContent = "!";
    reportBtn.title = "Signaler ce fichier";

    reportBtn.onclick = () => openReportModal(file.id);

    reportCell.appendChild(reportBtn);
    row.appendChild(reportCell);

    tableBody.appendChild(row);
  });
}

async function handleDownloadClick(e, fileId) {
  e.preventDefault();
  if (!currentUser) {
    showToast("CONNECTE-TOI POUR ACCÉDER !");
    authModal.classList.remove("hidden");
    return;
  }

  if (userIsPremium || currentUser.owned_files.includes(fileId)) {
    await executeDownload(fileId, e.target);
  } else {
    currentPurchaseFileId = fileId;
    window.lastClickedLink = e.target;
    document.getElementById("purchase-modal").classList.remove("hidden");
  }
}

async function executeDownload(fileId, linkElement) {
  const originalText = linkElement.textContent;
  linkElement.textContent = "...";
  const cleanId = parseInt(fileId, 10);

  const { data, error } = await supabase.rpc("download_file", {
    p_file_id: cleanId,
  });

  if (error || (data && data.error)) {
    showToast(data?.error || "ERREUR");
    linkElement.textContent = originalText;
  } else {
    showToast("OUVERTURE...");
    if (data.remaining !== undefined) {
      document.getElementById("profile-coins").textContent = data.remaining;
    }
    window.open(data.url, "_blank");
    if (currentUser && !currentUser.owned_files.includes(cleanId)) {
      currentUser.owned_files.push(cleanId);
    }

    if (userIsPremium) {
      linkElement.textContent = "[ACCÈS PREMIUM ⭐]";
    } else {
      linkElement.textContent = "[ACCÉDER]";
      linkElement.classList.add("owned");
      linkElement.style.color = "#008800";
    }
  }
}

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

// ==========================================
// --- GESTION DES SIGNALEMENTS (REPORT) ---
// ==========================================

let currentReportFileId = null;
const reportModal = document.getElementById("report-modal");
const reportDetailsInput = document.getElementById("report-details");
const reportReasonSelect = document.getElementById("report-reason-select");

function openReportModal(fileId) {
  if (!currentUser) {
    showToast("CONNECTE-TOI POUR SIGNALER !");
    authModal.classList.remove("hidden");
    return;
  }
  currentReportFileId = fileId;
  reportDetailsInput.value = ""; // Vider le champ texte
  reportModal.classList.remove("hidden");
}

document.getElementById("cancel-report-btn").addEventListener("click", () => {
  reportModal.classList.add("hidden");
  currentReportFileId = null;
});

document
  .getElementById("confirm-report-btn")
  .addEventListener("click", async () => {
    if (!currentReportFileId || !currentUser) return;

    const reason = reportReasonSelect.value;
    const details = reportDetailsInput.value.trim();

    // On combine le menu déroulant et le texte libre
    const fullReason = `${reason} - ${details}`;

    const btn = document.getElementById("confirm-report-btn");
    btn.textContent = "...";

    try {
      const { error } = await supabase.from("reports").insert([
        {
          file_id: currentReportFileId,
          user_id: currentUser.id,
          reason: fullReason,
        },
      ]);

      if (error) throw error;

      showToast("SIGNALEMENT ENVOYÉ. MERCI !");
      reportModal.classList.add("hidden");
    } catch (error) {
      console.error("Erreur Report:", error);
      showToast("ERREUR LORS DE L'ENVOI");
    } finally {
      btn.textContent = "SIGNALER";
    }
  });
