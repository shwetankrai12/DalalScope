/**
 * auth.js — DalalScope Supabase Auth Module
 * 3-state modal: login → signup → profile (onboarding step 2)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON = window.SUPABASE_ANON;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, autoRefreshToken: true }
});

// ── Auth State ────────────────────────────────────────────────────────────────

let currentUser = null;
let currentMode = 'login'; // tracks active panel reliably
window._authSubmitting = false; // global in-flight guard — survives module reloads

function updateAuthUI(user) {
    currentUser = user;
    const authBtn = document.getElementById('auth-btn');
    const userDisplay = document.getElementById('user-display');
    const userEmail = document.getElementById('user-email');
    const authGate = document.getElementById('pt-auth-gate');
    const mainContent = document.getElementById('pt-main-content');

    if (user) {
        if (authBtn) { authBtn.textContent = 'Sign Out'; authBtn.onclick = () => window.authSignOut(); }
        if (userDisplay) userDisplay.classList.remove('auth-hidden');
        if (userEmail) userEmail.textContent = user.email || '';
        if (authGate) authGate.style.display = 'none';
        if (mainContent) mainContent.style.display = '';
        // Load full name from profile
        loadUserName();
    } else {
        if (authBtn) { authBtn.textContent = 'Sign In'; authBtn.onclick = () => window.authShowModal(); }
        if (userDisplay) userDisplay.classList.add('auth-hidden');
        if (userEmail) userEmail.textContent = '';
        if (authGate) authGate.style.display = '';
        if (mainContent) mainContent.style.display = 'none';
    }
}

async function loadUserName() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch('/api/profile', {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (!res.ok) return;
        const profile = await res.json();
        const userEmail = document.getElementById('user-email');
        if (userEmail && profile.full_name) {
            userEmail.textContent = profile.full_name;
        }
    } catch { /* silent */ }
}

// ── Authenticated fetch ───────────────────────────────────────────────────────

async function authFetch(url, options = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            ...(options.headers || {})
        }
    });
}

// ── Modal Controls ────────────────────────────────────────────────────────────

export function showAuthModal(mode = 'login') {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    setAuthMode(mode);
    modal.onclick = (e) => { if (e.target === modal) closeAuthModal(); };
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
}

export function setAuthMode(mode) {
    currentMode = mode; // ← FIX: track mode in variable, not DOM

    const panels = {
        login: document.getElementById('auth-panel-login'),
        signup: document.getElementById('auth-panel-signup'),
        profile: document.getElementById('auth-panel-profile'),
    };

    Object.values(panels).forEach(p => { if (p) p.style.display = 'none'; });
    if (panels[mode]) panels[mode].style.display = '';

    // Clear all panel error elements on every mode switch
    ['auth-error', 'signup-error', 'profile-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.style.color = 'var(--red)'; }
    });

    if (mode === 'login') {
        document.getElementById('auth-email') && (document.getElementById('auth-email').value = '');
        document.getElementById('auth-password') && (document.getElementById('auth-password').value = '');
        setTimeout(() => document.getElementById('auth-email')?.focus(), 50);
    } else if (mode === 'signup') {
        document.getElementById('signup-email') && (document.getElementById('signup-email').value = '');
        document.getElementById('signup-password') && (document.getElementById('signup-password').value = '');
        setTimeout(() => document.getElementById('signup-email')?.focus(), 50);
    }

    if (mode === 'profile') {
        ['profile-name', 'profile-phone', 'profile-dob', 'profile-city', 'profile-risk']
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        setTimeout(() => document.getElementById('profile-name')?.focus(), 50);
    }
}

// ── Auth Actions ──────────────────────────────────────────────────────────────

export async function handleAuthSubmit() {
    // ── Guard: bail immediately if a request is already in flight ──────────────
    if (window._authSubmitting) return;
    window._authSubmitting = true;

    const mode = currentMode; // 'login' or 'signup' — always correct

    // Resolve the active panel's fields by panel ID, not global ID,
    // to avoid duplicate-ID ambiguity across panels.
    const panelId = mode === 'login' ? 'auth-panel-login' : 'auth-panel-signup';
    const panel = document.getElementById(panelId);

    const email = panel?.querySelector('input[type="email"]')?.value.trim();
    const password = panel?.querySelector('input[type="password"]')?.value;
    const errEl = panel?.querySelector('.auth-error');

    // Find the active submit button
    const submitBtn = mode === 'login'
        ? document.getElementById('auth-login-btn')
        : document.getElementById('auth-signup-btn');

    if (errEl) { errEl.textContent = ''; errEl.style.color = 'var(--red)'; }

    if (!email || !password) {
        if (errEl) errEl.textContent = 'Email and password are required.';
        window._authSubmitting = false;
        return;
    }
    if (password.length < 6) {
        if (errEl) errEl.textContent = 'Password must be at least 6 characters.';
        window._authSubmitting = false;
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = mode === 'login' ? 'Signing in…' : 'Creating account…';
    }

    try {
        let result;
        if (mode === 'signup') {
            result = await supabase.auth.signUp({ email, password });
        } else {
            result = await supabase.auth.signInWithPassword({ email, password });
        }

        if (result.error) throw result.error;

        if (mode === 'signup') {
            if (result.data?.user && !result.data.session) {
                // Email confirmation required
                if (errEl) {
                    errEl.style.color = 'var(--accent)';
                    errEl.textContent = 'Check your email for a confirmation link!';
                }
                return;
            }
            // Email confirmation OFF → go straight to profile step
            setAuthMode('profile');
        } else {
            closeAuthModal();
        }
    } catch (err) {
        if (errEl) errEl.textContent = err.message || 'Authentication failed.';
    } finally {
        window._authSubmitting = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Create Account';
        }
    }
}

export async function handleProfileSubmit() {
    const errEl = document.getElementById('profile-error');
    if (errEl) { errEl.textContent = ''; errEl.style.color = 'var(--red)'; }

    const full_name = document.getElementById('profile-name')?.value.trim();
    const phone = document.getElementById('profile-phone')?.value.trim() || null;
    const date_of_birth = document.getElementById('profile-dob')?.value || null;
    const city = document.getElementById('profile-city')?.value.trim() || null;
    const risk_appetite = document.getElementById('profile-risk')?.value || null;

    if (!full_name) {
        if (errEl) errEl.textContent = 'Full name is required.';
        return;
    }

    const btn = document.getElementById('auth-profile-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
        const profileData = { full_name };
        if (phone) profileData.phone = phone;
        if (date_of_birth) profileData.date_of_birth = date_of_birth;
        if (city) profileData.city = city;
        if (risk_appetite) profileData.risk_appetite = risk_appetite;

        const res = await authFetch('/api/profile', {
            method: 'PATCH',
            body: JSON.stringify(profileData)
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || 'Could not save profile');
        }

        closeAuthModal();
        if (typeof showToast === 'function') {
            showToast(`Welcome to DalalScope, ${full_name}! 🎉`, 'success');
        }
    } catch (err) {
        if (errEl) errEl.textContent = err.message;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Complete Setup →'; }
    }
}

async function signOut() {
    await supabase.auth.signOut();
    updateAuthUI(null);
    if (typeof showToast === 'function') showToast('Signed out', 'success');
}

// ── Init ──────────────────────────────────────────────────────────────────────

if (!window._authLoaded) {
    window._authLoaded = true;

    supabase.auth.onAuthStateChange((_event, session) => {
        updateAuthUI(session?.user || null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
        updateAuthUI(session?.user || null);
    });

    /**
     * Attach submit listeners exactly once.
     * Uses dataset.bound as a guard and removeEventListener as a fallback.
     */
    function bindAuthListeners() {
        console.log('DalalScope: Binding auth listeners...');
        
        // Login button
        const loginBtn = document.getElementById('auth-login-btn');
        if (loginBtn) {
            loginBtn.removeEventListener('click', handleAuthSubmit);
            loginBtn.addEventListener('click', handleAuthSubmit);
            loginBtn.dataset.bound = 'true';
        }

        // Signup button
        const signupBtn = document.getElementById('auth-signup-btn');
        if (signupBtn) {
            signupBtn.removeEventListener('click', handleAuthSubmit);
            signupBtn.addEventListener('click', handleAuthSubmit);
            signupBtn.dataset.bound = 'true';
        }

        // Enter key on login password field
        const loginPwd = document.getElementById('auth-password');
        if (loginPwd) {
            loginPwd.removeEventListener('keydown', handleLoginEnter);
            loginPwd.addEventListener('keydown', handleLoginEnter);
            loginPwd.dataset.bound = 'true';
        }

        // Enter key on signup password field
        const signupPwd = document.getElementById('signup-password');
        if (signupPwd) {
            signupPwd.removeEventListener('keydown', handleSignupEnter);
            signupPwd.addEventListener('keydown', handleSignupEnter);
            signupPwd.dataset.bound = 'true';
        }
    }

    // Helper functions for named references (required for removeEventListener)
    function handleLoginEnter(e) { if (e.key === 'Enter') handleAuthSubmit(); }
    function handleSignupEnter(e) { if (e.key === 'Enter') handleAuthSubmit(); }

    // Bind as soon as the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindAuthListeners);
    } else {
        bindAuthListeners();
    }

    // ── Global window exports ─────────────────────────────────────────────────────

    window.supabase = supabase;
    window.authShowModal = showAuthModal;
    window.authHideModal = closeAuthModal;
    window.authSetMode = setAuthMode;
    window.authHandleSubmit = handleAuthSubmit;
    window.authProfileSubmit = handleProfileSubmit;
    window.authSignOut = signOut;
    window.authBindListeners = bindAuthListeners;
    window.authGetToken = async function () {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || null;
    };
}