/* spotify.js
 * PKCE helper functions and minimal Spotify API wrappers.
 *
 * IMPORTANT:
 * - Register an app on Spotify dashboard, set REDIRECT_URI to your music.html URL.
 * - Put your CLIENT_ID below and set REDIRECT_URI exactly to match.
 * - This implementation stores tokens in sessionStorage. For production, use a secure backend.
 */

const CLIENT_ID = "YOUR_SPOTIFY_CLIENT_ID"; // <<-- PUT YOUR CLIENT ID
const REDIRECT_URI = window.location.origin + "/music.html"; // adjust if needed
const SCOPES = [
  "user-read-private",
  "playlist-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-modify-playback-state"
].join(" ");

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest("SHA-256", data);
}

async function generatePKCECodes() {
  const verifier = base64UrlEncode(window.crypto.getRandomValues(new Uint8Array(64)));
  const hashed = await sha256(verifier);
  const challenge = base64UrlEncode(new Uint8Array(hashed));
  return { verifier, challenge };
}

function saveToken(data) {
  sessionStorage.setItem("sp_token", JSON.stringify(data));
}

function getToken() {
  const raw = sessionStorage.getItem("sp_token");
  return raw ? JSON.parse(raw) : null;
}

async function redirectToSpotify() {
  const { verifier, challenge } = await generatePKCECodes();
  sessionStorage.setItem("pkce_verifier", verifier);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge
  });
  const url = `https://accounts.spotify.com/authorize?${params.toString()}`;
  window.location.href = url;
}

async function fetchToken(code) {
  // We must exchange code for token. Spotify requires client secret for standard Authorization Code,
  // but with PKCE client secret is not required in exchange; still this endpoint expects a POST to /api/token.
  // For front-end only, Spotify allows PKCE if you include client_id. Use fetch to token endpoint.
  const verifier = sessionStorage.getItem("pkce_verifier");
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code: code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Token exchange failed: " + err);
  }
  const data = await res.json();
  saveToken({ ...data, obtained_at: Date.now() });
  return data;
}

async function refreshToken() {
  const token = getToken();
  if (!token?.refresh_token) throw new Error("No refresh token");
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  const data = await res.json();
  const merged = { ...token, ...data, obtained_at: Date.now() };
  saveToken(merged);
  return merged;
}

async function ensureTokenValid() {
  const token = getToken();
  if (!token) return null;
  const now = Date.now();
  const expiresIn = (token.expires_in || 3600) * 1000;
  if (now - token.obtained_at > expiresIn - 60000) {
    // refresh
    try {
      return await refreshToken();
    } catch (e) {
      console.warn("refresh failed", e);
      return null;
    }
  }
  return token;
}

async function apiFetch(path, opts = {}) {
  const token = await ensureTokenValid();
  if (!token) throw new Error("Not authenticated");
  const headers = Object.assign({}, opts.headers || {}, { "Authorization": `Bearer ${token.access_token}` });
  const res = await fetch(`https://api.spotify.com/v1${path}`, Object.assign({}, opts, { headers }));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  return await res.json();
}

/* UI wiring for music.html */
document.addEventListener("DOMContentLoaded", async () => {
  const btnLogin = document.getElementById("btnLogin");
  const userInfo = document.getElementById("userInfo");
  const playlistsSection = document.getElementById("playlistsSection");
  const playlistsList = document.getElementById("playlistsList");
  const tracksSection = document.getElementById("tracksSection");
  const tracksList = document.getElementById("tracksList");
  const tracksHeader = document.getElementById("tracksHeader");

  // If redirected back with code
  const params = new URLSearchParams(window.location.search);
  if (params.get("code")) {
    const code = params.get("code");
    try {
      await fetchToken(code);
      params.delete("code");
      history.replaceState(null, "", window.location.pathname);
    } catch (e) {
      console.error(e);
      alert("Spotify authentication failed. Check console.");
    }
  }

  const token = getToken();
  if (token) {
    btnLogin.textContent = "Connected ✓";
    btnLogin.disabled = true;
    try {
      const profile = await apiFetch("/me");
      userInfo.classList.remove("hidden");
      userInfo.innerHTML = `<img src="${profile.images?.[0]?.url || 'assets/images/photo1.jpg'}" class="avatar" /> <div><strong>${profile.display_name || profile.id}</strong></div>`;
      playlistsSection.classList.remove("hidden");
      // fetch playlists
      const pls = await apiFetch("/me/playlists?limit=50");
      playlistsList.innerHTML = "";
      pls.items.forEach(pl => {
        const el = document.createElement("div");
        el.className = "pl-card";
        el.innerHTML = `
          <img src="${pl.images?.[0]?.url || 'assets/images/photo1.jpg'}" alt="${pl.name}" />
          <div class="pl-info">
            <h4>${pl.name}</h4>
            <p>${pl.tracks.total} tracks</p>
          </div>
        `;
        el.addEventListener("click", async () => {
          try {
            const tracks = await apiFetch(`/playlists/${pl.id}/tracks?limit=100`);
            tracksSection.classList.remove("hidden");
            tracksHeader.textContent = pl.name;
            tracksList.innerHTML = "";
            tracks.items.forEach(item => {
              const t = item.track;
              const tEl = document.createElement("div");
              tEl.className = "track";
              tEl.innerHTML = `
                <div class="track-thumb"><img src="${t.album.images?.[2]?.url || ''}" alt=""></div>
                <div class="track-meta">
                  <strong>${t.name}</strong>
                  <small>${t.artists.map(a=>a.name).join(", ")}</small>
                </div>
                <button class="btn-play" data-preview="${t.preview_url}">▶</button>
              `;
              const playBtn = tEl.querySelector(".btn-play");
              playBtn.addEventListener("click", () => {
                const prev = playBtn.dataset.preview;
                if (!prev) {
                  alert("No preview available for this track.");
                  return;
                }
                // Simple preview playback
                let audio = document.getElementById("previewAudio");
                if (!audio) {
                  audio = document.createElement("audio");
                  audio.id = "previewAudio";
                  document.body.appendChild(audio);
                }
                if (audio.src === prev) {
                  if (audio.paused) audio.play(); else audio.pause();
                } else {
                  audio.src = prev;
                  audio.play();
                }
              });
              tracksList.appendChild(tEl);
            });
          } catch (err) {
            console.error(err);
            alert("Failed to load playlist tracks.");
          }
        });
        playlistsList.appendChild(el);
      });
    } catch (err) {
      console.error(err);
    }
  } else {
    btnLogin.addEventListener("click", () => redirectToSpotify());
  }
});
