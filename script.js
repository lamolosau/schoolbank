// --- INIT SUPABASE ---
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ELEMENTS ---
const fileInput = document.getElementById("file-upload-input");
const tableBody = document.querySelector(".pixel-table tbody");
const searchButton = document.getElementById("search-btn");

// Elements Modale
const modal = document.getElementById("upload-modal");
const modalFilename = document.getElementById("modal-filename");
const cancelBtn = document.getElementById("cancel-btn");
const confirmBtn = document.getElementById("confirm-upload-btn");

let selectedFile = null;

// --- 1. OUVERTURE MODALE ---
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    modalFilename.textContent = selectedFile.name;
    modal.classList.remove("hidden");
  }
});

// --- 2. FERMETURE MODALE ---
cancelBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
  fileInput.value = "";
  selectedFile = null;
});

// --- 3. UPLOAD ET ENVOI ---
confirmBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  const info = {
    etab: document.getElementById("input-etab").value,
    formation: document.getElementById("input-formation").value,
    subject: document.getElementById("input-subject").value,
    prof:
      document.getElementById("input-prof").value.toUpperCase() || "INCONNU",
    type: document.getElementById("input-type").value,
    year: document.getElementById("input-year").value,
  };

  confirmBtn.textContent = "ENVOI...";

  try {
    // A. Upload Fichier
    const cleanName =
      Date.now() + "_" + selectedFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const { error: storageError } = await supabase.storage
      .from("pdfs")
      .upload(cleanName, selectedFile);

    if (storageError) throw storageError;

    // B. URL Publique
    const { data: urlData } = supabase.storage
      .from("pdfs")
      .getPublicUrl(cleanName);

    // C. Base de données
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

    alert("UPLOAD SUCCESS !");
    modal.classList.add("hidden");
    fileInput.value = "";
    confirmBtn.textContent = "ENVOYER";
    fetchFiles();
  } catch (error) {
    console.error(error);
    alert("ERREUR: " + error.message);
    confirmBtn.textContent = "ENVOYER";
  }
});

// --- 4. RECUPERER FICHIERS (AVEC FILTRES) ---
async function fetchFiles() {
  // 1. On récupère les valeurs des filtres
  const filterEtab = document.getElementById("filter-etab").value;
  const filterFormation = document.getElementById("filter-formation").value;
  const filterSubject = document.getElementById("filter-subject").value;
  const filterProf = document.getElementById("filter-prof").value;
  const filterType = document.getElementById("filter-type").value;
  const filterYear = document.getElementById("filter-year").value;

  // 2. On commence à construire la requête
  let query = supabase
    .from("files")
    .select("*")
    .order("created_at", { ascending: false });

  // 3. On applique les filtres SI une valeur est choisie
  if (filterEtab) query = query.eq("etablissement", filterEtab);
  if (filterFormation) query = query.eq("formation", filterFormation);
  if (filterSubject) query = query.eq("subject", filterSubject);
  if (filterType) query = query.eq("type", filterType);
  if (filterYear) query = query.eq("year", filterYear);

  if (filterProf) query = query.ilike("prof", `%${filterProf}%`);

  // 4. On lance la requête
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

// --- GESTION DU BOUTON CHERCHER ---
searchButton.addEventListener("click", () => {
  searchButton.textContent = "CHARGEMENT...";

  fetchFiles().then(() => {
    searchButton.textContent = "CHERCHER";
  });
});

// --- 5. AFFICHER TABLEAU ---
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

fetchFiles();
