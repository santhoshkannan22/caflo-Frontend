document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const screens = document.querySelectorAll('.screen');

  // Navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetId = item.getAttribute('data-target');
      if (!targetId) return;

      // Update nav state
      document.querySelectorAll('.nav-item[data-target]').forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Update screens
      screens.forEach(s => {
        if (s.id !== 'screen-detail') s.classList.remove('active');
      });
      document.getElementById(`screen-${targetId}`).classList.add('active');
      
      if (targetId === 'saved' && typeof loadSavedCafes === 'function') {
        loadSavedCafes();
      }
    });
  });

  // Filter Modal
  const filterBtn = document.getElementById('open-filter');
  const filterModal = document.getElementById('filter-modal');
  const filterOverlay = filterModal.querySelector('.bottom-sheet-overlay');

  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      filterModal.classList.add('active');
    });
  }

  if (filterOverlay) {
    filterOverlay.addEventListener('click', () => {
      filterModal.classList.remove('active');
    });
  }

  const dragHandle = document.querySelector('.drag-handle');
  if (dragHandle) {
    dragHandle.addEventListener('click', () => {
      filterModal.classList.remove('active');
    });
  }

  const applyFilters = document.getElementById('apply-filters');
  if (applyFilters) {
    applyFilters.addEventListener('click', () => {
      filterModal.classList.remove('active');
    });
  }

  // Filter chips selection toggle
  const filterChips = document.querySelectorAll('#filter-modal .chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
    });
  });

  // Cafe Detail & Save Logic (Event Delegation)
  document.body.addEventListener('click', async (e) => {
    // Save Cafe (Heart Button)
    const heartBtn = e.target.closest('.heart-btn');
    if (heartBtn) {
      e.stopPropagation(); // prevent opening details
      const card = heartBtn.closest('.cafe-card');
      const cafeId = card.getAttribute('data-id');
      if (!cafeId) return;
      
      try {
        const res = await fetch(`${API_BASE_URL}/cafes/save`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ cafeId })
        });
        if(res.ok) {
          heartBtn.classList.toggle('active');
          if (document.getElementById('screen-saved').classList.contains('active')) {
            loadSavedCafes(); // reload saved list if we're on that tab
          }
        }
      } catch (err) { console.error('Error saving cafe', err); }
      return;
    }

    // Open Detail
    const card = e.target.closest('.cafe-card, .map-pin');
    if (card && !heartBtn) {
      const cafeId = card.getAttribute('data-id');
      if (cafeId) {
        await loadCafeDetails(cafeId);
      }
      document.getElementById('screen-detail').classList.add('active');
    }
    
    // Close Detail
    const backBtn = e.target.closest('#back-btn');
    if (backBtn) {
      document.getElementById('screen-detail').classList.remove('active');
    }
  });

  // --- API & Auth Logic ---
  const API_BASE_URL = 'http://localhost:5000/api';
  let authToken = localStorage.getItem('caflo_token');

  // Toggle UI between Login and Register
  let isLoginMode = true;
  const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authToggleText = document.querySelector('.auth-toggle p');

  if (toggleAuthModeBtn) {
    toggleAuthModeBtn.addEventListener('click', () => {
      isLoginMode = !isLoginMode;
      if (isLoginMode) {
        authSubmitBtn.textContent = 'Sign In';
        authToggleText.innerHTML = `Don't have an account? <span id="toggle-auth-mode">Sign Up</span>`;
      } else {
        authSubmitBtn.textContent = 'Create Account';
        authToggleText.innerHTML = `Already have an account? <span id="toggle-auth-mode">Sign In</span>`;
      }

      // Re-attach listener because we overwrote innerHTML
      document.getElementById('toggle-auth-mode').addEventListener('click', toggleAuthModeBtn.click);
    });
  }

  // Handle Auth Submit
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;

      const endpoint = isLoginMode ? '/auth/login' : '/auth/register';
      const payload = { email, password };

      // If registering, backend requires a name default
      if (!isLoginMode) payload.name = email.split('@')[0] || 'User';

      try {
        authSubmitBtn.disabled = true;
        const originalText = authSubmitBtn.textContent;
        authSubmitBtn.textContent = 'Loading...';

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Authentication failed');
        }

        // Success
        authToken = data.token;
        localStorage.setItem('caflo_token', authToken);

        // Transition to home screen
        document.getElementById('screen-auth').classList.remove('active');
        document.getElementById('screen-home').classList.add('active');

        // Show nav
        document.querySelector('.bottom-nav').style.display = 'flex';

      } catch (err) {
        alert(err.message);
      } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = isLoginMode ? 'Sign In' : 'Create Account';
      }
    });
  }

  // Auto-login if token exists (Mock validation)
  if (authToken && document.getElementById('screen-auth')) {
    document.getElementById('screen-auth').classList.remove('active');
    document.getElementById('screen-home').classList.add('active');
    document.querySelector('.bottom-nav').style.display = 'flex';
  } else {
    // Hide nav on auth screen
    const nav = document.querySelector('.bottom-nav');
    if (nav) nav.style.display = 'none';
  }

  // --- Details and Saved API Handlers ---
  
  window.loadCafeDetails = async function(id) {
    try {
      const res = await fetch(`${API_BASE_URL}/cafes/${id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Failed to load cafe details');
      const data = await res.json();
      const cafe = data.cafe || data;
      
      const imgUrl = (cafe.images && cafe.images.length > 0) ? cafe.images[0] : './assets/cafe_interior_modern_1773749047583.png';
      
      const detailScreen = document.getElementById('screen-detail');
      
      // Update DOM
      detailScreen.querySelector('.hero-img').src = imgUrl;
      detailScreen.querySelector('.title-row h2').textContent = cafe.name;
      detailScreen.querySelector('.title-row .distance').textContent = cafe.distance ? `${(cafe.distance / 1609.34).toFixed(1)} mi` : '1.2 mi';
      
      const wifiBox = detailScreen.querySelector('.feature-card .speed')?.parentElement;
      if(wifiBox) wifiBox.querySelector('.speed').textContent = `${cafe.attributes?.wifiSpeed || '100+'} Mbps`;
      
      const scoreNum = detailScreen.querySelector('.big-score .num');
      if(scoreNum) scoreNum.textContent = cafe.workScore ? cafe.workScore.toFixed(1) : '8.5';
      
    } catch (err) {
      console.error(err);
    }
  }

  window.loadSavedCafes = async function() {
    const container = document.querySelector('#screen-saved .feed-section');
    if (!container) return;
    
    // Clear out existing cards, keep header
    Array.from(container.children).forEach(child => {
      if (child.classList.contains('cafe-card') || child.classList.contains('empty-state')) child.remove();
    });
    
    try {
      const res = await fetch(`${API_BASE_URL}/cafes/saved`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Failed to load saved cafes');
      const data = await res.json();
      const cafes = data.savedCafes || data;
      
      if (cafes.length === 0) {
        container.insertAdjacentHTML('afterbegin', `<div class="empty-state" style="padding-top: 60px; text-align: center; color: var(--text-light);"><ion-icon name="bookmark-outline" style="font-size: 64px; color: #D4CDC6;"></ion-icon><h3>No saved cafes</h3><p>Tap the heart icon to save.</p></div>`);
        return;
      }
      
      cafes.forEach(cafe => {
        const imgUrl = (cafe.images && cafe.images.length > 0) ? cafe.images[0] : './assets/cafe_interior_modern_1773749047583.png';
        const cardHTML = `
          <div class="cafe-card card" data-id="${cafe._id || cafe.id}">
            <div class="card-image-wrapper">
              <img src="${imgUrl}" alt="${cafe.name}">
              <div class="badge glass score-badge">${cafe.workScore ? cafe.workScore.toFixed(1) : '8.5'} Work Score</div>
              <button class="heart-btn glass active"><ion-icon name="heart"></ion-icon></button>
            </div>
            <div class="card-content">
              <div class="card-title-row">
                <h3>${cafe.name}</h3>
                <p class="distance">~ mi</p>
              </div>
            </div>
          </div>
        `;
        container.insertAdjacentHTML('afterbegin', cardHTML);
      });
    } catch (err) {
      console.error(err);
    }
  }

});
