function renderSidebar(activePage) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';
 
  const pages = [
    { href:'dashboard.html', label:'Dashboard', icon:`<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>` },
    { href:'leads.html',     label:'Leads',     icon:`<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>` },
    { href:'meetings.html',  label:'Meetings',  icon:`<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>` },
    { href:'clients.html',   label:'Clients',   icon:`<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>` },
    { href:'followups.html', label:'Follow Ups',icon:`<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6z"/>` },
    { href:'task.html',      label:'Tasks',     icon:`<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>` },
    { href:'projects.html',  label:'Projects',  icon:`<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>` },
    { href:'revenue.html',   label:'Revenue',   icon:`<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>` },
    { href:'domains.html', label:'Domains', icon:`<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>` },
    { href:'notifications.html', label:'Notifications', icon:`<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>` },
    ...(isAdmin ? [{ href:'users.html', label:'Users', icon:`<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>` }] : []),
    { href:'settings.html',  label:'Settings',  icon:`<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>` },
  ];
 
  document.getElementById('sidebar').innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
 
      <!-- Logo -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="logosrbg.png" style="width:36px;height:36px;border-radius:10px;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
          <div style="width:36px;height:36px;border-radius:10px;background:#6C3EF4;display:none;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
          </div>
          <div>
            <div style="color:white;font-weight:800;font-size:16px;line-height:1.1;">LeadsPro</div>
            <div style="color:#A78BFA;font-size:11px;">CRM</div>
          </div>
        </div>
        <button onclick="closeSidebar()" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:20px;padding:0;line-height:1;">✕</button>
      </div>
 
      <!-- Nav Links — Scrollable -->
      <nav style="display:flex;flex-direction:column;gap:2px;flex:1;overflow-y:auto;overflow-x:hidden;min-height:0;padding-right:2px;scrollbar-width:thin;scrollbar-color:#6C3EF4 transparent;">
        ${pages.map(p => {
          const isActive = p.label === activePage;
          return `
            <a href="${p.href}"
               style="display:flex;align-items:center;gap:11px;padding:10px 11px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;color:${isActive ? 'white' : 'rgba(167,139,250,0.8)'};background:${isActive ? '#6C3EF4' : 'transparent'};transition:all 0.25s ease;cursor:pointer;position:relative;flex-shrink:0;"
               onmouseover="this.style.background='${isActive ? '#6C3EF4' : 'rgba(108,62,244,0.15)'}';this.style.color='white'"
               onmouseout="this.style.background='${isActive ? '#6C3EF4' : 'transparent'}';this.style.color='${isActive ? 'white' : 'rgba(167,139,250,0.8)'}'"
               onclick="handleSidebarClick('${p.href}')">
              <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0;">${p.icon}</svg>
              <span style="flex:1;">${p.label}</span>
              ${p.label === 'Users' ? '<span style="background:rgba(239,68,68,0.7);color:white;font-size:9px;padding:1px 5px;border-radius:6px;">Admin</span>' : ''}
              ${isActive ? '<span style="width:3px;height:20px;background:white;border-radius:4px;flex-shrink:0;"></span>' : ''}
            </a>
          `;
        }).join('')}
      </nav>
 
      <!-- Bottom Section -->
      <div style="flex-shrink:0;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);">
        <div style="background:linear-gradient(135deg,#7C3AED,#4F46E5);border-radius:12px;padding:14px;margin-bottom:8px;transition:transform 0.2s;cursor:pointer;"
             onmouseover="this.style.transform='scale(1.02)'"
             onmouseout="this.style.transform='scale(1)'">
          <div style="color:white;font-weight:700;font-size:13px;margin-bottom:3px;">Upgrade Plan 🚀</div>
          <p style="color:rgba(255,255,255,0.65);font-size:11px;margin-bottom:10px;line-height:1.4;">Unlock More Features</p>
          <button style="width:100%;background:white;color:#6C3EF4;font-weight:700;font-size:12px;padding:7px;border-radius:8px;border:none;cursor:pointer;transition:all 0.2s;"
                  onmouseover="this.style.background='#EDE9FE'"
                  onmouseout="this.style.background='white'">
            Upgrade Now
          </button>
        </div>
        <button onclick="logout()"
                style="width:100%;background:rgba(239,68,68,0.1);color:#FCA5A5;border:1px solid rgba(239,68,68,0.2);padding:9px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.25s ease;"
                onmouseover="this.style.background='rgba(239,68,68,0.2)';this.style.borderColor='rgba(239,68,68,0.4)'"
                onmouseout="this.style.background='rgba(239,68,68,0.1)';this.style.borderColor='rgba(239,68,68,0.2)'">
          🚪 Logout
        </button>
      </div>
 
    </div>
  `;
}
 
// ── Handle Sidebar Click ──
function handleSidebarClick(href) {
  window.location.href = href;
}
 
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
  document.body.style.overflow = '';
}
 
function injectCommonStyles() {
  const style = document.createElement('style');
  style.textContent = `
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Plus Jakarta Sans',sans-serif; }
    html, body { height:100%; overflow:hidden; background:#F5F4FA; }
 
    .app-wrapper { display:flex; height:100vh; width:100vw; overflow:hidden; }
 
    .sidebar {
      width:220px !important; min-width:220px !important; max-width:220px !important;
      height:100vh !important;
      background:linear-gradient(180deg,#2D1B69 0%,#1a0e40 100%);
      display:flex !important; flex-direction:column !important;
      padding:20px 14px !important;
      flex-shrink:0 !important;
      overflow:hidden !important;
      transition:transform 0.3s ease;
    }
 
    /* Custom scrollbar for nav */
    nav::-webkit-scrollbar { width:4px; }
    nav::-webkit-scrollbar-track { background:transparent; }
    nav::-webkit-scrollbar-thumb { background:#6C3EF4; border-radius:10px; }
    nav::-webkit-scrollbar-thumb:hover { background:#7C3AED; }
 
    .main-col { flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; height:100vh; }
    .main-header { background:white; border-bottom:1px solid #F3F4F6; padding:12px 16px; display:flex; align-items:center; gap:12px; flex-shrink:0; height:56px; }
    .main-scroll { flex:1; overflow-y:auto; overflow-x:hidden; padding:16px; }
 
    .sidebar-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:40; }
    .sidebar-overlay.show { display:block; }
 
    .inp { width:100%; border:1.5px solid #E5E7EB; border-radius:10px; padding:10px 14px; font-size:14px; outline:none; transition:border 0.2s; background:white; }
    .inp:focus { border-color:#6C3EF4; box-shadow:0 0 0 3px rgba(108,62,244,0.08); }
 
    .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:50; padding:16px; }
 
    .toast { position:fixed; top:20px; right:20px; padding:12px 20px; border-radius:10px; font-size:13px; font-weight:600; transform:translateX(150%); transition:transform 0.3s; z-index:999; max-width:300px; }
    .toast.show { transform:translateX(0); }
    .toast.ok   { background:#D1FAE5; color:#065F46; }
    .toast.err  { background:#FEE2E2; color:#991B1B; }
    .toast.info { background:#DBEAFE; color:#1E40AF; }
 
    .badge { font-size:0.72rem; font-weight:600; padding:3px 10px; border-radius:20px; white-space:nowrap; display:inline-block; }
    .badge-New        { background:#EEF2FF; color:#4F46E5; }
    .badge-Contacted  { background:#FFF7ED; color:#EA580C; }
    .badge-Interested { background:#F0FDF4; color:#16A34A; }
    .badge-Follow\\ Up { background:#FFF1F2; color:#E11D48; }
    .badge-Converted  { background:#ECFDF5; color:#059669; }
    .badge-Lost       { background:#F3F4F6; color:#6B7280; }
    .src-Facebook\\ Ads { background:#EEF2FF; color:#4F46E5; }
    .src-Instagram     { background:#FDF2F8; color:#C026D3; }
    .src-Website       { background:#ECFDF5; color:#059669; }
    .src-Referral      { background:#FFF7ED; color:#D97706; }
    .src-Others        { background:#F3F4F6; color:#6B7280; }
    .avatar { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:700; color:white; flex-shrink:0; }
 
    @media (max-width:768px) {
      .sidebar { position:fixed !important; top:0; left:0; bottom:0; z-index:50; transform:translateX(-100%); width:240px !important; min-width:240px !important; max-width:240px !important; }
      .sidebar.open { transform:translateX(0) !important; }
    }
    @media (max-width:640px) {
      .hide-mobile { display:none !important; }
      .modal-bg > div { max-height:95vh !important; overflow-y:auto !important; }
      .main-scroll { padding:12px !important; }
    }
  `;
  document.head.appendChild(style);
}
 
function renderHeader(title, extraButtons='') {
  return `
    <header class="main-header">
      <button onclick="openSidebar()" style="background:none;border:none;cursor:pointer;padding:4px;color:#374151;flex-shrink:0;">
        <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <h1 style="font-size:17px;font-weight:800;color:#111827;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</h1>
      ${extraButtons}
    </header>
  `;
}
 
function logout() { localStorage.clear(); window.location.href='login.html'; }
 
function showToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3500);
}