/* MoneyOS — UI helpers + page renderers */

let CURRENT_PAGE = 'dashboard';
let aiMessages = [];

// ===================== Generic UI helpers =====================

function card(title, inner, extra = '') { return `<div class="card ${extra}"><div class="card-title">${title}</div>${inner}</div>`; }
function progress(pct, cls = 'fill-green') { return `<div class="progress-bar"><div class="progress-fill ${cls}" style="width:${clamp(pct, 0, 100)}%"></div></div>`; }
function input(name, value = '', type = 'text', extra = '') { return `<input data-field="${name}" type="${type}" value="${escapeHtml(value)}" ${extra} />`; }
function selectHtml(name, options, value) {
  return `<select data-field="${name}">${options.map(o => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
}
function checkboxHtml(name, checked) { return `<input data-field="${name}" type="checkbox" ${checked ? 'checked' : ''} />`; }
function formRow(label, html) { return `<label class="form-row"><span>${label}</span>${html}</label>`; }
function readForm(root) {
  const data = {};
  root.querySelectorAll('[data-field]').forEach(elm => {
    if (elm.type === 'checkbox') data[elm.dataset.field] = elm.checked;
    else if (elm.type === 'number') data[elm.dataset.field] = parseFloat(elm.value) || 0;
    else data[elm.dataset.field] = elm.value;
  });
  return data;
}

function openModal(title, bodyHtml, onSave, saveLabel = 'Save') {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `<div class="modal">
    <div class="modal-header"><h3>${title}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body" id="modal-body">${bodyHtml}</div>
    <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" id="modal-save">${saveLabel}</button></div>
  </div>`;
  overlay.classList.add('open');
  if (onSave) document.getElementById('modal-save').onclick = () => { onSave(readForm(document.getElementById('modal-body'))); };
  else document.getElementById('modal-save').style.display = 'none';
}
function closeModal() { const o = document.getElementById('modal-overlay'); o.classList.remove('open'); o.innerHTML = ''; }

function svgLine(points) {
  const w = 640, h = 170, pad = 26;
  const vals = points.map(p => p.value);
  const max = Math.max(...vals, 1), min = Math.min(...vals, 0);
  const range = (max - min) || 1;
  const stepX = (w - pad * 2) / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => [pad + i * stepX, h - pad - ((p.value - min) / range) * (h - pad * 2)]);
  const path = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ',' + c[1].toFixed(1)).join(' ');
  const area = path + ` L${coords[coords.length - 1][0]},${h - pad} L${coords[0][0]},${h - pad} Z`;
  const dots = coords.map((c, i) => `<circle cx="${c[0]}" cy="${c[1]}" r="3" fill="var(--accent)"><title>${points[i].label}: ${points[i].value.toFixed(2)}</title></circle>`).join('');
  const labels = points.map((p, i) => `<text x="${coords[i][0]}" y="${h - 6}" font-size="9" fill="var(--muted)" text-anchor="middle">${p.label}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="chart-svg"><defs><linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#lg1)"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>${dots}${labels}</svg>`;
}
function svgBars(points) {
  const w = 640, h = 170, pad = 26;
  const max = Math.max(...points.map(p => Math.abs(p.value)), 1);
  const gap = (w - pad * 2) / points.length, bw = gap * 0.55;
  const bars = points.map((p, i) => {
    const x = pad + i * gap + (gap - bw) / 2;
    const barH = Math.max(2, (Math.abs(p.value) / max) * (h - pad * 2));
    const y = h - pad - barH;
    return `<rect x="${x}" y="${y}" width="${bw}" height="${barH}" fill="${p.color || 'var(--accent)'}" rx="3"><title>${p.label}: ${p.value.toFixed(2)}</title></rect>`;
  }).join('');
  const labels = points.map((p, i) => `<text x="${pad + i * gap + gap / 2}" y="${h - 6}" font-size="9" fill="var(--muted)" text-anchor="middle">${p.label}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="chart-svg">${bars}${labels}</svg>`;
}
function svgDonut(segments) {
  const size = 150, r = 55, cx = 75, cy = 75, circumference = 2 * Math.PI * r;
  const colors = ['var(--accent)', 'var(--accent2)', 'var(--blue)', 'var(--positive)', 'var(--accent3)', '#7f1d1d'];
  let accFrac = 0;
  const circles = segments.map((s, i) => {
    const frac = s.pct / 100;
    const dash = frac * circumference;
    const offset = circumference * (1 - accFrac);
    accFrac += frac;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="18" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${offset}" transform="rotate(-90 ${cx} ${cy})"><title>${s.name}: ${s.pct.toFixed(1)}%</title></circle>`;
  }).join('');
  const legend = segments.map((s, i) => `<div class="legend-row"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span>${s.name} <b>${s.pct.toFixed(1)}%</b></div>`).join('');
  return `<div class="donut-wrap"><svg viewBox="0 0 ${size} ${size}" class="chart-svg">${circles}</svg><div class="legend">${legend}</div></div>`;
}

// ===================== Router / shell =====================

const NAV = [
  { section: 'Overview', items: [['dashboard', '⚡', 'Dashboard'], ['budget', '🎯', 'Budget'], ['goals', '🚀', 'Goals']] },
  { section: 'Money', items: [['transactions', '🧾', 'Transactions'], ['income', '💰', 'Income'], ['expenses', '📋', 'Expenses'], ['invest', '📈', 'Investments'], ['savings', '🏦', 'Savings']] },
  { section: 'Insights', items: [['ai', '🤖', 'AI Coach'], ['analytics', '📊', 'Analytics'], ['timeline', '🔮', 'Life Timeline'], ['reports', '🗒️', 'Reports']] },
  { section: 'Life', items: [['family', '👨‍👩‍👧', 'Family & Business'], ['credittax', '🏛️', 'Credit & Tax'], ['journal', '📓', 'Journal'], ['receipts', '🧾', 'Receipts']] },
  { section: 'System', items: [['automation', '⚙️', 'Automation'], ['security', '🔒', 'Security'], ['game', '🏆', 'Rewards'], ['settings', '🛠️', 'Settings']] }
];

function renderSidebar() {
  const nav = document.getElementById('nav');
  nav.innerHTML = NAV.map(sec => `
    <div class="nav-section">${sec.section}</div>
    ${sec.items.map(([id, icon, label]) => `<div class="nav-item ${CURRENT_PAGE === id ? 'active' : ''}" onclick="navigate('${id}')"><span class="nav-icon">${icon}</span> ${label}</div>`).join('')}
  `).join('');
  document.getElementById('health-score-val').textContent = healthScore(STATE);
}

function navigate(id) {
  CURRENT_PAGE = id;
  renderSidebar();
  renderPage();
  closeSidebarMobile();
  document.getElementById('main-scroll').scrollTop = 0;
}

function renderPage() {
  const map = {
    dashboard: pageDashboard, budget: pageBudget, goals: pageGoals, transactions: pageTransactions,
    income: pageIncome, expenses: pageExpenses, invest: pageInvest, savings: pageSavings, ai: pageAI,
    analytics: pageAnalytics, timeline: pageTimeline, reports: pageReports, family: pageFamily,
    credittax: pageCreditTax, journal: pageJournal, receipts: pageReceipts, automation: pageAutomation,
    security: pageSecurity, game: pageGame, settings: pageSettings
  };
  document.getElementById('page-content').innerHTML = map[CURRENT_PAGE](STATE);
  renderNotifBell();
}

function rerender() { save(); renderSidebar(); renderPage(); }

// ===================== Notification bell =====================

function renderNotifBell() {
  const unread = STATE.notifications.filter(n => !n.read).length;
  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = unread ? 'block' : 'none';
}
function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  const open = panel.classList.toggle('open');
  if (open) {
    panel.innerHTML = STATE.notifications.length
      ? STATE.notifications.slice(0, 20).map(n => `<div class="notif-row ${n.read ? '' : 'unread'}"><span>${iconFor(n.kind)}</span><div><div>${escapeHtml(n.text)}</div><div class="notif-time">${new Date(n.date).toLocaleString()}</div></div></div>`).join('')
      : `<div class="notif-empty">You're all caught up.</div>`;
    STATE.notifications.forEach(n => n.read = true);
    save(); renderNotifBell();
  }
}
function iconFor(kind) { return kind === 'good' ? '✅' : kind === 'warn' ? '⚠️' : 'ℹ️'; }

// ===================== DASHBOARD =====================

function pageDashboard(s) {
  const b = budgetSummary(s);
  const hs = healthScore(s);
  const rec = aiHeuristicRecommendation(s);
  const isNew = s.income.length === 0 && s.accounts.length === 0 && s.transactions.length === 0;
  return `
  ${isNew ? `<div class="getting-started"><h3>👋 Let's get your numbers in</h3><p class="muted-text" style="margin:0">Add your income so MoneyOS can tell you what's safe to spend — it remembers each paycheck for next time.</p><div class="ob-actions"><button class="btn-primary" onclick="navigate('income')">Add Income</button><button class="btn-secondary" onclick="openAddTransaction()">Log a Transaction</button></div></div>` : ''}
  <div class="afford-bar">
    <div>
      <div class="afford-question">Can I afford this right now?</div>
      <div class="afford-answer" id="afford-answer">${b.safeToday > 0 ? 'YES ✓' : 'NOT YET ✗'}</div>
      <div class="afford-result" id="afford-result">${money(b.safeToday)} safe to spend today</div>
    </div>
    <div class="afford-stats">
      <div class="afford-stat"><div class="val">${money(b.safeToday)}</div><div class="lbl">Safe Today</div></div>
      <div class="afford-stat"><div class="val">${billsCoveredPct(s)}%</div><div class="lbl">Bills Covered</div></div>
      <div class="afford-stat"><div class="val">${goalProgressAvg(s)}%</div><div class="lbl">Goal Progress</div></div>
      <div class="afford-stat"><div class="val">${hs}/100</div><div class="lbl">Health Score</div></div>
    </div>
    <div class="afford-input">
      <input type="number" id="afford-input" placeholder="Enter amount $" onkeydown="if(event.key==='Enter')checkAfford()" />
      <button class="afford-check-btn" onclick="checkAfford()">CHECK</button>
    </div>
  </div>

  <div class="alert alert-info">🤖 <div><strong>AI Coach:</strong> ${rec}</div></div>
  ${upcomingBills(s, 3).map(b2 => `<div class="alert alert-warn">⚠️ <div><strong>Bill Alert:</strong> ${b2.name} (${money(b2.amount)}) due in ${b2.daysUntil} day(s).</div></div>`).join('')}
  ${detectUnusual(s).map(f => `<div class="alert alert-warn">🚨 <div><strong>Unusual spending:</strong> ${f.category} transaction of ${money(f.amount)} is well above your usual ${money(f.mean)}.</div></div>`).join('')}

  <div class="grid-4">
    <div class="stat-card"><div class="stat-label">Cash Available</div><div class="stat-value" style="color:var(--accent)">${money(totalCash(s))}</div></div>
    <div class="stat-card"><div class="stat-label">Total Savings</div><div class="stat-value">${money(totalSavings(s))}</div></div>
    <div class="stat-card"><div class="stat-label">Investments</div><div class="stat-value">${money(investmentValue(s))}</div></div>
    <div class="stat-card"><div class="stat-label">Net Worth</div><div class="stat-value" style="color:var(--accent)">${money(netWorth(s))}</div></div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">Spending This Month <span class="badge">${new Date().toLocaleString('default', { month: 'short', year: 'numeric' })}</span></div>
      ${s.categories.map(c => {
        const spent = spentThisMonth(s, c.name);
        const pct = c.budget ? Math.round((spent / c.budget) * 100) : 0;
        const cls = pct >= 90 ? 'fill-red' : pct >= 70 ? 'fill-amber' : 'fill-green';
        return `<div class="cat-row"><div class="cat-icon">${c.icon}</div><div class="cat-info"><div class="cat-name">${escapeHtml(c.name)}</div>${progress(pct, cls)}<div class="cat-amount">${money(spent)} / ${money(c.budget)}</div></div><div class="cat-pct">${pct}%</div></div>`;
      }).join('') || '<div class="empty">No categories yet.</div>'}
    </div>
    <div class="card">
      <div class="card-title">Upcoming Bills</div>
      ${upcomingBills(s, 30).map(b2 => `<div class="bill-row"><div><div class="bill-name">${escapeHtml(b2.name)}</div><div class="bill-due ${b2.daysUntil <= 5 ? 'due-soon' : ''}">In ${b2.daysUntil} day(s)</div></div><div><div class="bill-amount">${money(b2.amount)}</div><div class="bill-status ${b2.autopay ? 'paid' : 'pending'}">${b2.autopay ? 'Auto-pay' : 'Manual'}</div></div></div>`).join('') || '<div class="empty">No bills.</div>'}
    </div>
  </div>

  <div class="card">
    <div class="card-title">Net Worth Growth</div>
    ${svgLine(s.netWorthHistory.map(h => ({ label: h.date.slice(5), value: h.value })).concat([{ label: 'Now', value: netWorth(s) }]))}
  </div>
  <div style="text-align:right;margin-top:6px"><button class="btn-secondary" onclick="openAddTransaction()">+ Quick Add Transaction</button></div>
  `;
}

function aiHeuristicRecommendation(s) {
  const overspent = s.categories.map(c => ({ c, over: spentThisMonth(s, c.name) - c.budget })).sort((a, b) => b.over - a.over)[0];
  const goal = [...s.goals].sort((a, b) => (a.current / a.target) - (b.current / b.target))[0];
  if (overspent && overspent.over > 0) {
    return `You're ${money(overspent.over)} over budget in ${escapeHtml(overspent.c.name)}. Trim it this week and you'll stay on track for ${goal ? escapeHtml(goal.name) : 'your goals'}.`;
  }
  if (goal) return `Put ${money(Math.max(10, Math.round(monthlyIncomeEstimate(s) * 0.05)))} more toward ${escapeHtml(goal.name)} this week to reach it faster.`;
  return 'Add a goal to get a personalized recommendation.';
}

function checkAfford() {
  const val = parseFloat(document.getElementById('afford-input').value);
  if (!val || isNaN(val)) return;
  const b = budgetSummary(STATE);
  const ans = document.getElementById('afford-answer');
  const res = document.getElementById('afford-result');
  if (val <= b.safeToday) {
    ans.textContent = 'YES ✓'; ans.style.color = 'var(--accent)';
    res.textContent = `You can afford ${money(val)}. You'll have ${money(b.safeToday - val)} left today.`;
  } else {
    ans.textContent = 'NOT YET ✗'; ans.style.color = 'var(--red)';
    res.textContent = `You're ${money(val - b.safeToday)} short of today's safe-to-spend amount.`;
  }
}

function openAddTransaction(prefill = {}) {
  const type = prefill.type || 'expense';
  renderTxnModal({ ...prefill, type });
}

function renderTxnModal(prefill) {
  const cats = STATE.categories.map(c => ({ value: c.name, label: `${c.icon} ${c.name}` }));
  const catField = cats.length
    ? formRow('Category', selectHtml('category', cats, prefill.category || cats[0]?.value))
    : `<div class="muted-text" style="margin-bottom:12px">No categories yet — one will be created automatically from your note (you can rename/budget it later on the Budget page).</div>`;
  const sourceOptions = [{ value: '', label: '— One-off / other —' }, ...STATE.income.map(i => ({ value: i.id, label: `${i.source} (usually ${money(i.amount)})` }))];
  const incomeField = STATE.income.length
    ? formRow('Income source', selectHtml('sourceId', sourceOptions, prefill.sourceId || ''))
    : '';
  const body = `
    ${formRow('Type', selectHtml('type', [{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }], prefill.type || 'expense').replace('<select', '<select onchange="onTxnTypeChange(this.value)"'))}
    <div id="txn-income-field">${prefill.type === 'income' ? incomeField : ''}</div>
    ${formRow('Amount', input('amount', prefill.amount || '', 'number', 'step="0.01" id="txn-amount-input"'))}
    ${formRow('Note', input('note', prefill.note || '', 'text'))}
    <div id="txn-category-field">${prefill.type === 'income' ? '' : catField}</div>
    ${formRow('Date', input('date', new Date().toISOString().slice(0, 10), 'date'))}
    ${STATE.profile.mode !== 'personal' ? formRow('Business expense?', checkboxHtml('business', false)) : ''}
  `;
  openModal('Add Transaction', body, (data) => {
    let category = data.category;
    if (data.type === 'income') category = 'Income';
    else if (!category && data.note) category = autoCategorize(data.note);
    else if (!category) category = 'Uncategorized';
    if (data.type === 'expense' && !STATE.categories.some(c => c.name === category)) {
      const suggestion = CATEGORY_SUGGESTIONS.find(s => s.name === category);
      STATE.categories.push({ id: uid(), name: category, icon: suggestion?.icon || '🏷️', budget: 0, rollover: false, rolloverBalance: 0 });
    }
    const amount = Math.abs(data.amount) || 0;
    const txn = { id: uid(), date: data.date, amount, category, note: data.note, type: data.type, account: 'Checking', business: !!data.business };
    STATE.transactions.push(txn);
    if (txn.type === 'expense') runSmartRules(STATE, txn);
    if (txn.type === 'income') {
      const source = STATE.income.find(i => i.id === data.sourceId);
      if (source) advanceIncomeSource(source, amount, data.date);
      if (STATE.automation.autoSave.enabled) {
        const pct = STATE.automation.autoSave.percent / 100;
        const goal = STATE.goals.find(g => g.id === STATE.automation.autoSave.targetGoalId) || STATE.emergencyFund;
        const amt = +(amount * pct).toFixed(2);
        if (goal === STATE.emergencyFund) STATE.emergencyFund.current += amt; else goal.current += amt;
        notify(STATE, 'good', `Auto-save moved ${money(amt)} (${STATE.automation.autoSave.percent}% of income) into savings.`);
      }
    }
    awardXP(STATE, XP_RULES.addTransaction, 'txn');
    bumpMission(STATE, 'txns');
    logDailyActivity(STATE);
    closeModal(); rerender();
  });
}
function onTxnTypeChange(type) {
  const isIncome = type === 'income';
  const cats = STATE.categories.map(c => ({ value: c.name, label: `${c.icon} ${c.name}` }));
  const catField = cats.length ? formRow('Category', selectHtml('category', cats, cats[0]?.value)) : `<div class="muted-text" style="margin-bottom:12px">No categories yet — one will be created automatically from your note.</div>`;
  document.getElementById('txn-category-field').innerHTML = isIncome ? '' : catField;
  const sourceOptions = [{ value: '', label: '— One-off / other —' }, ...STATE.income.map(i => ({ value: i.id, label: `${i.source} (usually ${money(i.amount)})` }))];
  document.getElementById('txn-income-field').innerHTML = isIncome && STATE.income.length ? formRow('Income source', selectHtml('sourceId', sourceOptions, '').replace('<select', `<select onchange="onIncomeSourceChange(this.value)"`)) : '';
}
function onIncomeSourceChange(sourceId) {
  const source = STATE.income.find(i => i.id === sourceId);
  if (source && source.amount) document.getElementById('txn-amount-input').value = source.amount;
}

// ===================== BUDGET =====================

function pageBudget(s) {
  const b = budgetSummary(s);
  return `
  <div class="section-title">Budget Control Center</div>
  <div class="grid-3">
    <div class="stat-card"><div class="stat-label">Left to Spend Today</div><div class="stat-value" style="color:var(--accent)">${money(b.safeToday)}</div></div>
    <div class="stat-card"><div class="stat-label">Left This Week</div><div class="stat-value">${money(b.leftWeek)}</div></div>
    <div class="stat-card"><div class="stat-label">Left This Month</div><div class="stat-value">${money(b.leftMonth)}</div><div class="stat-change neutral">${b.daysRemaining} days left · rollover pool ${money(rolloverTotal(s))}</div></div>
  </div>
  <div class="card">
    <div class="card-title">Monthly Budget Limits <button class="btn-secondary sm" onclick="openAddCategory()">+ Category</button></div>
    ${s.categories.map(c => {
      const spent = spentThisMonth(s, c.name);
      const pct = c.budget ? (spent / c.budget) * 100 : 0;
      const cls = pct >= 90 ? 'fill-red' : pct >= 70 ? 'fill-amber' : 'fill-green';
      return `<div class="row-line">
        <div class="progress-label"><span>${c.icon} ${escapeHtml(c.name)} ${c.rollover ? '<span class="badge">rollover</span>' : ''}</span><span>${money(spent)}/${money(c.budget)}</span></div>
        ${progress(pct, cls)}
        <div class="row-actions"><button class="link-btn" onclick="openEditCategory('${c.id}')">Edit</button><button class="link-btn danger" onclick="deleteCategory('${c.id}')">Delete</button></div>
      </div>`;
    }).join('')}
  </div>
  <button class="btn-secondary" onclick="runRollover()">🔁 Run Monthly Rollover</button>
  `;
}
function openAddCategory() {
  const body = `${formRow('Name', input('name'))}${formRow('Icon (emoji)', input('icon', '🏷️'))}${formRow('Monthly budget', input('budget', 100, 'number'))}${formRow('Rollover unused money?', checkboxHtml('rollover', true))}`;
  openModal('Add Category', body, (d) => { STATE.categories.push({ id: uid(), name: d.name, icon: d.icon || '🏷️', budget: d.budget, rollover: d.rollover, rolloverBalance: 0 }); closeModal(); rerender(); });
}
function openEditCategory(id) {
  const c = STATE.categories.find(x => x.id === id);
  const body = `${formRow('Name', input('name', c.name))}${formRow('Icon', input('icon', c.icon))}${formRow('Monthly budget', input('budget', c.budget, 'number'))}${formRow('Rollover unused money?', checkboxHtml('rollover', c.rollover))}`;
  openModal('Edit Category', body, (d) => { Object.assign(c, d); closeModal(); rerender(); });
}
function deleteCategory(id) { if (confirm('Delete this category?')) { STATE.categories = STATE.categories.filter(c => c.id !== id); rerender(); } }
function runRollover() { const did = processMonthlyRollover(STATE); notify(STATE, did ? 'good' : 'info', did ? 'Rollover processed — unused budget carried forward.' : 'Rollover already processed for this month.'); rerender(); }

// ===================== GOALS =====================

const GOAL_TYPES = [
  { value: 'house', label: '🏡 House Fund' }, { value: 'car', label: '🚗 Car Fund' }, { value: 'vacation', label: '🏖️ Vacation Fund' },
  { value: 'wedding', label: '💍 Wedding Fund' }, { value: 'business', label: '💼 Business Fund' }, { value: 'debt', label: '💳 Debt Payoff' },
  { value: 'retirement', label: '🏦 Retirement Target' }, { value: 'custom', label: '⭐ Custom Goal' }
];
function pageGoals(s) {
  return `
  <div class="section-title">Your Financial Goals <button class="btn-secondary sm" onclick="openAddGoal()">+ Goal</button></div>
  ${s.goals.map(g => {
    const pct = clamp((g.current / g.target) * 100, 0, 100);
    const cls = pct >= 75 ? 'fill-green' : pct >= 40 ? 'fill-blue' : 'fill-amber';
    return `<div class="goal-card">
      <div class="goal-header"><div class="goal-name">${g.icon} ${escapeHtml(g.name)}</div><div class="goal-pct">${pct.toFixed(0)}%</div></div>
      ${progress(pct, cls)}
      <div class="goal-amounts"><span>${money(g.current)} saved</span><span>Goal: ${money(g.target)}</span></div>
      <div class="row-actions"><button class="link-btn" onclick="contributeGoal('${g.id}')">+ Contribute</button><button class="link-btn" onclick="openEditGoal('${g.id}')">Edit</button><button class="link-btn danger" onclick="deleteGoal('${g.id}')">Delete</button></div>
    </div>`;
  }).join('') || '<div class="empty">No goals yet — add your first one.</div>'}
  `;
}
function openAddGoal() {
  const body = `${formRow('Name', input('name'))}${formRow('Type', selectHtml('type', GOAL_TYPES, 'custom'))}${formRow('Icon', input('icon', '⭐'))}${formRow('Target amount', input('target', 1000, 'number'))}${formRow('Already saved', input('current', 0, 'number'))}`;
  openModal('Add Goal', body, (d) => { STATE.goals.push({ id: uid(), name: d.name, type: d.type, icon: d.icon || '⭐', target: d.target, current: d.current, milestonesHit: [] }); awardXP(STATE, 10, 'goal'); closeModal(); rerender(); });
}
function openEditGoal(id) {
  const g = STATE.goals.find(x => x.id === id);
  const body = `${formRow('Name', input('name', g.name))}${formRow('Target amount', input('target', g.target, 'number'))}${formRow('Current amount', input('current', g.current, 'number'))}`;
  openModal('Edit Goal', body, (d) => { Object.assign(g, d); checkGoalMilestones(STATE, g); closeModal(); rerender(); });
}
function deleteGoal(id) { if (confirm('Delete this goal?')) { STATE.goals = STATE.goals.filter(g => g.id !== id); rerender(); } }
function contributeGoal(id) {
  const g = STATE.goals.find(x => x.id === id);
  const body = formRow('Amount to add', input('amount', 25, 'number'));
  openModal(`Contribute to ${g.name}`, body, (d) => {
    g.current += d.amount;
    checkGoalMilestones(STATE, g);
    awardXP(STATE, XP_RULES.contributeGoal, 'contribute');
    bumpMission(STATE, 'goal');
    closeModal(); rerender();
  }, 'Add');
}

// ===================== TRANSACTIONS =====================

function pageTransactions(s) {
  const rows = [...s.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200);
  return `
  <div class="section-title">Transactions <button class="btn-secondary sm" onclick="openAddTransaction()">+ Add</button></div>
  <div class="card">
    <table class="data-table"><thead><tr><th>Date</th><th>Note</th><th>Category</th><th>Type</th><th>Amount</th><th></th></tr></thead>
    <tbody>
    ${rows.map(t => `<tr>
      <td>${t.date}</td><td>${escapeHtml(t.note || '')}</td><td>${escapeHtml(t.category)}</td>
      <td><span class="badge">${t.type}${t.business ? ' · biz' : ''}</span></td>
      <td class="${t.type === 'income' ? 'up' : 'down'}">${t.type === 'income' ? '+' : '-'}${money(t.amount)}</td>
      <td><button class="link-btn danger" onclick="deleteTransaction('${t.id}')">✕</button></td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty">No transactions yet.</td></tr>'}
    </tbody></table>
  </div>`;
}
function deleteTransaction(id) { STATE.transactions = STATE.transactions.filter(t => t.id !== id); rerender(); }

// ===================== INCOME =====================

function pageIncome(s) {
  const monthly = monthlyIncomeEstimate(s);
  return `
  <div class="section-title">Income Streams <button class="btn-secondary sm" onclick="openAddIncome()">+ Source</button></div>
  <div class="stat-card" style="margin-bottom:16px"><div class="stat-label">Estimated Monthly Income</div><div class="stat-value" style="color:var(--accent)">${money(monthly)}</div></div>
  <div class="card">
    <div class="card-title">All Income Sources</div>
    ${s.income.map(i => `<div class="income-row"><div><div class="income-source">${escapeHtml(i.source)} <span class="badge">${i.type}</span></div><div class="income-type">${i.cadence}${i.nextDate ? ' · next ' + i.nextDate : ''}${i.amount ? ' · remembers ' + money(i.amount) + '/pay' : ''}</div></div><div style="display:flex;align-items:center;gap:10px"><button class="btn-secondary sm" onclick="logPaycheck('${i.id}')">Log Paycheck</button><button class="link-btn" onclick="openEditIncome('${i.id}')">Edit</button><button class="link-btn danger" onclick="deleteIncome('${i.id}')">✕</button></div></div>`).join('') || '<div class="empty">No income sources yet — add your job, side hustle, or any other income to get started.</div>'}
  </div>
  <div class="card"><div class="card-title">Paycheck Calendar</div>
    ${s.income.filter(i => i.nextDate).sort((a, b) => a.nextDate.localeCompare(b.nextDate)).map(i => `<div class="bill-row"><div class="bill-name">${escapeHtml(i.source)}</div><div class="bill-amount">${i.nextDate}</div></div>`).join('') || '<div class="empty">No upcoming paychecks scheduled.</div>'}
  </div>`;
}
function logPaycheck(id) {
  const source = STATE.income.find(i => i.id === id);
  const body = `${formRow('Amount received', input('amount', source.amount || '', 'number'))}${formRow('Date', input('date', new Date().toISOString().slice(0, 10), 'date'))}`;
  openModal(`Log Paycheck — ${source.source}`, body, (d) => {
    STATE.transactions.push({ id: uid(), date: d.date, amount: Math.abs(d.amount), category: 'Income', note: source.source, type: 'income', account: 'Checking', business: false });
    advanceIncomeSource(source, Math.abs(d.amount), d.date);
    awardXP(STATE, XP_RULES.addTransaction, 'paycheck');
    logDailyActivity(STATE);
    checkBadges(STATE);
    notify(STATE, 'good', `Logged ${money(d.amount)} from ${source.source}. Next expected: ${source.nextDate || '—'}.`);
    closeModal(); rerender();
  }, 'Log');
}
const INCOME_TYPES = [{ value: 'w2', label: 'W2 Job' }, { value: 'side', label: 'Side Hustle' }, { value: 'other', label: 'Other' }];
const CADENCES = [{ value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Bi-weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'irregular', label: 'Irregular' }];
function openAddIncome() {
  const body = `${formRow('Source name', input('source'))}${formRow('Type', selectHtml('type', INCOME_TYPES, 'side'))}${formRow('Amount per pay', input('amount', 0, 'number'))}${formRow('Cadence', selectHtml('cadence', CADENCES, 'monthly'))}${formRow('Next pay date', input('nextDate', '', 'date'))}`;
  openModal('Add Income Source', body, (d) => { STATE.income.push({ id: uid(), ...d }); checkBadges(STATE); closeModal(); rerender(); });
}
function openEditIncome(id) {
  const i = STATE.income.find(x => x.id === id);
  const body = `${formRow('Source name', input('source', i.source))}${formRow('Amount per pay', input('amount', i.amount, 'number'))}${formRow('Cadence', selectHtml('cadence', CADENCES, i.cadence))}${formRow('Next pay date', input('nextDate', i.nextDate, 'date'))}`;
  openModal('Edit Income Source', body, (d) => { Object.assign(i, d); checkBadges(STATE); closeModal(); rerender(); });
}
function deleteIncome(id) { STATE.income = STATE.income.filter(i => i.id !== id); rerender(); }

// ===================== EXPENSES =====================

function pageExpenses(s) {
  const increases = detectPriceIncreases(s);
  const dupes = detectDuplicateSubs(s);
  const subTotal = s.subscriptions.reduce((a, x) => a + x.amount, 0);
  return `
  <div class="section-title">Expenses & Bills</div>
  ${increases.map(f => `<div class="alert alert-warn">⚠️ <div><strong>Price increase:</strong> ${escapeHtml(f.name)} went from ${money(f.from)} to ${money(f.to)}.</div></div>`).join('')}
  ${dupes.map(n => `<div class="alert alert-warn">🔁 <div><strong>Possible duplicate:</strong> ${escapeHtml(n)} appears more than once.</div></div>`).join('')}
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Recurring Bills <button class="btn-secondary sm" onclick="openAddBill()">+ Bill</button></div>
      ${s.bills.map(b => `<div class="bill-row"><div><div class="bill-name">${escapeHtml(b.name)}</div><div class="bill-due">Due day ${b.dueDay} · ${escapeHtml(b.category)}</div></div><div style="text-align:right"><div class="bill-amount">${money(b.amount)}</div><label class="switch"><input type="checkbox" ${b.autopay ? 'checked' : ''} onchange="toggleAutopay('${b.id}')"><span>Auto-pay</span></label><div class="row-actions"><button class="link-btn" onclick="openEditBill('${b.id}')">Edit</button><button class="link-btn danger" onclick="deleteBill('${b.id}')">✕</button></div></div></div>`).join('') || '<div class="empty">No bills yet.</div>'}
    </div>
    <div class="card">
      <div class="card-title">Subscription Tracker <button class="btn-secondary sm" onclick="openAddSub()">+ Sub</button></div>
      <div class="alert alert-warn" style="margin-bottom:10px">You have ${s.subscriptions.length} active subscriptions. Total: ${money(subTotal)}/mo</div>
      ${s.subscriptions.map(sub => `<div class="bill-row"><div class="bill-name">${escapeHtml(sub.name)}</div><div style="text-align:right"><div class="bill-amount">${money(sub.amount)}</div><div class="row-actions"><button class="link-btn" onclick="bumpSubPrice('${sub.id}')">Price changed</button><button class="link-btn danger" onclick="deleteSub('${sub.id}')">✕</button></div></div></div>`).join('')}
    </div>
  </div>`;
}
function toggleAutopay(id) { const b = STATE.bills.find(x => x.id === id); b.autopay = !b.autopay; rerender(); }
function openAddBill() {
  const cats = STATE.categories.map(c => ({ value: c.name, label: c.name }));
  const body = `${formRow('Name', input('name'))}${formRow('Amount', input('amount', 0, 'number'))}${formRow('Due day of month', input('dueDay', 1, 'number'))}${formRow('Category', selectHtml('category', cats, cats[0]?.value))}`;
  openModal('Add Bill', body, (d) => { STATE.bills.push({ id: uid(), ...d, autopay: false, history: [{ date: new Date().toISOString().slice(0, 10), amount: d.amount }] }); closeModal(); rerender(); });
}
function openEditBill(id) {
  const b = STATE.bills.find(x => x.id === id);
  const body = `${formRow('Name', input('name', b.name))}${formRow('Amount', input('amount', b.amount, 'number'))}${formRow('Due day', input('dueDay', b.dueDay, 'number'))}`;
  openModal('Edit Bill', body, (d) => {
    if (d.amount !== b.amount) b.history.push({ date: new Date().toISOString().slice(0, 10), amount: d.amount });
    Object.assign(b, d); closeModal(); rerender();
  });
}
function deleteBill(id) { STATE.bills = STATE.bills.filter(b => b.id !== id); rerender(); }
function openAddSub() {
  const body = `${formRow('Name', input('name'))}${formRow('Amount / mo', input('amount', 0, 'number'))}`;
  openModal('Add Subscription', body, (d) => { STATE.subscriptions.push({ id: uid(), name: d.name, amount: d.amount, cycle: 'monthly', category: 'Subscriptions', autopay: false, priceHistory: [{ date: new Date().toISOString().slice(0, 10), amount: d.amount }] }); closeModal(); rerender(); });
}
function deleteSub(id) { STATE.subscriptions = STATE.subscriptions.filter(s2 => s2.id !== id); rerender(); }
function bumpSubPrice(id) {
  const sub = STATE.subscriptions.find(x => x.id === id);
  const body = formRow('New price', input('amount', sub.amount, 'number'));
  openModal('Update price', body, (d) => { sub.priceHistory.push({ date: new Date().toISOString().slice(0, 10), amount: d.amount }); sub.amount = d.amount; closeModal(); rerender(); }, 'Update');
}

// ===================== INVESTMENTS =====================

function pageInvest(s) {
  const perf = investmentPerformance(s);
  const alloc = assetAllocation(s);
  const retireProjection = retirementProjection(s);
  return `
  <div class="section-title">Investment Portfolio <button class="btn-secondary sm" onclick="openAddInvestment()">+ Holding</button></div>
  <div class="grid-4">
    <div class="stat-card"><div class="stat-label">Portfolio Value</div><div class="stat-value">${money(investmentValue(s))}</div></div>
    <div class="stat-card"><div class="stat-label">Today</div><div class="stat-value ${perf.day >= 0 ? 'up' : 'down'}">${perf.day.toFixed(2)}%</div></div>
    <div class="stat-card"><div class="stat-label">This Month</div><div class="stat-value ${perf.month >= 0 ? 'up' : 'down'}">${perf.month.toFixed(2)}%</div></div>
    <div class="stat-card"><div class="stat-label">This Year</div><div class="stat-value ${perf.year >= 0 ? 'up' : 'down'}">${perf.year.toFixed(2)}%</div></div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Holdings</div>
      ${s.investments.map(inv => `<div class="inv-row"><div><div class="inv-name">${escapeHtml(inv.name)}</div><div class="inv-ticker">${inv.ticker} · ${inv.shares} sh</div></div><div class="inv-value"><div class="inv-amount">${money(inv.shares * inv.price)}</div><div class="row-actions"><button class="link-btn" onclick="openEditInvestment('${inv.id}')">Edit</button><button class="link-btn danger" onclick="deleteInvestment('${inv.id}')">✕</button></div></div></div>`).join('') || '<div class="empty">No holdings yet.</div>'}
      <div class="row-line"><span>Risk score</span><input type="range" min="1" max="10" value="${s.riskScore}" oninput="setRisk(this.value)"> <b>${s.riskScore}/10</b></div>
    </div>
    <div class="card"><div class="card-title">Asset Allocation</div>${alloc.length ? svgDonut(alloc.map(a => ({ name: a.name, pct: a.pct }))) : '<div class="empty">Add holdings to see allocation.</div>'}</div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Dividends <button class="btn-secondary sm" onclick="openAddDividend()">+ Log</button></div>
      ${s.dividends.slice(0, 10).map(d => `<div class="bill-row"><div class="bill-name">${d.date}</div><div class="bill-amount up">+${money(d.amount)}</div></div>`).join('') || '<div class="empty">No dividends logged yet.</div>'}
      <div class="row-line">Total received: <b>${money(s.dividends.reduce((a, d) => a + d.amount, 0))}</b></div>
    </div>
    <div class="card">
      <div class="card-title">Retirement Progress</div>
      ${progress((s.retirement.current / s.retirement.target) * 100, 'fill-purple')}
      <div class="goal-amounts"><span>${money(s.retirement.current)}</span><span>Target: ${money(s.retirement.target)} by age ${s.retirement.targetAge}</span></div>
      <div class="row-line">Projected at target age (7% growth, current contributions): <b>${money(retireProjection)}</b></div>
    </div>
  </div>`;
}
function retirementProjection(s) {
  const years = Math.max(0, s.retirement.targetAge - s.retirement.currentAge);
  const monthlyContribution = Math.max(0, monthlyIncomeEstimate(s) * 0.05);
  const monthlyRate = 0.07 / 12;
  let val = s.retirement.current + investmentValue(s);
  for (let m = 0; m < years * 12; m++) val = val * (1 + monthlyRate) + monthlyContribution;
  return val;
}
function setRisk(v) { STATE.riskScore = +v; save(); }
function openAddInvestment() {
  const body = `${formRow('Name', input('name'))}${formRow('Ticker', input('ticker'))}${formRow('Shares', input('shares', 1, 'number', 'step="0.0001"'))}${formRow('Price per share', input('price', 100, 'number'))}`;
  openModal('Add Holding', body, (d) => { STATE.investments.push({ id: uid(), ...d, history: genHistory(d.price * 0.9, d.price) }); awardXP(STATE, 10, 'invest'); closeModal(); rerender(); });
}
function openEditInvestment(id) {
  const inv = STATE.investments.find(x => x.id === id);
  const body = `${formRow('Shares', input('shares', inv.shares, 'number', 'step="0.0001"'))}${formRow('Current price', input('price', inv.price, 'number'))}`;
  openModal('Edit Holding', body, (d) => { Object.assign(inv, d); closeModal(); rerender(); });
}
function deleteInvestment(id) { STATE.investments = STATE.investments.filter(i => i.id !== id); rerender(); }
function openAddDividend() {
  const body = formRow('Amount', input('amount', 5, 'number'));
  openModal('Log Dividend', body, (d) => { STATE.dividends.unshift({ id: uid(), amount: d.amount, date: new Date().toISOString().slice(0, 10) }); closeModal(); rerender(); });
}

// ===================== SAVINGS =====================

function pageSavings(s) {
  return `
  <div class="section-title">Savings & Sinking Funds</div>
  <div class="stat-card" style="margin-bottom:16px"><div class="stat-label">Total Saved</div><div class="stat-value" style="color:var(--accent)">${money(totalSavings(s))}</div></div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Emergency Fund <button class="btn-secondary sm" onclick="contributeEmergency()">+ Add</button></div>
      ${progress((s.emergencyFund.current / s.emergencyFund.target) * 100, 'fill-red')}
      <div class="goal-amounts"><span>${money(s.emergencyFund.current)}</span><span>Target: ${money(s.emergencyFund.target)}</span></div>
      <div class="row-line">Covers ~${(s.emergencyFund.current / Math.max(1, monthlyExpensesEstimate(s))).toFixed(1)} months of expenses</div>
    </div>
    <div class="card">
      <div class="card-title">Sinking Funds <button class="btn-secondary sm" onclick="openAddSinking()">+ Fund</button></div>
      ${s.sinkingFunds.map(f => `<div class="bill-row"><div class="bill-name">${f.icon} ${escapeHtml(f.name)}</div><div style="text-align:right"><div class="bill-amount up">${money(f.balance)}</div><div class="row-actions"><button class="link-btn" onclick="contributeSinking('${f.id}')">+ Add</button><button class="link-btn danger" onclick="deleteSinking('${f.id}')">✕</button></div></div></div>`).join('') || '<div class="empty">No sinking funds yet.</div>'}
    </div>
  </div>
  <div class="card"><div class="card-title">Recent Milestones</div>
    ${s.goals.flatMap(g => g.milestonesHit.map(m => `<div class="bill-row"><div>${g.icon} ${escapeHtml(g.name)}</div><div class="badge">${m}% reached</div></div>`)).slice(-6).reverse().join('') || '<div class="empty">No milestones yet — keep saving!</div>'}
  </div>`;
}
function contributeEmergency() {
  const body = formRow('Amount to add', input('amount', 25, 'number'));
  openModal('Add to Emergency Fund', body, (d) => { STATE.emergencyFund.current += d.amount; checkBadges(STATE); closeModal(); rerender(); }, 'Add');
}
function openAddSinking() {
  const body = `${formRow('Name', input('name'))}${formRow('Icon', input('icon', '💰'))}${formRow('Starting balance', input('balance', 0, 'number'))}${formRow('Monthly contribution', input('monthlyContribution', 20, 'number'))}`;
  openModal('Add Sinking Fund', body, (d) => { STATE.sinkingFunds.push({ id: uid(), ...d }); closeModal(); rerender(); });
}
function contributeSinking(id) {
  const f = STATE.sinkingFunds.find(x => x.id === id);
  const body = formRow('Amount to add', input('amount', f.monthlyContribution, 'number'));
  openModal(`Add to ${f.name}`, body, (d) => { f.balance += d.amount; checkBadges(STATE); closeModal(); rerender(); }, 'Add');
}
function deleteSinking(id) { STATE.sinkingFunds = STATE.sinkingFunds.filter(f => f.id !== id); rerender(); }

// ===================== AI COACH =====================

function financialSnapshot(s) {
  const b = budgetSummary(s);
  return {
    cashAvailable: +totalCash(s).toFixed(2), safeToday: +b.safeToday.toFixed(2), totalSavings: +totalSavings(s).toFixed(2),
    investments: +investmentValue(s).toFixed(2), netWorth: +netWorth(s).toFixed(2), healthScore: healthScore(s),
    savingsRatePct: savingsRatePct(s), monthlyIncomeEstimate: +monthlyIncomeEstimate(s).toFixed(2),
    spentThisMonth: +spentThisMonth(s).toFixed(2), categories: s.categories.map(c => ({ name: c.name, budget: c.budget, spent: +spentThisMonth(s, c.name).toFixed(2) })),
    goals: s.goals.map(g => ({ name: g.name, current: g.current, target: g.target })), upcomingBills: upcomingBills(s, 14).map(b2 => ({ name: b2.name, amount: b2.amount, daysUntil: b2.daysUntil })),
    predictedNextMonth: predictNextMonth(s).total, currency: s.settings.currency
  };
}

function pageAI(s) {
  if (!aiMessages.length) aiMessages.push({ role: 'ai', text: `Hey ${escapeHtml(s.profile.name)} ${s.profile.avatar} Here's your snapshot: <b>${money(budgetSummary(s).safeToday)}</b> safe to spend today, health score <b>${healthScore(s)}/100</b>. Ask me anything about your money.` });
  return `
  <div class="section-title">AI Money Coach</div>
  <div class="ai-card">
    <div class="ai-header"><div class="ai-dot"></div><div class="ai-title">MoneyOS AI Coach — Online</div>${MoneyOSVoice.supported() ? '<button class="mic-btn" onclick="voiceAsk()" title="Ask by voice">🎤</button>' : ''}</div>
    <div id="ai-messages">${aiMessages.map(m => m.role === 'user' ? `<div style="text-align:right;margin-bottom:12px"><span class="chat-bubble user">${escapeHtml(m.text)}</span></div>` : `<div class="ai-message">${m.text}</div>`).join('')}</div>
    <div class="ai-chips">
      <div class="ai-chip" onclick="askAI('Where did my money go this month?')">Where did my money go?</div>
      <div class="ai-chip" onclick="askAI('How can I save more money?')">How to save more?</div>
      <div class="ai-chip" onclick="askAI('Predict my spending next month')">Predict next month</div>
      <div class="ai-chip" onclick="askAI('What budget adjustments should I make?')">Budget adjustments</div>
      <div class="ai-chip" onclick="askAI('What should I invest in?')">What to invest in?</div>
    </div>
    <div class="ai-input-row">
      <input class="ai-input" id="ai-user-input" placeholder="Ask your money coach anything..." onkeydown="if(event.key==='Enter')askAI()" />
      <button class="ai-send" id="ai-send-btn" onclick="askAI()">➤</button>
    </div>
    <div id="ai-loading" style="display:none;margin-top:10px;font-size:13px;color:var(--muted)">🤖 Thinking...</div>
  </div>`;
}
function voiceAsk() {
  MoneyOSVoice.listenOnce().then(text => askAI(text)).catch(e => notify(STATE, 'warn', e.message));
}
async function askAI(prefill) {
  const inputEl = document.getElementById('ai-user-input');
  const sendBtn = document.getElementById('ai-send-btn');
  const question = prefill || inputEl.value.trim();
  if (!question) return;
  inputEl.value = '';
  sendBtn.disabled = true;
  aiMessages.push({ role: 'user', text: question });
  renderPage();
  const loading = document.getElementById('ai-loading');
  loading.style.display = 'block';
  const msgs = document.getElementById('ai-messages');
  msgs.scrollTop = msgs.scrollHeight;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question, context: financialSnapshot(STATE), profileName: STATE.profile.name })
    });
    if (!res.ok) { const eb = await res.json().catch(() => ({})); throw new Error(eb.error || `Request failed (${res.status})`); }
    const data = await res.json();
    const reply = data.reply || "I couldn't come up with a response.";
    aiMessages.push({ role: 'ai', text: escapeHtml(reply).replace(/\n/g, '<br>') });
    MoneyOSVoice.speak(reply.replace(/[#*_`]/g, ''));
  } catch (e) {
    aiMessages.push({ role: 'ai', text: `<span style="color:var(--red)">${escapeHtml(e.message)}</span>` });
  } finally {
    loading.style.display = 'none';
    sendBtn.disabled = false;
    renderPage();
    document.getElementById('ai-messages').scrollTop = document.getElementById('ai-messages').scrollHeight;
  }
}

// ===================== ANALYTICS =====================

function pageAnalytics(s) {
  const months = [5, 4, 3, 2, 1, 0].map(k => { const d = new Date(); d.setMonth(d.getMonth() - k); return d.toISOString().slice(0, 7); });
  const spendSeries = months.map(m => ({ label: m.slice(5), value: monthTransactions(s, m).filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0) }));
  const incomeSeries = months.map(m => ({ label: m.slice(5), value: monthTransactions(s, m).filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0) }));
  const cf = cashFlow(s);
  return `
  <div class="section-title">Analytics & Trends</div>
  <div class="grid-2">
    <div class="card"><div class="card-title">Savings Rate</div><div class="stat-value" style="font-size:36px;color:var(--accent)">${savingsRatePct(s)}%</div>${progress(savingsRatePct(s), 'fill-green')}</div>
    <div class="card"><div class="card-title">Cash Flow (this month)</div>
      <div class="bill-row"><span>Income</span><span class="up">+${money(cf.income)}</span></div>
      <div class="bill-row"><span>Expenses</span><span class="down">-${money(cf.expenses)}</span></div>
      <div class="bill-row"><span><b>Net</b></span><span class="up"><b>${money(cf.net)}</b></span></div>
    </div>
  </div>
  <div class="card"><div class="card-title">Spending Trend — Last 6 Months</div>${svgBars(spendSeries.map(p => ({ ...p, color: 'var(--red)' })))}</div>
  <div class="card"><div class="card-title">Income Trend — Last 6 Months</div>${svgBars(incomeSeries.map(p => ({ ...p, color: 'var(--positive)' })))}</div>
  <div class="card"><div class="card-title">Net Worth Growth</div>${svgLine(s.netWorthHistory.map(h => ({ label: h.date.slice(5), value: h.value })).concat([{ label: 'Now', value: netWorth(s) }]))}</div>
  `;
}

// ===================== LIFE TIMELINE / GOAL SIMULATOR =====================

function computeProjection(startValue, years, monthlySavings, growthPct) {
  const monthlyRate = growthPct / 100 / 12;
  let val = startValue;
  const out = [{ year: 0, value: val }];
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) val = val * (1 + monthlyRate) + monthlySavings;
    out.push({ year: y, value: val });
  }
  return out;
}
function pageTimeline(s) {
  const start = netWorth(s);
  const defaultSavings = Math.max(0, monthlyIncomeEstimate(s) - monthlyExpensesEstimate(s));
  return `
  <div class="section-title">Life Timeline & Goal Simulator</div>
  <div class="alert alert-info">🔮 Adjust the sliders to see how spending, saving, and growth assumptions change your future.</div>
  <div class="card">
    <div class="row-line"><span>Monthly savings: <b id="sim-savings-val">${money(defaultSavings)}</b></span><input type="range" min="0" max="${Math.max(500, defaultSavings * 3)}" value="${defaultSavings}" oninput="updateSim(this.value, null)" id="sim-savings"></div>
    <div class="row-line"><span>Annual growth rate: <b id="sim-growth-val">7%</b></span><input type="range" min="0" max="15" value="7" oninput="updateSim(null, this.value)" id="sim-growth"></div>
    <div id="sim-chart">${svgLine(computeProjection(start, 20, defaultSavings, 7).filter(p => [0, 1, 5, 10, 20].includes(p.year)).map(p => ({ label: p.year === 0 ? 'Now' : p.year + 'y', value: p.value })))}</div>
  </div>
  <div class="card"><div class="card-title">Net Worth Projection</div><div id="sim-timeline">${timelineRows(computeProjection(start, 20, defaultSavings, 7))}</div></div>
  `;
}
function timelineRows(series) {
  const marks = [0, 1, 5, 10, 20];
  const max = Math.max(...series.map(p => p.value), 1);
  return marks.map(y => {
    const p = series.find(x => x.year === y);
    const pct = clamp((p.value / max) * 100, 2, 100);
    const label = y === 0 ? 'Now' : `${y} Year${y > 1 ? 's' : ''}`;
    return `<div class="timeline-row"><div class="timeline-year">${y === 0 ? 'Now' : "'" + (new Date().getFullYear() + y).toString().slice(2)}</div><div class="timeline-bar-wrap"><div class="timeline-label"><span>${label}</span><span style="color:var(--accent)">${money(p.value)}</span></div><div class="timeline-bar"><div class="timeline-fill fill-blue" style="width:${pct}%"></div></div></div></div>`;
  }).join('');
}
function updateSim(savings, growth) {
  const savingsEl = document.getElementById('sim-savings'), growthEl = document.getElementById('sim-growth');
  const sVal = savings !== null ? +savings : +savingsEl.value;
  const gVal = growth !== null ? +growth : +growthEl.value;
  document.getElementById('sim-savings-val').textContent = money(sVal);
  document.getElementById('sim-growth-val').textContent = gVal + '%';
  const series = computeProjection(netWorth(STATE), 20, sVal, gVal);
  document.getElementById('sim-chart').innerHTML = svgLine(series.filter(p => [0, 1, 5, 10, 20].includes(p.year)).map(p => ({ label: p.year === 0 ? 'Now' : p.year + 'y', value: p.value })));
  document.getElementById('sim-timeline').innerHTML = timelineRows(series);
}

// ===================== REPORTS =====================

function computeReport(s) {
  const cf = cashFlow(s);
  return {
    period: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    income: cf.income, expenses: cf.expenses, net: cf.net, savingsRate: savingsRatePct(s),
    netWorth: netWorth(s), netWorthChange: netWorth(s) - (s.netWorthHistory[s.netWorthHistory.length - 1]?.value || netWorth(s)),
    goalProgress: goalProgressAvg(s), healthScore: healthScore(s),
    topCategory: [...s.categories].sort((a, b) => spentThisMonth(s, b.name) - spentThisMonth(s, a.name))[0]?.name
  };
}
function pageReports(s) {
  const r = computeReport(s);
  return `
  <div class="section-title">Reports</div>
  <div class="card">
    <div class="card-title">${r.period} Summary</div>
    <div class="grid-3">
      <div class="stat-card"><div class="stat-label">Income</div><div class="stat-value up">${money(r.income)}</div></div>
      <div class="stat-card"><div class="stat-label">Expenses</div><div class="stat-value down">${money(r.expenses)}</div></div>
      <div class="stat-card"><div class="stat-label">Net</div><div class="stat-value">${money(r.net)}</div></div>
    </div>
    <div class="row-line">Savings rate: <b>${r.savingsRate}%</b> · Net worth: <b>${money(r.netWorth)}</b> · Health score: <b>${r.healthScore}/100</b> · Top category: <b>${escapeHtml(r.topCategory || '—')}</b></div>
    <button class="btn-secondary" onclick="askAIReport()">🤖 Generate AI narrative</button>
    <div id="ai-report-narrative"></div>
  </div>`;
}
async function askAIReport() {
  const el = document.getElementById('ai-report-narrative');
  el.innerHTML = '<div style="margin-top:10px;color:var(--muted)">Writing your report...</div>';
  try {
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Write a short, motivating monthly financial report narrative from this data.', context: { ...financialSnapshot(STATE), report: computeReport(STATE) }, profileName: STATE.profile.name }) });
    const data = await res.json();
    el.innerHTML = `<div class="ai-message" style="margin-top:10px">${escapeHtml(data.reply || 'No response.').replace(/\n/g, '<br>')}</div>`;
  } catch { el.innerHTML = '<div style="color:var(--red)">Could not reach the AI coach.</div>'; }
}

// ===================== FAMILY & BUSINESS =====================

function pageFamily(s) {
  return `
  <div class="section-title">Family & Business</div>
  <div class="card">
    <div class="card-title">Mode</div>
    ${selectHtml('mode', [{ value: 'personal', label: 'Personal only' }, { value: 'family', label: 'Family (shared budget)' }, { value: 'business', label: 'Business + Personal' }], s.profile.mode).replace('<select', '<select onchange="setMode(this.value)"')}
  </div>
  <div class="card">
    <div class="card-title">Household / Team Members <button class="btn-secondary sm" onclick="openAddMember()">+ Member</button></div>
    ${s.members.map(m => `<div class="bill-row"><div class="bill-name">${escapeHtml(m.name)}</div><div style="display:flex;gap:8px;align-items:center"><span class="badge">${escapeHtml(m.role)}</span><button class="link-btn danger" onclick="deleteMember('${m.id}')">✕</button></div></div>`).join('')}
  </div>
  <div class="alert alert-info">💡 Tag transactions as "business" when adding them to keep business and personal spending separate — filter by tag on the Transactions page.</div>`;
}
function setMode(v) { STATE.profile.mode = v; rerender(); }
function openAddMember() {
  const body = `${formRow('Name', input('name'))}${formRow('Role', input('role', 'Member'))}`;
  openModal('Add Member', body, (d) => { STATE.members.push({ id: uid(), ...d }); closeModal(); rerender(); });
}
function deleteMember(id) { STATE.members = STATE.members.filter(m => m.id !== id); rerender(); }

// ===================== CREDIT & TAX =====================

const TAX_BRACKETS = {
  single: [[11925, 0.10], [48475, 0.12], [103350, 0.22], [197300, 0.24], [250525, 0.32], [626350, 0.35], [Infinity, 0.37]],
  mfj: [[23850, 0.10], [96950, 0.12], [206700, 0.22], [394600, 0.24], [501050, 0.32], [751600, 0.35], [Infinity, 0.37]],
  hoh: [[17000, 0.10], [64850, 0.12], [103350, 0.22], [197300, 0.24], [250500, 0.32], [626350, 0.35], [Infinity, 0.37]]
};
const STANDARD_DEDUCTION = { single: 15000, mfj: 30000, hoh: 22500 };
function estimateFederalTax(income, status, extraDeduction) {
  const taxable = Math.max(0, income - STANDARD_DEDUCTION[status] - (extraDeduction || 0));
  let tax = 0, lower = 0;
  for (const [cap, rate] of TAX_BRACKETS[status]) {
    const amountInBracket = Math.min(taxable, cap) - lower;
    if (amountInBracket > 0) tax += amountInBracket * rate;
    lower = cap;
    if (taxable <= cap) break;
  }
  return { taxable, tax, effectiveRate: income > 0 ? (tax / income) * 100 : 0 };
}
function pageCreditTax(s) {
  const latest = s.creditScore[s.creditScore.length - 1];
  const annualIncome = Math.round(monthlyIncomeEstimate(s) * 12);
  return `
  <div class="section-title">Credit & Tax</div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Credit Score <button class="btn-secondary sm" onclick="openAddCredit()">+ Log Score</button></div>
      <div class="stat-value" style="font-size:36px">${latest ? latest.score : '—'}</div>
      ${s.creditScore.length > 1 ? svgLine(s.creditScore.map(c => ({ label: c.date.slice(5), value: c.score }))) : '<div class="empty">Log a score from your bank/card app to start a trend.</div>'}
      <div class="alert alert-info" style="margin-top:10px">ℹ️ No credit bureau is connected — enter scores manually from your bank or card app. Real-time bureau data needs a paid provider (e.g. Experian/Equifax/TransUnion API).</div>
    </div>
    <div class="card">
      <div class="card-title">Tax Estimate</div>
      <div id="tax-form">
        ${formRow('Filing status', selectHtml('status', [{ value: 'single', label: 'Single' }, { value: 'mfj', label: 'Married filing jointly' }, { value: 'hoh', label: 'Head of household' }], 'single'))}
        ${formRow('Annual income', input('income', annualIncome, 'number'))}
        ${formRow('Extra deductions', input('deduction', 0, 'number'))}
      </div>
      <button class="btn-secondary" onclick="calcTax()">Estimate</button>
      <div id="tax-result"></div>
      <div class="alert alert-warn" style="margin-top:10px">⚠️ Rough estimate using approximate current federal brackets — not tax advice.</div>
    </div>
  </div>`;
}
function openAddCredit() {
  const body = formRow('Score', input('score', 700, 'number'));
  openModal('Log Credit Score', body, (d) => { STATE.creditScore.push({ date: new Date().toISOString().slice(0, 10), score: d.score }); closeModal(); rerender(); });
}
function calcTax() {
  const form = document.getElementById('tax-form');
  const data = readForm(form);
  const r = estimateFederalTax(data.income, data.status, data.deduction);
  document.getElementById('tax-result').innerHTML = `<div class="row-line">Taxable income: <b>${money(r.taxable)}</b></div><div class="row-line">Estimated federal tax: <b>${money(r.tax)}</b></div><div class="row-line">Effective rate: <b>${r.effectiveRate.toFixed(1)}%</b></div>`;
}

// ===================== JOURNAL =====================

function pageJournal(s) {
  return `
  <div class="section-title">Financial Journal <button class="btn-secondary sm" onclick="openAddJournal()">+ Entry</button></div>
  ${[...s.journal].reverse().map(j => `<div class="card" style="margin-bottom:10px"><div class="card-title">${j.date} ${j.mood}</div><div>${escapeHtml(j.text)}</div><div class="row-actions"><button class="link-btn danger" onclick="deleteJournal('${j.id}')">Delete</button></div></div>`).join('') || '<div class="empty">No journal entries yet. Reflect on a money win or worry.</div>'}
  `;
}
function openAddJournal() {
  const body = `${formRow('Mood', selectHtml('mood', [{ value: '😊', label: '😊 Good' }, { value: '😐', label: '😐 Neutral' }, { value: '😟', label: '😟 Stressed' }], '😊'))}${formRow('Entry', `<textarea data-field="text" rows="4"></textarea>`)}`;
  openModal('New Journal Entry', body, (d) => { STATE.journal.push({ id: uid(), date: new Date().toISOString().slice(0, 10), mood: d.mood, text: d.text }); closeModal(); rerender(); });
}
function deleteJournal(id) { STATE.journal = STATE.journal.filter(j => j.id !== id); rerender(); }

// ===================== RECEIPTS =====================

function pageReceipts(s) {
  return `
  <div class="section-title">Receipt Scanner</div>
  <div class="card">
    <div class="card-title">Upload a Receipt</div>
    <input type="file" accept="image/*" id="receipt-file" onchange="scanReceipt()" />
    <div id="receipt-status" style="margin-top:10px;color:var(--muted);font-size:13px"></div>
  </div>
  <div class="alert alert-info">🧾 The receipt image is sent to your MoneyOS server, which asks Claude (vision) to read the merchant, total, and date — nothing is stored beyond your browser session.</div>`;
}
async function scanReceipt() {
  const fileInput = document.getElementById('receipt-file');
  const status = document.getElementById('receipt-status');
  const file = fileInput.files[0];
  if (!file) return;
  status.textContent = 'Reading receipt...';
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result.split(',')[1];
    try {
      const res = await fetch('/api/scan-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64, mediaType: file.type }) });
      if (!res.ok) { const eb = await res.json().catch(() => ({})); throw new Error(eb.error || 'Scan failed'); }
      const data = await res.json();
      status.textContent = 'Review and confirm below.';
      openAddTransaction({ amount: data.amount, note: data.merchant, category: data.category, type: 'expense' });
    } catch (e) {
      status.innerHTML = `<span style="color:var(--red)">${escapeHtml(e.message)}</span>`;
    }
  };
  reader.readAsDataURL(file);
}

// ===================== AUTOMATION =====================

function pageAutomation(s) {
  return `
  <div class="section-title">Automation</div>
  <div class="card">
    <div class="card-title">Connect a Bank Account</div>
    <div class="alert alert-warn">⚠️ Real bank sync needs a licensed aggregator (e.g. Plaid) with its own API keys and a backend endpoint — that's not wired up here. Use manual accounts below instead.</div>
    <button class="btn-secondary" onclick="openAddAccount()">+ Add Manual Account</button>
    ${s.accounts.map(a => `<div class="bill-row"><div class="bill-name">${escapeHtml(a.name)} <span class="badge">${a.type}</span></div><div style="display:flex;gap:8px;align-items:center"><span class="bill-amount">${money(a.balance)}</span><button class="link-btn danger" onclick="deleteAccount('${a.id}')">✕</button></div></div>`).join('')}
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Auto-Invest</div>
      <label class="switch"><input type="checkbox" ${s.automation.autoInvest.enabled ? 'checked' : ''} onchange="toggleAutoInvest(this.checked)"><span>Enabled</span></label>
      ${formRow('Amount', input('ai_amount', s.automation.autoInvest.amount, 'number'))}
      ${formRow('Cadence', selectHtml('ai_cadence', CADENCES, s.automation.autoInvest.cadence))}
      <button class="btn-secondary sm" onclick="saveAutoInvest()">Save</button>
    </div>
    <div class="card">
      <div class="card-title">Auto-Save</div>
      <label class="switch"><input type="checkbox" ${s.automation.autoSave.enabled ? 'checked' : ''} onchange="toggleAutoSave(this.checked)"><span>Enabled</span></label>
      ${formRow('% of each income transaction', input('as_pct', s.automation.autoSave.percent, 'number'))}
      ${formRow('Target goal', selectHtml('as_goal', [{ value: '', label: 'Emergency Fund' }, ...s.goals.map(g => ({ value: g.id, label: g.name }))], s.automation.autoSave.targetGoalId))}
      <button class="btn-secondary sm" onclick="saveAutoSave()">Save</button>
    </div>
  </div>
  <div class="card">
    <div class="card-title">Smart Rules (auto-categorize is always on) <button class="btn-secondary sm" onclick="openAddRule()">+ Rule</button></div>
    ${s.automation.smartRules.map(r => `<div class="bill-row"><div>If <b>${escapeHtml(r.ifCategory)}</b> ${r.op} ${money(r.amount)} → ${r.action}</div><button class="link-btn danger" onclick="deleteRule('${r.id}')">✕</button></div>`).join('') || '<div class="empty">No smart rules yet.</div>'}
  </div>
  <div class="alert alert-info">🤖 Bills marked "Auto-pay" on the Expenses page are simulated automatically when their due date arrives.</div>`;
}
function openAddAccount() {
  const body = `${formRow('Name', input('name'))}${formRow('Type', selectHtml('type', [{ value: 'checking', label: 'Checking' }, { value: 'cash', label: 'Cash' }, { value: 'savings', label: 'Savings' }], 'checking'))}${formRow('Balance', input('balance', 0, 'number'))}`;
  openModal('Add Account', body, (d) => { STATE.accounts.push({ id: uid(), ...d, business: false }); closeModal(); rerender(); });
}
function deleteAccount(id) { STATE.accounts = STATE.accounts.filter(a => a.id !== id); rerender(); }
function toggleAutoInvest(v) { STATE.automation.autoInvest.enabled = v; save(); }
function saveAutoInvest() { const d = readForm(document.querySelector('.card')); STATE.automation.autoInvest.amount = d.ai_amount ?? STATE.automation.autoInvest.amount; STATE.automation.autoInvest.cadence = d.ai_cadence ?? STATE.automation.autoInvest.cadence; notify(STATE, 'good', 'Auto-invest rule saved.'); rerender(); }
function toggleAutoSave(v) { STATE.automation.autoSave.enabled = v; save(); }
function saveAutoSave() { rerender(); }
function openAddRule() {
  const cats = STATE.categories.map(c => ({ value: c.name, label: c.name }));
  const body = `${formRow('Category', selectHtml('ifCategory', cats, cats[0]?.value))}${formRow('Operator', selectHtml('op', [{ value: '>', label: 'greater than' }, { value: '>=', label: 'greater or equal' }], '>'))}${formRow('Amount', input('amount', 50, 'number'))}`;
  openModal('Add Smart Rule', body, (d) => { STATE.automation.smartRules.push({ id: uid(), ...d, action: 'alert' }); closeModal(); rerender(); });
}
function deleteRule(id) { STATE.automation.smartRules = STATE.automation.smartRules.filter(r => r.id !== id); rerender(); }

// ===================== SECURITY =====================

function pageSecurity(s) {
  const flags = detectUnusual(s);
  return `
  <div class="section-title">Security</div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Biometric Unlock (Face ID / Touch ID / Windows Hello)</div>
      <p class="muted-text">Uses your device's real platform authenticator. Requires HTTPS and a supported browser.</p>
      <label class="switch"><input type="checkbox" ${s.security.biometricEnabled ? 'checked' : ''} onchange="toggleBiometric(this.checked)"><span>${s.security.biometricEnabled ? 'Enabled' : 'Disabled'}</span></label>
    </div>
    <div class="card">
      <div class="card-title">App Lock (passphrase encryption)</div>
      <p class="muted-text">Encrypts your local data with AES-256-GCM, key derived via PBKDF2 from your passphrase.</p>
      <label class="switch"><input type="checkbox" ${s.security.passphraseEnabled ? 'checked' : ''} onchange="togglePassphrase(this.checked)"><span>${s.security.passphraseEnabled ? 'Enabled' : 'Disabled'}</span></label>
    </div>
    <div class="card">
      <div class="card-title">Two-Factor Authentication (TOTP)</div>
      <p class="muted-text">Works with Google Authenticator, Authy, 1Password, etc.</p>
      <label class="switch"><input type="checkbox" ${s.security.totpEnabled ? 'checked' : ''} onchange="toggleTotp(this.checked)"><span>${s.security.totpEnabled ? 'Enabled' : 'Disabled'}</span></label>
    </div>
    <div class="card">
      <div class="card-title">Fraud / Unusual Activity Alerts</div>
      ${flags.length ? flags.map(f => `<div class="alert alert-warn">🚨 ${escapeHtml(f.category)} transaction of ${money(f.amount)} vs usual ${money(f.mean)}</div>`).join('') : '<div class="empty">No unusual activity detected.</div>'}
    </div>
  </div>
  <div class="alert alert-info">🔒 This is a client-only demo: WebAuthn here proves your device's biometric sensor approved, but without a server there's no relying-party signature verification. Passphrase encryption (AES-256-GCM + PBKDF2) is real. For production, pair WebAuthn/TOTP with a real backend that issues challenges and verifies them server-side.</div>`;
}
async function toggleBiometric(v) {
  if (v) {
    if (!MoneyOSWebAuthn.supported()) { notify(STATE, 'warn', 'WebAuthn not supported in this browser.'); rerender(); return; }
    try {
      const credId = await MoneyOSWebAuthn.register(STATE.profile.name);
      STATE.security.biometricEnabled = true; STATE.security.biometricCredId = credId;
      notify(STATE, 'good', 'Biometric unlock registered.');
    } catch (e) { notify(STATE, 'warn', 'Biometric registration cancelled or failed.'); }
  } else { STATE.security.biometricEnabled = false; STATE.security.biometricCredId = ''; }
  rerender();
}
function togglePassphrase(v) {
  if (v) {
    const pass = prompt('Set an app lock passphrase (remember it — it cannot be recovered):');
    if (!pass) { rerender(); return; }
    window.__moneyosPass = pass;
    STATE.security.passphraseEnabled = true;
    notify(STATE, 'good', 'App lock enabled. Your data is now encrypted at rest.');
  } else { STATE.security.passphraseEnabled = false; window.__moneyosPass = null; }
  rerender();
}
function toggleTotp(v) {
  if (v) {
    const secret = MoneyOSCrypto.randomBase32Secret();
    STATE.security.totpSecret = secret;
    const uri = MoneyOSCrypto.otpauthUri(secret, STATE.profile.name);
    const body = `<p>Scan or manually enter this key in your authenticator app:</p><code class="totp-secret">${secret}</code><p class="muted-text" style="word-break:break-all">${uri}</p>${formRow('Enter 6-digit code to confirm', input('code', ''))}`;
    openModal('Set up 2FA', body, async (d) => {
      const ok = await MoneyOSCrypto.verifyTotp(secret, d.code);
      if (ok) { STATE.security.totpEnabled = true; notify(STATE, 'good', '2FA enabled.'); closeModal(); rerender(); }
      else { alert('Code did not match — try again.'); }
    }, 'Confirm');
  } else { STATE.security.totpEnabled = false; STATE.security.totpSecret = ''; rerender(); }
}

// ===================== REWARDS (GAMIFICATION) =====================

function pageGame(s) {
  const g = s.gamification;
  const xpForLevel = g.level * 500;
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const now = new Date(); const dow = (now.getDay() + 6) % 7;
  return `
  <div class="section-title">Rewards & Challenges</div>
  <div class="card" style="margin-bottom:16px">
    <div class="xp-header"><div><div style="font-weight:600">${escapeHtml(s.profile.name)} — Money Builder</div><div class="muted-text">${g.xp} XP total</div></div><div class="level-badge">LVL ${g.level}</div></div>
    ${progress((g.xp % 500) / 5, 'fill-purple')}
    <div class="muted-text" style="margin-top:6px">${g.xp % 500} / 500 XP to Level ${g.level + 1}</div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Daily Streak</div>
    <div style="font-size:24px;font-weight:700;color:var(--accent)">🔥 ${g.streak.count} Days</div>
    <div class="streak-row">${days.map((d, i) => `<div class="streak-day ${i < dow ? (Object.keys(g.streak.history).length ? 'streak-done' : 'streak-miss') : i === dow ? 'streak-today' : 'streak-miss'}">${d}</div>`).join('')}</div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Weekly Missions</div>
    ${g.missions.map(m => `<div class="bill-row"><div>${m.done ? '✅' : '⬜'} ${escapeHtml(m.text)}</div><div class="muted-text">${m.progress}/${m.target}</div></div>`).join('')}
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Badges Earned</div>
    <div class="badges-grid">${BADGE_DEFS.map(b => `<div class="badge-item ${g.badges.includes(b.id) ? '' : 'locked'}"><div class="badge-emoji">${b.emoji}</div><div class="badge-name">${b.name}</div></div>`).join('')}</div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Friends Leaderboard <span class="badge">local demo</span></div>
    <div class="muted-text" style="margin-bottom:8px">A real leaderboard needs friend accounts on a shared backend. Shown here for illustration.</div>
    ${[{ name: s.profile.name, xp: g.xp }, { name: 'Jordan', xp: 1980 }, { name: 'Sam', xp: 3120 }].sort((a, b) => b.xp - a.xp).map((p, i) => `<div class="bill-row"><div>#${i + 1} ${escapeHtml(p.name)}</div><div class="bill-amount">${p.xp} XP</div></div>`).join('')}
  </div>
  <div class="card">
    <div class="card-title">Themes & Avatars</div>
    <div class="chip-row">${THEMES.map(t => `<div class="ai-chip ${g.level < t.level ? 'locked' : ''}" onclick="${g.level >= t.level ? `setTheme('${t.id}')` : ''}">${t.name}${g.level < t.level ? ' 🔒 Lvl ' + t.level : ''}</div>`).join('')}</div>
    <div class="chip-row" style="margin-top:8px">${AVATARS.map(a => `<div class="ai-chip ${g.level < a.level ? 'locked' : ''}" onclick="${g.level >= a.level ? `setAvatar('${a.id}')` : ''}">${a.id}${g.level < a.level ? ' 🔒 Lvl ' + a.level : ''}</div>`).join('')}</div>
  </div>`;
}
function setTheme(id) { STATE.profile.theme = id; document.documentElement.setAttribute('data-theme', id); rerender(); }
function setAvatar(id) { STATE.profile.avatar = id; rerender(); }

// ===================== SETTINGS =====================

function pageSettings(s) {
  return `
  <div class="section-title">Settings</div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Profile</div>
      ${formRow('Name', input('name', s.profile.name))}
      <button class="btn-secondary sm" onclick="saveProfile()">Save</button>
    </div>
    <div class="card">
      <div class="card-title">Currency</div>
      ${selectHtml('currency', Object.keys(CURRENCIES).map(c => ({ value: c, label: c })), s.settings.currency).replace('<select', '<select onchange="setCurrency(this.value)"')}
      <div class="muted-text" style="margin-top:8px">Static approximate FX rates for demo purposes — wire a live FX API for production accuracy.</div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">Dashboard Cards</div>
    ${s.dashboardLayout.map((id, i) => `<div class="bill-row"><div>${id}</div><div class="row-actions"><button class="link-btn" onclick="moveCard(${i},-1)">↑</button><button class="link-btn" onclick="moveCard(${i},1)">↓</button></div></div>`).join('')}
  </div>
  <div class="card">
    <div class="card-title">Notification Preferences</div>
    ${Object.entries(s.settings.notifPrefs).map(([k, v]) => `<label class="switch"><input type="checkbox" ${v ? 'checked' : ''} onchange="toggleNotifPref('${k}', this.checked)"><span>${k}</span></label>`).join('')}
  </div>
  <div class="card">
    <div class="card-title">Offline & Install</div>
    <div class="muted-text">Your money data works fully offline — only the AI Coach and receipt scanner need a connection. <span id="online-status"></span></div>
    <button class="btn-secondary sm" id="install-btn" style="display:none" onclick="installPWA()">📲 Install MoneyOS</button>
  </div>
  <div class="card">
    <div class="card-title">Data</div>
    <button class="btn-secondary sm" onclick="exportData()">⬇️ Export data</button>
    <button class="btn-secondary sm" style="color:var(--red)" onclick="resetData()">🗑️ Reset all data</button>
  </div>`;
}
function saveProfile() { const d = readForm(document.querySelector('.card')); STATE.profile.name = d.name || STATE.profile.name; rerender(); }
function setCurrency(v) { STATE.settings.currency = v; rerender(); }
function moveCard(i, dir) {
  const arr = STATE.dashboardLayout;
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  rerender();
}
function toggleNotifPref(k, v) { STATE.settings.notifPrefs[k] = v; save(); }
function exportData() {
  const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'moneyos-data.json'; a.click();
}
function resetData() {
  if (confirm('This deletes all local MoneyOS data on this device. Continue?')) {
    localStorage.removeItem(STATE_KEY); localStorage.removeItem(LOCK_KEY);
    location.reload();
  }
}
