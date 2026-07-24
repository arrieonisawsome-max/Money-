/* MoneyOS — first-run onboarding wizard. No demo numbers: every figure
   here comes from what the user actually types in, and skipping a step
   just leaves that part at $0 for them to fill in later. */

let OB = null;

function runOnboarding(onComplete) {
  OB = { step: 0, name: '', incomes: [], cash: '', savings: '', investments: '', categories: [], onComplete };
  renderOnboardStep();
}

function renderOnboardStep() {
  document.getElementById('boot-gate').innerHTML = onboardStepHtml(OB.step);
}
function onboardStepHtml(step) {
  const dots = [0, 1, 2, 3, 4].map(i => `<span class="ob-dot ${i === step ? 'active' : ''}"></span>`).join('');
  const inner = [obStepWelcome, obStepIncome, obStepBalances, obStepBudget, obStepDone][step]();
  return `<div class="onboard-card"><div class="logo-text">MoneyOS</div><div class="ob-dots">${dots}</div>${inner}</div>`;
}
function obBack() { OB.step = Math.max(0, OB.step - 1); renderOnboardStep(); }

// Step 0 — name
function obStepWelcome() {
  return `
    <h2>Let's set up your Money OS.</h2>
    <p class="muted-text">No demo data, no guesswork — just your real numbers, plugged in by you. Takes about a minute, and you can change anything later.</p>
    ${formRow("What should we call you?", `<input id="ob-name" type="text" placeholder="Your name" value="${escapeHtml(OB.name)}" onkeydown="if(event.key==='Enter')obNext0()" />`)}
    <div class="ob-actions"><span></span><button class="btn-primary" onclick="obNext0()">Continue</button></div>
  `;
}
function obNext0() {
  OB.name = document.getElementById('ob-name').value.trim() || 'there';
  OB.step = 1; renderOnboardStep();
}

// Step 1 — income sources
function obStepIncome() {
  return `
    <h2>What income do you have coming in?</h2>
    <p class="muted-text">Add a job, side hustle, or any other income. MoneyOS remembers each amount so future paychecks log in one tap. Skip if you'd rather add this later.</p>
    <div id="ob-income-list">${OB.incomes.map((inc, i) => obIncomeRow(inc, i)).join('') || ''}</div>
    <button class="btn-secondary sm" onclick="obAddIncomeRow()">+ Add income source</button>
    <div class="ob-actions"><button class="btn-secondary" onclick="obBack()">Back</button><button class="btn-primary" onclick="obNext1()">Continue</button></div>
  `;
}
function obIncomeRow(inc, i) {
  return `<div class="ob-row">
    <input placeholder="Source (e.g. Job, Side hustle)" value="${escapeHtml(inc.source)}" oninput="OB.incomes[${i}].source=this.value" />
    <input type="number" placeholder="Amount per pay" value="${inc.amount || ''}" oninput="OB.incomes[${i}].amount=parseFloat(this.value)||0" />
    <select onchange="OB.incomes[${i}].cadence=this.value">${CADENCES.map(c => `<option value="${c.value}" ${c.value === inc.cadence ? 'selected' : ''}>${c.label}</option>`).join('')}</select>
    <button class="link-btn danger" onclick="obRemoveIncome(${i})">✕</button>
  </div>`;
}
function obAddIncomeRow() { OB.incomes.push({ source: '', type: 'w2', amount: 0, cadence: 'biweekly', nextDate: '' }); renderOnboardStep(); }
function obRemoveIncome(i) { OB.incomes.splice(i, 1); renderOnboardStep(); }
function obNext1() { OB.incomes = OB.incomes.filter(i => i.source.trim()); OB.step = 2; renderOnboardStep(); }

// Step 2 — starting balances
function obStepBalances() {
  return `
    <h2>Starting balances</h2>
    <p class="muted-text">Enter what you actually have right now, or leave blank and add it later.</p>
    ${formRow('Cash / checking', `<input id="ob-cash" type="number" placeholder="0" value="${OB.cash}" />`)}
    ${formRow('Current savings', `<input id="ob-savings" type="number" placeholder="0" value="${OB.savings}" />`)}
    ${formRow('Current investments value', `<input id="ob-investments" type="number" placeholder="0" value="${OB.investments}" />`)}
    <div class="ob-actions"><button class="btn-secondary" onclick="obBack()">Back</button><button class="btn-primary" onclick="obNext2()">Continue</button></div>
  `;
}
function obNext2() {
  OB.cash = document.getElementById('ob-cash').value;
  OB.savings = document.getElementById('ob-savings').value;
  OB.investments = document.getElementById('ob-investments').value;
  OB.step = 3; renderOnboardStep();
}

// Step 3 — budget categories
function obStepBudget() {
  const chips = CATEGORY_SUGGESTIONS.filter(sug => !OB.categories.some(c => c.name === sug.name))
    .map(sug => `<div class="ai-chip" onclick="obAddCategory('${sug.name}','${sug.icon}')">${sug.icon} ${sug.name}</div>`).join('');
  return `
    <h2>Set up a few budget categories</h2>
    <p class="muted-text">Tap a category to add it, then set a monthly limit. Optional — you can add these anytime from the Budget page instead.</p>
    <div class="chip-row">${chips || '<span class="muted-text">All suggestions added.</span>'}</div>
    <div id="ob-cat-list">${OB.categories.map((c, i) => obCategoryRow(c, i)).join('')}</div>
    <div class="ob-actions"><button class="btn-secondary" onclick="obBack()">Back</button><button class="btn-primary" onclick="obNext3()">Continue</button></div>
  `;
}
function obCategoryRow(c, i) {
  return `<div class="ob-row"><span style="flex:1">${c.icon} ${escapeHtml(c.name)}</span><input type="number" placeholder="Monthly limit" value="${c.budget || ''}" oninput="OB.categories[${i}].budget=parseFloat(this.value)||0" /><button class="link-btn danger" onclick="obRemoveCategory(${i})">✕</button></div>`;
}
function obAddCategory(name, icon) { OB.categories.push({ name, icon, budget: 0 }); renderOnboardStep(); }
function obRemoveCategory(i) { OB.categories.splice(i, 1); renderOnboardStep(); }
function obNext3() { OB.step = 4; renderOnboardStep(); }

// Step 4 — finish
function obStepDone() {
  return `
    <h2>You're set, ${escapeHtml(OB.name)}.</h2>
    <p class="muted-text">MoneyOS will remember every paycheck you log and update your whole picture in real time as you use it — no matter how much or how little is moving through your accounts.</p>
    <div class="ob-actions"><button class="btn-secondary" onclick="obBack()">Back</button><button class="btn-primary" onclick="obFinish()">Enter MoneyOS</button></div>
  `;
}
function obFinish() {
  const state = emptyState(OB.name);
  const step = { weekly: 7, biweekly: 14, monthly: 30, irregular: 0 };
  OB.incomes.forEach(inc => {
    const days = step[inc.cadence] || 0;
    state.income.push({
      id: uid(), source: inc.source, type: inc.type || 'other', amount: inc.amount || 0,
      cadence: inc.cadence || 'monthly', nextDate: days ? addDays(new Date(), days).toISOString().slice(0, 10) : ''
    });
  });
  const cash = parseFloat(OB.cash) || 0, savings = parseFloat(OB.savings) || 0, investments = parseFloat(OB.investments) || 0;
  if (cash > 0) state.accounts.push({ id: uid(), name: 'Checking', type: 'checking', balance: cash, business: false });
  if (savings > 0) state.accounts.push({ id: uid(), name: 'Savings', type: 'savings', balance: savings, business: false });
  if (investments > 0) state.investments.push({ id: uid(), name: 'Investment Portfolio', ticker: 'PORT', shares: 1, price: investments, history: genHistory(investments, investments) });
  OB.categories.forEach(c => { if (c.name) state.categories.push({ id: uid(), name: c.name, icon: c.icon, budget: c.budget || 0, rollover: false, rolloverBalance: 0 }); });
  state.profile.onboarded = true;
  OB.onComplete(state);
}
