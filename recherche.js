// ── Sélecteurs ──────────────────────────────────────────────────────────────
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const resultsList = document.getElementById('resultsList');
const searchEmpty = document.getElementById('searchEmpty');

// ── Récupérer les données de l'utilisateur actuel ─────────────────────────
let currentUser = {};

// ── Événement de recherche ───────────────────────────────────────────────
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  
  if (query.length < 2) {
    resultsList.innerHTML = '';
    searchResults.classList.add('hidden');
    searchEmpty.classList.remove('hidden');
    return;
  }

  searchTimeout = setTimeout(() => {
    performSearch(query);
  }, 300);
});

// ── Fonction de recherche ────────────────────────────────────────────────
async function performSearch(query) {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (data.success && data.results.length > 0) {
      displayResults(data.results);
      searchResults.classList.remove('hidden');
      searchEmpty.classList.add('hidden');
    } else {
      resultsList.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 20px;">Aucun résultat trouvé</p>';
      searchResults.classList.remove('hidden');
      searchEmpty.classList.add('hidden');
    }
  } catch (err) {
    console.error('Erreur lors de la recherche:', err);
    resultsList.innerHTML = '<p style="text-align: center; color: var(--error); padding: 20px;">Erreur lors de la recherche</p>';
  }
}

// ── Afficher les résultats ───────────────────────────────────────────────
function displayResults(results) {
  const myFollowing = Array.isArray(currentUser.following) ? currentUser.following : [];
  
  resultsList.innerHTML = results.map(user => {
    let sexeSymbol = '';
    if (user.sexe === 'male') sexeSymbol = '♂️';
    else if (user.sexe === 'femelle') sexeSymbol = '♀️';
    
    const isFollowing = myFollowing.includes(parseInt(user.id));
    const btnClass = isFollowing ? 'user-follow-btn following' : 'user-follow-btn';
    const btnText = isFollowing ? 'Suivi ✓' : 'Suivre';
    
    return `
    <div class="user-card" onclick="viewProfile('${user.id}')">
      <img src="${user.profil_url || 'logo-fonce.png'}" alt="${user.chien_nom}" class="user-avatar" />
      <div class="user-info">
        <p class="user-name">${user.chien_nom}</p>
        <p class="user-username">@${user.username}</p>
        <p class="user-dog">${user.race} ${sexeSymbol} • ${user.prenom} ${user.nom}</p>
      </div>
      <button class="${btnClass}" onclick="followUser(event, '${user.id}')">
        ${btnText}
      </button>
    </div>
  `}).join('');
}

// ── Voir le profil d'un utilisateur ──────────────────────────────────────
function viewProfile(userId) {
  // Récupérer les données de l'utilisateur depuis les résultats affichés
  const userCard = event.currentTarget;
  
  // Extraire les données du user, on doit les stocker pour profil-public.js
  // Pour l'instant, naviguer avec l'ID en paramètre
  window.location.href = `/profil-public?id=${userId}`;
}

// ── Suivre un utilisateur ────────────────────────────────────────────────
async function followUser(event, userId) {
  event.stopPropagation();
  const btn = event.target;
  const myId = currentUser.id;
  btn.disabled = true;

  const isCurrentlyFollowing = btn.classList.contains('following');
  const method = isCurrentlyFollowing ? 'DELETE' : 'POST';

  try {
    const res = await fetch('/api/follow', {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target_id: parseInt(userId)
      })
    });

    const data = await res.json();

    if (data.success) {
      if (data.is_following) {
        btn.classList.add('following');
        btn.textContent = 'Suivi ✓';
        if (!currentUser.following) currentUser.following = [];
        if (!currentUser.following.includes(parseInt(userId))) {
          currentUser.following.push(parseInt(userId));
        }
      } else {
        btn.classList.remove('following');
        btn.textContent = 'Suivre';
        if (Array.isArray(currentUser.following)) {
          currentUser.following = currentUser.following.filter(id => id !== parseInt(userId));
        }
      }
    }
  } catch (err) {
    console.error('Erreur follow/unfollow:', err);
  }

  btn.disabled = false;
}

// ── Initialisation ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Charger l'utilisateur connecté depuis la session
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (!data.success) { window.location.href = '/login.html'; return; }
    currentUser = data.user;
  } catch (err) {
    window.location.href = '/login.html';
  }
});
