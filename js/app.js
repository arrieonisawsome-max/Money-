/* MoneyOS — core application: state, calculations, rendering, all features. */

// ===================== Constants =====================

const STATE_KEY = 'moneyos_state_v1';
const LOCK_KEY = 'moneyos_locked_v1';

const CURRENCIES = {
  USD: { symbol: '$', rate: 1 },
  EUR: { symbol: '€', rate: 0.92 },
  GBP: { symbol: '£', rate: 0.79 },
  CAD: { symbol: 'CA$', rate: 1.36 },
  JPY: { symbol: '¥', rate: 157 },
  AUD: { symbol: 'A$', rate: 1.5 },
  MXN: { symbol: 'MX$', rate: 18.5 }
};
// NOTE: These FX rates are static/approximate for demo purposes.
// A production build should fetch live rates from an FX API.

const CATEGORY_KEYWORDS = {
  Housing: ['rent', 'mortgage', 'landlord', 'apartment'],
  'Food & Dining': ['restaurant', 'grocery', 'food', 'dining', 'coffee', 'doordash', 'ubereats', 'mcdonald', 'chipotle'],
  Transport: ['uber', 'lyft', 'gas', 'fuel', 'parking', 'transit', 'car payment'],
  'Fitness / Business': ['gym', 'client', 'training', 'equipment', 'supplement'],
  Subscriptions: ['netflix', 'spotify', 'subscription', 'membership', 'capcut', 'app store', 'prime'],
  Personal: ['clothes', 'haircut', 'personal', 'shopping'],
  Entertainment: ['movie', 'concert', 'game', 'entertainment']
};

const XP_RULES = { addTransaction: 10, hitBudgetGoal: 50, contributeGoal: 20, dailyOpen: 15, payBill: 5 };

const THEMES = [
  { id: 'light', name: 'MoneyOS Red (default)', level: 1 },
  { id: 'dark', name: 'Midnight Red', level: 3 },
  { id: 'mono', name: 'Pure Mono', level: 6 }
];
const AVATARS = [
  { id: '💪', level: 1 }, { id: '🚀', level: 2 }, { id: '🦁', level: 4 },
  { id: '🐉', level: 6 }, { id: '👑', level: 10 }
];

const BADGE_DEFS = [
  { id: 'first_save', name: 'First Save', emoji: '💰', check: s => s.goals.some(g => g.current > 0) || s.sinkingFunds.some(f => f.balance > 0) },
  { id: 'streak5', name: '5-Day Streak', emoji: '🔥', check: s => s.gamification.streak.count >= 5 },
  { id: 'budget_set', name: 'Budget Set', emoji: '📊', check: s => s.categories.length > 0 },
  { id: 'goal_maker', name: 'Goal Maker', emoji: '🎯', check: s => s.goals.length > 0 },
  { id: 'first_client', name: 'First Client', emoji: '💼', check: s => s.income.some(i => i.type === 'side' && i.amount > 0) },
  { id: 'five_k', name: '$5K Saved', emoji: '🚀', check: s => totalSavings(s) >= 5000 },
  { id: 'side_hustle', name: 'Side Hustle', emoji: '👑', check: s => s.income.filter(i => i.type === 'side').length >= 2 },
  { id: 'invested', name: 'First Investment', emoji: '📈', check: s => s.investments.length > 0 }
];

// ===================== Blank starting state =====================
// No demo numbers, no seeded transactions/goals/bills — a brand-new user
// starts at exactly $0 across the board and builds their own picture
// during onboarding (see js/onboarding.js) or by adding things themselves.

const CATEGORY_SUGGESTIONS = [
  { name: 'Housing', icon: '🏠' }, { name: 'Food & Dining', icon: '🍔' }, { name: 'Transport', icon: '🚗' },
  { name: 'Subscriptions', icon: '📱' }, { name: 'Personal', icon: '👔' }, { name: 'Entertainment', icon: '🎬' },
  { name: 'Fitness / Business', icon: '💪' }
];

function emptyState(name = 'there') {
  return {
    profile: { name, currency: 'USD', theme: 'light', avatar: '💪', mode: 'personal', onboarded: false },
    members: [{ id: uid(), name, role: 'Owner' }],
    accounts: [],
    transactions: [],
    categories: [],
    lastRolloverMonth: null,
    goals: [],
    sinkingFunds: [],
    emergencyFund: { target: 0, current: 0 },
    bills: [],
    subscriptions: [],
    income: [],
    investments: [],
    dividends: [],
    retirement: { target: 0, current: 0, targetAge: 65, currentAge: 25 },
    riskScore: 5,
    netWorthHistory: [],
    creditScore: [],
    journal: [],
    gamification: {
      xp: 0, level: 1, badges: [],
      streak: { count: 0, lastDate: null, history: {} },
      missions: [], missionsWeek: null
    },
    automation: {
      smartRules: [],
      autoInvest: { enabled: false, amount: 0, cadence: 'biweekly' },
      autoSave: { enabled: false, percent: 10, targetGoalId: '' }
    },
    security: { biometricEnabled: false, biometricCredId: '', passphraseEnabled: false, totpEnabled: false, totpSecret: '' },
    notifications: [],
    dashboardLayout: ['stats', 'categories', 'bills', 'networth'],
    settings: { currency: 'USD', notifPrefs: { overspend: true, bills: true, milestones: true, investing: true, weekly: true, monthly: true } }
  };
}

// Short synthetic price trend around a real entered price, used only as a
// chart baseline for a brand-new holding until enough real history builds up.
function genHistory(start, end) {
  const out = [];
  const days = 14;
  for (let i = days; i >= 0; i--) {
    const t = i / days;
    const price = start + (end - start) * (1 - t);
    const d = addDays(new Date(), -i);
    out.push({ date: d.toISOString().slice(0, 10), price: Math.max(0.01, +price.toFixed(2)) });
  }
  return out;
}

// Remembers what a paycheck actually was and rolls the source forward to
// the next expected date, so the app "learns" the user's real income.
function advanceIncomeSource(source, loggedAmount, fromDateStr) {
  source.amount = loggedAmount;
  const from = fromDateStr ? new Date(fromDateStr) : new Date();
  const step = { weekly: 7, biweekly: 14, monthly: 30, irregular: 0 }[source.cadence] || 0;
  source.nextDate = step ? addDays(from, step).toISOString().slice(0, 10) : source.nextDate;
}

// Captures one net-worth data point per calendar month of actual use,
// so the growth chart reflects this user's real trajectory over time.
function recordMonthlySnapshot(s) {
  const month = isoMonth(new Date().toISOString());
  const last = s.netWorthHistory[s.netWorthHistory.length - 1];
  if (!last || last.date !== month) {
    s.netWorthHistory.push({ date: month, value: netWorth(s) });
    if (s.netWorthHistory.length > 24) s.netWorthHistory.shift();
  } else {
    last.value = netWorth(s);
  }
}

// ===================== Utilities =====================

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function isoMonth(dateStr) { return dateStr.slice(0, 7); }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str ?? ''; return d.innerHTML; }
function isoWeek(d = new Date()) {
  const date = new Date(d); date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return date.getFullYear() + '-W' + (1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7));
}

function fmtMoney(amountUsd, currency) {
  const cur = CURRENCIES[currency] || CURRENCIES.USD;
  const val = amountUsd * cur.rate;
  const decimals = currency === 'JPY' ? 0 : 2;
  return cur.symbol + val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ===================== App state singleton =====================

let STATE = null;

function save() {
  if (STATE.security.passphraseEnabled && window.__moneyosPass) {
    MoneyOSCrypto.encryptJSON(STATE, window.__moneyosPass).then(blob => {
      localStorage.setItem(LOCK_KEY, JSON.stringify(blob));
      localStorage.removeItem(STATE_KEY);
    });
  } else {
    localStorage.setItem(STATE_KEY, JSON.stringify(STATE));
    localStorage.removeItem(LOCK_KEY);
  }
}

function money(amountUsd) { return fmtMoney(amountUsd, STATE.settings.currency); }

// ===================== Calculations =====================

function totalCash(s) { return s.accounts.filter(a => a.type === 'checking' || a.type === 'cash').reduce((a, b) => a + b.balance, 0); }
function totalSavings(s) {
  return s.goals.reduce((a, g) => a + g.current, 0) + s.sinkingFunds.reduce((a, f) => a + f.balance, 0) + s.emergencyFund.current +
    s.accounts.filter(a => a.type === 'savings').reduce((a, b) => a + b.balance, 0);
}
function investmentValue(s) { return s.investments.reduce((a, inv) => a + inv.shares * inv.price, 0); }
function totalDebt(s) { return s.goals.filter(g => g.type === 'debt').reduce((a, g) => a + Math.max(0, g.target - g.current), 0); }
function netWorth(s) { return totalCash(s) + totalSavings(s) + investmentValue(s) - totalDebt(s); }

function monthTransactions(s, monthStr = isoMonth(new Date().toISOString())) {
  return s.transactions.filter(t => isoMonth(t.date) === monthStr);
}
function spentThisMonth(s, category) {
  const m = isoMonth(new Date().toISOString());
  return monthTransactions(s, m).filter(t => t.type === 'expense' && (!category || t.category === category)).reduce((a, t) => a + t.amount, 0);
}
function spentToday(s) {
  const today = new Date().toISOString().slice(0, 10);
  return s.transactions.filter(t => t.date === today && t.type === 'expense').reduce((a, t) => a + t.amount, 0);
}
function spentThisWeek(s) {
  const now = new Date(); const day = (now.getDay() + 6) % 7;
  const monday = addDays(now, -day).toISOString().slice(0, 10);
  return s.transactions.filter(t => t.date >= monday && t.type === 'expense').reduce((a, t) => a + t.amount, 0);
}
function monthlyBudgetTotal(s) { return s.categories.reduce((a, c) => a + c.budget, 0); }
function rolloverTotal(s) { return s.categories.reduce((a, c) => a + (c.rolloverBalance || 0), 0); }

function budgetSummary(s) {
  const now = new Date();
  const dim = daysInMonth(now.getFullYear(), now.getMonth());
  const dayOfMonth = now.getDate();
  const daysRemaining = dim - dayOfMonth + 1;
  const budgetTotal = monthlyBudgetTotal(s) + rolloverTotal(s);
  const spentMonth = spentThisMonth(s);
  const leftMonth = budgetTotal - spentMonth;
  const safeToday = clamp(leftMonth / Math.max(1, daysRemaining), 0, leftMonth);
  const weeklyAllowance = monthlyBudgetTotal(s) / 4.345;
  const leftWeek = weeklyAllowance - spentThisWeek(s);
  return { leftMonth, safeToday, leftWeek, spentMonth, budgetTotal, daysRemaining };
}

function upcomingBills(s, withinDays = 14) {
  const now = new Date(); const dom = now.getDate();
  return s.bills.map(b => {
    let diff = b.dueDay - dom;
    if (diff < 0) diff += daysInMonth(now.getFullYear(), now.getMonth());
    return { ...b, daysUntil: diff };
  }).filter(b => b.daysUntil <= withinDays).sort((a, b) => a.daysUntil - b.daysUntil);
}
function billsCoveredPct(s) {
  const due = upcomingBills(s, 14).reduce((a, b) => a + b.amount, 0);
  if (due === 0) return 100;
  return clamp(Math.round((totalCash(s) / due) * 100), 0, 100);
}

function goalProgressAvg(s) {
  if (!s.goals.length) return 0;
  return Math.round(s.goals.reduce((a, g) => a + clamp((g.current / g.target) * 100, 0, 100), 0) / s.goals.length);
}

function healthScore(s) {
  const savingsRate = savingsRatePct(s);
  const emergencyMonths = s.emergencyFund.current / Math.max(1, monthlyExpensesEstimate(s));
  const debtRatio = totalDebt(s) / Math.max(1, netWorth(s) + totalDebt(s));
  const budgetAdherence = 1 - clamp(spentThisMonth(s) / Math.max(1, monthlyBudgetTotal(s)) - 1, 0, 1);
  const goalProg = goalProgressAvg(s) / 100;

  const score =
    clamp(savingsRate / 25, 0, 1) * 25 +
    clamp(emergencyMonths / 3, 0, 1) * 25 +
    (1 - clamp(debtRatio, 0, 1)) * 20 +
    clamp(budgetAdherence, 0, 1) * 15 +
    goalProg * 15;
  return Math.round(clamp(score, 0, 100));
}

function monthlyExpensesEstimate(s) {
  const budget = monthlyBudgetTotal(s);
  return budget > 0 ? budget : Math.max(1, spentThisMonth(s));
}

function monthlyIncomeEstimate(s) {
  return s.income.reduce((a, i) => {
    if (i.cadence === 'biweekly') return a + i.amount * 2.17;
    if (i.cadence === 'weekly') return a + i.amount * 4.33;
    if (i.cadence === 'monthly') return a + i.amount;
    return a + i.amount; // irregular: treat entered amount as monthly estimate
  }, 0);
}

function savingsRatePct(s) {
  const income = monthlyIncomeEstimate(s);
  if (income <= 0) return 0;
  const saved = Math.max(0, income - spentThisMonth(s));
  return Math.round((saved / income) * 100);
}

function cashFlow(s) {
  const income = monthTransactions(s).filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const expenses = spentThisMonth(s);
  return { income, expenses, net: income - expenses };
}

// Prediction: average of last up-to-3 months spend per category, trended by simple delta.
function predictNextMonth(s) {
  const now = new Date();
  const months = [0, 1, 2].map(k => {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    return d.toISOString().slice(0, 7);
  });
  const byCat = {};
  s.categories.forEach(c => { byCat[c.name] = months.map(m => monthTransactions(s, m).filter(t => t.category === c.name && t.type === 'expense').reduce((a, t) => a + t.amount, 0)); });
  const prediction = {};
  let total = 0;
  Object.entries(byCat).forEach(([cat, vals]) => {
    const nonZero = vals.filter(v => v > 0);
    const avg = nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
    const trend = vals[0] - (vals[1] || vals[0]);
    const pred = Math.max(0, avg + trend * 0.3);
    prediction[cat] = +pred.toFixed(2);
    total += pred;
  });
  return { byCategory: prediction, total: +total.toFixed(2) };
}

// Unusual spending detection: flag transactions far above a category's historical mean.
function detectUnusual(s) {
  const byCat = {};
  s.transactions.filter(t => t.type === 'expense').forEach(t => (byCat[t.category] ||= []).push(t.amount));
  const flags = [];
  Object.entries(byCat).forEach(([cat, amounts]) => {
    if (amounts.length < 3) return;
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length;
    const sd = Math.sqrt(variance);
    const last = amounts[amounts.length - 1];
    if (sd > 0 && last > mean + 2 * sd) flags.push({ category: cat, amount: last, mean: +mean.toFixed(2) });
  });
  return flags;
}

function detectPriceIncreases(s) {
  const flags = [];
  [...s.bills, ...s.subscriptions].forEach(item => {
    const hist = item.priceHistory || item.history;
    if (!hist || hist.length < 2) return;
    const [prev, curr] = [hist[hist.length - 2], hist[hist.length - 1]];
    if (curr.amount > prev.amount) flags.push({ name: item.name, from: prev.amount, to: curr.amount });
  });
  return flags;
}

function detectDuplicateSubs(s) {
  const seen = {};
  const dupes = [];
  s.subscriptions.forEach(sub => {
    const key = sub.name.trim().toLowerCase();
    if (seen[key]) dupes.push(sub.name);
    seen[key] = true;
  });
  // also flag same-category overlaps that look similar (streaming, etc.)
  return [...new Set(dupes)];
}

function investmentPerformance(s) {
  const value = investmentValue(s);
  const perf = (daysAgo) => {
    let past = 0;
    s.investments.forEach(inv => {
      const hist = inv.history;
      const target = addDays(new Date(), -daysAgo).toISOString().slice(0, 10);
      let point = hist.find(h => h.date >= target) || hist[0];
      past += inv.shares * (point ? point.price : inv.price);
    });
    return past > 0 ? ((value - past) / past) * 100 : 0;
  };
  return { day: perf(1), week: perf(7), month: perf(30), year: perf(365) };
}

function assetAllocation(s) {
  const total = investmentValue(s) || 1;
  return s.investments.map(inv => ({ name: inv.name, pct: (inv.shares * inv.price / total) * 100 }));
}

// ===================== Categorization / automation =====================

function autoCategorize(note) {
  const lower = note.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'Personal';
}

function runSmartRules(s, txn) {
  s.automation.smartRules.forEach(rule => {
    if (txn.category !== rule.ifCategory) return;
    const match = rule.op === '>' ? txn.amount > rule.amount : txn.amount >= rule.amount;
    if (match && rule.action === 'alert') {
      notify(s, 'warn', `Smart rule: ${txn.category} transaction of ${money(txn.amount)} exceeded your ${rule.op}${money(rule.amount)} rule.`);
    }
  });
}

function checkDueAutopay(s) {
  const now = new Date(); const dom = now.getDate();
  s.bills.forEach(b => {
    if (!b.autopay) return;
    if (b.dueDay === dom) {
      const already = s.transactions.some(t => t.date === now.toISOString().slice(0, 10) && t.note === `Auto-pay: ${b.name}`);
      if (!already) {
        s.transactions.push({ id: uid(), date: now.toISOString().slice(0, 10), amount: b.amount, category: b.category, note: `Auto-pay: ${b.name}`, type: 'expense', account: 'Checking', business: false });
        notify(s, 'good', `Auto-pay ran: ${b.name} (${money(b.amount)}) paid automatically.`);
      }
    }
  });
}

function processMonthlyRollover(s) {
  const now = isoMonth(new Date().toISOString());
  if (s.lastRolloverMonth === now) return false;
  const prevMonth = isoMonth(addDays(new Date(new Date().getFullYear(), new Date().getMonth(), 1), -1).toISOString());
  s.categories.forEach(c => {
    if (!c.rollover) return;
    const spent = monthTransactions(s, prevMonth).filter(t => t.category === c.name && t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    const unused = Math.max(0, c.budget - spent);
    c.rolloverBalance = (c.rolloverBalance || 0) + unused;
  });
  s.lastRolloverMonth = now;
  return true;
}

// ===================== Gamification =====================

function awardXP(s, amount, reason) {
  s.gamification.xp += amount;
  s.gamification.level = Math.floor(s.gamification.xp / 500) + 1;
  checkBadges(s);
}
function checkBadges(s) {
  BADGE_DEFS.forEach(b => {
    if (!s.gamification.badges.includes(b.id) && b.check(s)) {
      s.gamification.badges.push(b.id);
      notify(s, 'good', `🏆 Badge unlocked: ${b.name}!`);
    }
  });
}
function logDailyActivity(s) {
  const today = new Date().toISOString().slice(0, 10);
  if (s.gamification.streak.lastDate === today) return;
  const yesterday = addDays(new Date(), -1).toISOString().slice(0, 10);
  s.gamification.streak.count = s.gamification.streak.lastDate === yesterday ? s.gamification.streak.count + 1 : 1;
  s.gamification.streak.lastDate = today;
  s.gamification.streak.history[today] = true;
  awardXP(s, XP_RULES.dailyOpen, 'daily open');
}
function ensureWeeklyMissions(s) {
  const wk = isoWeek();
  if (s.gamification.missionsWeek === wk) return;
  s.gamification.missionsWeek = wk;
  s.gamification.missions = [
    { id: uid(), text: 'Log 3 transactions', target: 3, progress: 0, done: false, key: 'txns' },
    { id: uid(), text: 'Contribute to a goal', target: 1, progress: 0, done: false, key: 'goal' },
    { id: uid(), text: 'Stay under budget in Food & Dining', target: 1, progress: 0, done: false, key: 'budget' }
  ];
}
function bumpMission(s, key, amount = 1) {
  const m = s.gamification.missions.find(x => x.key === key);
  if (!m || m.done) return;
  m.progress = Math.min(m.target, m.progress + amount);
  if (m.progress >= m.target) { m.done = true; awardXP(s, 40, 'mission'); notify(s, 'good', `✅ Mission complete: ${m.text}`); }
}

// ===================== Notifications =====================

function notify(s, kind, text) {
  s.notifications.unshift({ id: uid(), kind, text, date: new Date().toISOString(), read: false });
  s.notifications = s.notifications.slice(0, 50);
  if (window.Notification && Notification.permission === 'granted') {
    try { new Notification('MoneyOS', { body: text }); } catch {}
  }
}

function runNotificationChecks(s) {
  const prefs = s.settings.notifPrefs;
  if (prefs.bills) {
    upcomingBills(s, 3).forEach(b => {
      const key = `bill_${b.id}_${isoMonth(new Date().toISOString())}`;
      if (!s.__notified?.[key]) {
        notify(s, 'warn', `Bill due soon: ${b.name} (${money(b.amount)}) in ${b.daysUntil} day(s).`);
        (s.__notified ||= {})[key] = true;
      }
    });
  }
  if (prefs.overspend) {
    s.categories.forEach(c => {
      const spent = spentThisMonth(s, c.name);
      if (spent > c.budget) {
        const key = `over_${c.id}_${isoMonth(new Date().toISOString())}`;
        if (!s.__notified?.[key]) { notify(s, 'warn', `Overspending: ${c.name} is ${money(spent - c.budget)} over budget this month.`); (s.__notified ||= {})[key] = true; }
      }
    });
  }
}

// ===================== Milestones =====================

function checkGoalMilestones(s, goal) {
  const pct = clamp((goal.current / goal.target) * 100, 0, 100);
  [25, 50, 75, 100].forEach(m => {
    if (pct >= m && !goal.milestonesHit.includes(m)) {
      goal.milestonesHit.push(m);
      notify(s, 'good', `🎉 ${goal.name} hit ${m}%!`);
      celebrate();
    }
  });
}

function celebrate() {
  const el = document.createElement('div');
  el.className = 'celebration';
  el.textContent = '🎉';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// app.js continues in app-pages.js (rendering) and app-init.js (boot/wiring)
