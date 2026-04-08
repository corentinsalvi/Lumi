// ── Utilisateur connecté ────────────────────────────────────────────────────
let currentUser = {};

async function initFeed() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (!data.success) { window.location.href = '/login.html'; return; }
    currentUser = data.user;
  } catch (err) {
    window.location.href = '/login.html';
    return;
  }
  loadFeed();
}

// ── Formatage du temps relatif ──────────────────────────────────────────────
function timeAgo(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'À l\'instant';
  if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `Il y a ${Math.floor(seconds / 86400)}j`;

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ── Charger et afficher le feed ─────────────────────────────────────────────
async function loadFeed() {
  const container = document.getElementById('feedContainer');
  const loader = document.getElementById('feedLoader');

  try {
    const res = await fetch('/api/posts');
    const data = await res.json();

    loader.remove();

    if (!data.success || !data.posts.length) {
      container.innerHTML = `
        <div class="feed-empty">
          <i class="fa-solid fa-camera"></i>
          <p>Aucun post pour le moment</p>
          <a href="/nouveau-post">Publier la première photo 🐾</a>
        </div>
      `;
      return;
    }

    // Les posts sont déjà triés par le serveur (plus récent en premier)
    container.innerHTML = data.posts.map(post => renderPostCard(post)).join('');

  } catch (err) {
    console.error('Erreur chargement feed:', err);
    loader.innerHTML = '<p>Erreur de chargement</p>';
  }
}

// ── Rendu d'une carte post ──────────────────────────────────────────────────
function renderPostCard(post) {
  const isOwner = post.user_id === currentUser.id;
  const displayName = post.chien_nom || post.username || 'Inconnu';
  const likedBy = post.liked_by || [];
  const isLiked = likedBy.includes(currentUser.id);
  const likeCount = post.likes || 0;

  return `
    <div class="post-card" data-post-id="${post.post_id}">
      <!-- Header -->
      <div class="post-card-header">
        <img src="${post.profil_url || 'logo-fonce.png'}" alt="${displayName}" class="post-card-avatar" />
        <div class="post-card-user">
          <p class="post-card-username">${displayName}</p>
          ${post.location ? `<p class="post-card-location"><i class="fa-solid fa-location-dot"></i>${post.location}</p>` : ''}
        </div>
        ${isOwner ? `<button class="post-card-menu" title="Mon post"><i class="fa-solid fa-ellipsis"></i></button>` : ''}
      </div>

      <!-- Image -->
      ${post.image_url ? `
      <div class="post-card-image-wrapper">
        <img src="${post.image_url}" alt="Post" class="post-card-image" loading="lazy" />
        <i class="fa-solid fa-heart double-tap-heart"></i>
      </div>` : ''}

      <!-- Actions -->
      <div class="post-card-actions">
        <button class="post-action-btn${isLiked ? ' liked' : ''}" onclick="toggleLike(this, '${post.post_id}')">
          <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
        </button>
        <button class="post-action-btn">
          <i class="fa-regular fa-comment"></i>
        </button>
        <button class="post-action-btn">
          <i class="fa-regular fa-paper-plane"></i>
        </button>
      </div>

      <!-- Likes -->
      <div class="post-card-likes" onclick="showLikers('${post.post_id}')" style="cursor:pointer">${likeCount} J'aime</div>

      <!-- Caption -->
      ${post.caption ? `
        <div class="post-card-caption">
          <strong>${displayName}</strong>${post.caption}
        </div>
      ` : ''}

      <!-- Timestamp -->
      <div class="post-card-time">${timeAgo(post.timestamp)}</div>
    </div>
  `;
}

// ── Like / Unlike ───────────────────────────────────────────────────────────
const _likeLocks = new Set();
async function toggleLike(btn, postId) {
  if (_likeLocks.has(postId)) return;
  _likeLocks.add(postId);
  try {
    const res = await fetch(`/api/posts/${postId}/like`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id })
    });
    const data = await res.json();

    if (data.success) {
      const icon = btn.querySelector('i');
      const card = btn.closest('.post-card');
      const likesDiv = card.querySelector('.post-card-likes');

      if (data.liked) {
        btn.classList.add('liked');
        icon.className = 'fa-solid fa-heart';
      } else {
        btn.classList.remove('liked');
        icon.className = 'fa-regular fa-heart';
      }

      likesDiv.textContent = `${data.likes} J'aime`;
    }
  } catch (err) {
    console.error('Erreur like:', err);
  } finally {
    _likeLocks.delete(postId);
  }
}

// ── Voir qui a liké ───────────────────────────────────────────────────────
async function showLikers(postId) {
  const overlay = document.getElementById('likersOverlay');
  const list = document.getElementById('likersList');
  list.innerHTML = '<div class="likers-empty"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  overlay.classList.add('open');

  try {
    const res = await fetch(`/api/posts/${postId}/likers`);
    const data = await res.json();

    if (!data.success || !data.likers.length) {
      list.innerHTML = '<div class="likers-empty">Aucun J\'aime pour le moment</div>';
      return;
    }

    list.innerHTML = data.likers.map(u => `
      <div class="liker-item" onclick="window.location.href='/profil-public?id=${u.id}'">
        <img src="${u.profil_url || 'logo-fonce.png'}" alt="${u.chien_nom}" class="liker-avatar" />
        <span class="liker-name">${u.chien_nom}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('Erreur likers:', err);
    list.innerHTML = '<div class="likers-empty">Erreur de chargement</div>';
  }
}

function closeLikersModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('likersOverlay').classList.remove('open');
}

// ── Supprimer un post ───────────────────────────────────────────────────────
async function deletePost(postId) {
  if (!confirm('Supprimer ce post ?')) return;

  try {
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      const card = document.querySelector(`[data-post-id="${postId}"]`);
      if (card) card.remove();
    }
  } catch (err) {
    console.error('Erreur suppression:', err);
  }
}

// ── Double-tap to like ──────────────────────────────────────────────────────
(function() {
  function handleDoubleTapLike(e) {
    // Ignorer si on clique sur un bouton, un lien ou un élément interactif
    if (e.target.closest('button, a, .post-card-actions, .post-card-likes')) return;

    const card = e.target.closest('.post-card');
    if (!card) return;

    const postId = card.dataset.postId;
    const likeBtn = card.querySelector('.post-action-btn');
    if (!likeBtn || !postId) return;

    // Trigger like/unlike
    toggleLike(likeBtn, postId);

    // Heart animation on the image wrapper (if present)
    const wrapper = card.querySelector('.post-card-image-wrapper');
    if (wrapper) {
      const heart = wrapper.querySelector('.double-tap-heart');
      heart.classList.remove('animate');
      void heart.offsetWidth; // force reflow
      heart.classList.add('animate');
    }
  }

  // Mobile: double-tap via touchend
  let lastTap = 0;
  let lastTapTarget = null;
  document.addEventListener('touchend', function(e) {
    const card = e.target.closest('.post-card');
    if (!card) { lastTap = 0; return; }

    const now = Date.now();
    if (now - lastTap < 300 && lastTapTarget === card) {
      e.preventDefault();
      handleDoubleTapLike(e);
      lastTap = 0;
      lastTapTarget = null;
    } else {
      lastTap = now;
      lastTapTarget = card;
    }
  });

  // Desktop: double-click
  document.addEventListener('dblclick', function(e) {
    handleDoubleTapLike(e);
  });
})();

// ── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initFeed);
