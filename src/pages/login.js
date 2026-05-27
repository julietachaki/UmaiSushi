import { waitForSupabase, getCurrentSession, signIn, signOut } from '../../services/auth.service.js'

const loadingState = document.getElementById('loading-state');
const loginForm = document.getElementById('login-form');
const loggedState = document.getElementById('logged-state');
const loggedEmail = document.getElementById('logged-email');
const submitBtn = document.getElementById('submit-btn');
const errorMsg = document.getElementById('error-msg');
const logoutBtn = document.getElementById('logout-btn');

function showLoading() {
    loadingState.style.display = 'block';
    loginForm.style.display = 'none';
    loggedState.style.display = 'none';
}
function showLoginForm() {
    loadingState.style.display = 'none';
    loginForm.style.display = 'block';
    loggedState.style.display = 'none';
}
function showLogged(email) {
    loadingState.style.display = 'none';
    loginForm.style.display = 'none';
    loggedState.style.display = 'block';
    loggedEmail.textContent = email;
}
function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
}
function clearError() {
    errorMsg.style.display = 'none';
}

function getRedirectTarget() {
    const params = new URLSearchParams(location.search);
    const r = params.get('redirect');
    if (r && r.startsWith('/') && !r.startsWith('//')) return r;
    return '/dashboard/index.html';
}

async function checkSession() {
    const ok = await waitForSupabase();
    if (!ok) {
        showLoginForm();
        showError('Error conectando con el servidor.');
        return;
    }
    const session = await getCurrentSession();
    if (session) {
        location.replace(getRedirectTarget());
        return;
    }
    showLoginForm();
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !password) {
        showError('Email y contraseña son obligatorios.');
        return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Ingresando…';

    const { user, error } = await signIn(email, password);

    if (error) {
        const msg = error.message || 'Error desconocido';
        showError(msg.includes('Invalid') ? 'Email o contraseña incorrectos.' : msg);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Ingresar';
        return;
    }
    location.replace(getRedirectTarget());
});

logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    logoutBtn.textContent = 'Cerrando…';
    await signOut();
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Ingresar';
    logoutBtn.disabled = false;
    logoutBtn.textContent = 'Cerrar sesión';
    showLoginForm();
});

checkSession();
