/* ================= SHARED UTILITIES — Yogesh Shukla Wealth Advisory ================= */
/* Requires assets/config.js (API_BASE_URL) to be loaded first. */

const SESSION_KEY = "lic_session_v1";       // { contact, channel, token }
const ADMIN_TOKEN_KEY = "lic_admin_token_v1";

/* ---------- Toasts (replaces all native alert/confirm) ---------- */
function ensureToastStack(){
  let stack = document.getElementById('toastStack');
  if(!stack){
    stack = document.createElement('div');
    stack.id = 'toastStack';
    document.body.appendChild(stack);
  }
  return stack;
}
function toast(type, title, msg, extra){
  const stack = ensureToastStack();
  const el = document.createElement('div');
  el.className = 'toast glass toast-' + type;
  el.innerHTML = `<div class="dot"></div><div><b>${title}</b><div class="msg">${msg}</div>${extra ? `<div style="font-family:var(--mono);color:var(--gold-bright);font-size:18px;letter-spacing:5px;margin-top:6px;">${extra}</div>` : ''}</div>`;
  stack.appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=> el.remove(), 380); }, extra ? 9000 : 4200);
}

/* ---------- Custom confirm (replaces native confirm()) ---------- */
function showConfirm(title, msg, onYes){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box glass">
      <h3>${title}</h3>
      <p class="sub">${msg}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="confirmNo">Cancel</button>
        <button class="btn btn-primary" style="background:linear-gradient(135deg,#c1594a,#e0776a);" id="confirmYes">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#confirmNo').onclick = ()=> overlay.remove();
  overlay.querySelector('#confirmYes').onclick = ()=>{ overlay.remove(); onYes(); };
}

/* ---------- API helper ---------- */
async function apiFetch(path, options = {}){
  let res;
  try{
    res = await fetch(API_BASE_URL + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  }catch(networkErr){
    toast('error', 'Connection Problem', 'Could not reach the advisory server. Please check your connection and try again.');
    throw networkErr;
  }
  let data = null;
  try{ data = await res.json(); }catch(e){ /* non-JSON response, e.g. CSV */ }
  if(!res.ok){
    const message = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data !== null ? data : res;
}

/* ---------- Session (client) ---------- */
function getSession(){
  try{ return JSON.parse(localStorage.getItem(SESSION_KEY)); }catch(e){ return null; }
}
function setSession(session){ localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
function requireSession(){
  const s = getSession();
  if(!s || !s.token){
    toast('error', 'Session Required', 'Please sign in from the homepage to continue.');
    setTimeout(()=> window.location.href = 'index.html', 1400);
    return null;
  }
  return s;
}
function maskContact(v, channel){
  if(!v) return '—';
  if(channel === 'mobile') return v.slice(0,2) + '••••' + v.slice(-4);
  const parts = v.split('@');
  if(parts.length < 2) return v;
  return parts[0].slice(0,2) + '•••@' + parts[1];
}
function paintSessionPill(){
  const s = getSession();
  const el = document.getElementById('sessionContact');
  if(el && s) el.textContent = maskContact(s.contact, s.channel);
}
function logout(){
  const s = getSession();
  if(s && s.token){
    // Fire-and-forget: revoke server-side, but don't block the redirect on it
    apiFetch('/api/auth/logout', { method:'POST', headers:{ Authorization:'Bearer '+s.token } }).catch(()=>{});
  }
  localStorage.removeItem(SESSION_KEY);
  toast('info', 'Signed Out', 'Your session has ended securely.');
  setTimeout(()=> window.location.href = 'index.html', 700);
}

/* ---------- HTML escaping (defense-in-depth for any user-influenced text rendered via innerHTML) ---------- */
function escapeHtml(value){
  if(value === null || value === undefined) return '—';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ---------- OTP flow (calls backend) ---------- */
async function apiRequestOtp(contact, channel){
  return apiFetch('/api/auth/request-otp', { method:'POST', body: JSON.stringify({ contact, channel }) });
}
async function apiVerifyOtp(contact, channel, code){
  return apiFetch('/api/auth/verify-otp', { method:'POST', body: JSON.stringify({ contact, channel, code }) });
}

/* ---------- Lead Ledger (calls backend) ---------- */
async function logLead(details){
  const session = getSession();
  if(!session || !session.token){
    toast('info', 'Sign In Required', 'Please sign in so this enquiry can be followed up.');
    return null;
  }
  try{
    const resp = await apiFetch('/api/leads', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.token },
      body: JSON.stringify(details),
    });
    return resp.lead;
  }catch(err){
    toast('error', 'Could Not Save Enquiry', err.message || 'Please try again in a moment.');
    return null;
  }
}
function logBrochureClick(details){
  // Fire-and-forget so the new tab isn't delayed by the network call
  logLead({ ...details, actionType: 'Official Brochure' });
}

/* ---------- Quote Modal ---------- */
let pendingQuote = null;
function ensureQuoteModal(){
  if(document.getElementById('quoteModalOverlay')) return;
  const div = document.createElement('div');
  div.innerHTML = `
  <div id="quoteModalOverlay" class="modal-overlay hidden">
    <div class="modal-box glass">
      <h3 id="quoteModalTitle">Request a Quote</h3>
      <p class="sub" id="quoteModalSub"></p>
      <textarea id="quoteNote" placeholder="Optional note — preferred details or best time to call"></textarea>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeQuoteModal()">Cancel</button>
        <button class="btn btn-primary" id="quoteSubmitBtn" onclick="submitQuote()">Confirm Request</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(div.firstElementChild);
}
function openQuoteModal(details){
  const s = requireSession();
  if(!s) return;
  ensureQuoteModal();
  pendingQuote = details;
  document.getElementById('quoteModalTitle').textContent = 'Request a Quote — ' + details.planName;
  document.getElementById('quoteModalSub').textContent = `${details.category} · Investment ₹${details.investAmount || '—'} · ${details.tenure || '—'} yrs · ${details.frequency || '—'}. Mr. Shukla's desk will reach out on your verified contact.`;
  document.getElementById('quoteNote').value = '';
  document.getElementById('quoteModalOverlay').classList.remove('hidden');
}
function closeQuoteModal(){
  const ov = document.getElementById('quoteModalOverlay');
  if(ov) ov.classList.add('hidden');
  pendingQuote = null;
}
async function submitQuote(){
  if(!pendingQuote) return;
  const btn = document.getElementById('quoteSubmitBtn');
  const note = document.getElementById('quoteNote').value.trim();
  btn.disabled = true; btn.textContent = 'Submitting…';
  const lead = await logLead({ ...pendingQuote, actionType:'Request Quote', note });
  btn.disabled = false; btn.textContent = 'Confirm Request';
  if(lead){
    toast('success', 'Quote Requested', `Your request for ${pendingQuote.planName} has been logged. Mr. Shukla's team will contact you shortly.`);
    closeQuoteModal();
  }
}

/* ---------- Admin (calls backend) ---------- */
function getAdminToken(){ return sessionStorage.getItem(ADMIN_TOKEN_KEY); }
function setAdminToken(token){ sessionStorage.setItem(ADMIN_TOKEN_KEY, token); }
function clearAdminToken(){ sessionStorage.removeItem(ADMIN_TOKEN_KEY); }

async function adminLogin(pin){
  const resp = await apiFetch('/api/admin/login', { method:'POST', body: JSON.stringify({ pin }) });
  setAdminToken(resp.token);
  return resp;
}
async function adminLogoutApi(){
  const token = getAdminToken();
  if(!token) return;
  try{ await apiFetch('/api/admin/logout', { method:'POST', headers:{ Authorization:'Bearer '+token } }); }
  catch(e){ /* best-effort */ }
  clearAdminToken();
}
async function fetchAdminLeads(){
  const token = getAdminToken();
  return apiFetch('/api/admin/leads', { headers: { Authorization: 'Bearer ' + token } });
}
async function updateLeadStatusApi(id, status){
  const token = getAdminToken();
  return apiFetch(`/api/admin/leads/${id}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({ status }),
  });
}
async function clearAllLeadsApi(){
  const token = getAdminToken();
  return apiFetch('/api/admin/leads', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
}
async function exportLeadsCsvApi(){
  const token = getAdminToken();
  const res = await fetch(API_BASE_URL + '/api/admin/leads/export', { headers: { Authorization: 'Bearer ' + token } });
  if(!res.ok) throw new Error('Export failed (' + res.status + ')');
  return res.blob();
}

document.addEventListener('DOMContentLoaded', paintSessionPill);
window.onerror = function(){ return true; };
