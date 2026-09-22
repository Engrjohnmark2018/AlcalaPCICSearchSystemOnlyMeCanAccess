/* Debug harness: boots the real app in a simulated DOM and exercises the main flows.
   Run with:  node debug.js   (from the pcic-crop-insurance folder) */
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const appJs = html.match(/<script>([\s\S]*?)<\/script>/)[1];

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); }
};

/* ---------- 1. static checks (HTML only, excluding the script block) ---------- */
console.log('\n[1] STATIC CHECKS');
const htmlOnly = html.slice(0, html.indexOf('<script>'));
const idDefs = new Set();
let m, re = /id="([^"]+)"/g;
while ((m = re.exec(htmlOnly))) idDefs.add(m[1]);
const dupCount = {};
re = /id="([^"]+)"/g;
while ((m = re.exec(htmlOnly))) dupCount[m[1]] = (dupCount[m[1]] || 0) + 1;
const dups = Object.entries(dupCount).filter(([, n]) => n > 1).map(([k]) => k);
ok('no duplicate id attributes in page HTML', dups.length === 0, dups.join(','));

const refd = new Set();
re = /el\('([^']+)'\)/g;
while ((m = re.exec(appJs))) refd.add(m[1]);
const missing = [...refd].filter(id => !idDefs.has(id));
ok(`all ${refd.size} el('...') ids exist in HTML`, missing.length === 0, missing.join(','));

ok('no f-name leftovers', !/f-name/.test(html));
ok('no old "Nakainsuran" spelling', !/Nakainsuran/.test(html));
ok('exactly one </script> closer in source', (html.match(/<\/script>/g) || []).length === 1);

/* ---------- fake DOM (stable elements, hidden attr honored) ---------- */
function fakeEl(id, hidden) {
  return {
    id, hidden: !!hidden, value: '', innerHTML: '', textContent: '', style: {}, dataset: {}, attrs: {},
    classList: {
      _s: new Set(),
      add(...a) { a.forEach(x => this._s.add(x)); },
      remove(...a) { a.forEach(x => this._s.delete(x)); },
      toggle(c, f) { if (f === undefined) f = !this._s.has(c); f ? this._s.add(c) : this._s.delete(c); return f; },
      contains(c) { return this._s.has(c); }
    },
    listeners: {},
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    removeEventListener() {},
    dispatch(t, ev) { (this.listeners[t] || []).forEach(f => f(ev || {})); },
    focus() {}, select() {},
    click() { (this.listeners.click || []).forEach(f => f({})); },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; },
    appendChild(c) { return c; }, remove() {},
    href: '', download: ''
  };
}
const hiddenIds = new Set();
re = /<[a-zA-Z][^>]*\bid="([^"]+)"[^>]*>/g;
while ((m = re.exec(htmlOnly))) if (/\shidden\b/.test(m[0])) hiddenIds.add(m[1]);

function makeEnv(pageHtml, storageData) {
  const byId = {};
  const idRe = /id="([^"]+)"/g; let mm;
  while ((mm = idRe.exec(pageHtml))) if (!byId[mm[1]]) byId[mm[1]] = fakeEl(mm[1], hiddenIds.has(mm[1]));
  const storage = {
    _s: storageData || {},
    getItem(k) { return k in this._s ? this._s[k] : null; },
    setItem(k, v) { this._s[k] = String(v); },
    removeItem(k) { delete this._s[k]; }
  };
  let capturedBlob = null;
  const qsCache = {};
  const appendedScripts = [];
  const body = fakeEl('body');
  body.appendChild = c => { if (c && c.attrs && c.attrs['data-pcic-baked']) appendedScripts.push(c); return c; };
  const doc = {
    readyState: 'complete',
    getElementById(id) { return byId[id] || null; },
    querySelector(sel) { return (qsCache[sel] = qsCache[sel] || genericQSA(sel))[0]; },
    querySelectorAll(sel) { return (qsCache[sel] = qsCache[sel] || genericQSA(sel)); },
    addEventListener() {},
    createElement(tag) { return fakeEl('created:' + tag + ':' + Math.random()); },
    body,
    documentElement: {
      get outerHTML() {
        let base = pageHtml.replace(/^<!DOCTYPE html>\s*/i, '');
        if (appendedScripts.length) {
          const inject = appendedScripts.map(s => '<script data-pcic-baked="1">' + s.textContent + '</' + 'script>').join('\n');
          const idx = base.lastIndexOf('</body>');
          base = base.slice(0, idx) + '\n' + inject + '\n' + base.slice(idx);
        }
        return base;
      }
    }
  };
  function genericQSA(sel) {
    if (sel === '.choice') {
      const a = fakeEl('c-rice'), b = fakeEl('c-corn');
      a.attrs['data-commodity'] = 'rice'; b.attrs['data-commodity'] = 'corn';
      return [a, b];
    }
    if (sel === '[data-clear]') {
      const a = fakeEl('cl-rice'), b = fakeEl('cl-corn');
      a.attrs['data-clear'] = 'rice'; b.attrs['data-clear'] = 'corn';
      return [a, b];
    }
    const pick = sel.match(/\[data-pick="([^"]+)"\]/);
    if (pick) { const e = fakeEl('pick:' + pick[1]); e.attrs['data-pick'] = pick[1]; return [e]; }
    return [];
  }
  const windowObj = { addEventListener() {}, scrollTo() {} };
  const ctx = vm.createContext({
    document: doc, window: windowObj, location: { hash: '' },
    requestAnimationFrame: f => f(), localStorage: storage,
    Blob: class { constructor(parts) { this.text = parts.join(''); } },
    URL: { createObjectURL(b) { capturedBlob = b; return 'blob:fake'; }, revokeObjectURL() {} },
    TextEncoder, setTimeout, clearTimeout, console, Promise, Date, JSON, Math
  });
  return { byId, storage, doc, windowObj, ctx, getBlob: () => capturedBlob };
}

/* core helpers (for preparing DB data) */
(0, eval)(html.match(/\/\*__CORE_START__\*\/([\s\S]*?)\/\*__CORE_END__\*\//)[1]);
const CORE = globalThis.__PCIC_CORE__;
const riceRecs = CORE.buildRecords(CORE.parseCSV(fs.readFileSync(__dirname + '/sample-Rice-Database.csv', 'utf8')), 'Rice');
const cornRecs = CORE.buildRecords(CORE.parseCSV(fs.readFileSync(__dirname + '/sample-Corn-Database.csv', 'utf8')), 'Corn');

/* ---------- 2. boot + farmer flows ---------- */
console.log('\n[2] APP BOOT & FARMER FLOWS (simulated browser)');
const env = makeEnv(html, {
  pcic_rice_db_v3: JSON.stringify({ records: riceRecs.records, updatedAt: Date.now() }),
  pcic_corn_db_v3: JSON.stringify({ records: cornRecs.records, updatedAt: Date.now() })
});
try { new vm.Script(appJs).runInContext(env.ctx); ok('app script boots without error (init ran)', true); }
catch (e) { ok('app script boots without error (init ran)', false, e.message); }

const B = env.byId;
const submit = () => B['search-form'].dispatch('submit', { preventDefault() {} });

ok('initial view state: search & admin hidden', B['view-search'].hidden === true && B['view-admin'].hidden === true);

B['f-first'].value = 'Juan'; B['f-last'].value = 'Dela Cruz'; B['f-bday'].value = '03/15/1975';
submit();
let mb = B['modal-body'].innerHTML;
ok('found: overlay opens', B['overlay'].hidden === false);
ok('found: bolded full name + ilocano message', mb.includes('<strong>Juan Dizon Dela Cruz</strong> naka insure ka ti mulam.'), mb.slice(0, 90));
ok('found: birthday line', mb.includes('Birthday: 03/15/1975'));
ok('found: table headers in order', mb.includes('<th>Farm Location</th><th>Area</th><th>Variety</th>'));
ok('found: farm location cell', mb.includes('Brgy. San Juan'));
ok('found: 2 entries', (mb.match(/<tr><td class="m-rownum">/g) || []).length === 2);
ok('found: heading Naka-insured', mb.includes('Naka-insured a mulam'));
B['modal-close'].click();
ok('close: overlay hides', B['overlay'].hidden === true);

B['f-first'].value = 'Nobody'; B['f-last'].value = 'Here'; B['f-bday'].value = '01/01/1970';
submit();
mb = B['modal-body'].innerHTML;
ok('not found: ilocano message', mb.includes('I-update mi ti database iti sumarsaruno nga al-aldaw.'));
ok('not found: english sub message', mb.includes('stay tune.'));
B['modal-close'].click();

B['f-first'].value = 'Liza'; B['f-last'].value = 'Gawisan'; B['f-bday'].value = '01/17/1990';
submit();
ok('strict rule: incomplete-row farmer -> not on list', B['modal-body'].innerHTML.includes('al-aldaw'));
B['modal-close'].click();

env.doc.querySelectorAll('.choice')[1].click();
ok('commodity switch: corn chip shown', B['chip-corn-ic'].hidden === false && B['chip-name'].textContent === 'Corn');
B['f-first'].value = 'Danilo'; B['f-last'].value = 'Tumbaga'; B['f-bday'].value = '04041978';
B['f-bday'].dispatch('input', { target: B['f-bday'] });
ok('birthday auto-format', B['f-bday'].value === '04/04/1978', B['f-bday'].value);
submit();
mb = B['modal-body'].innerHTML;
ok('corn found: 3 entries', (mb.match(/<tr><td class="m-rownum">/g) || []).length === 3);
ok('corn found: area next to farm location', mb.includes('Brgy. Galarin') && mb.includes('2 ha'));
B['modal-close'].click();

B['f-first'].value = ''; B['f-last'].value = ''; B['f-bday'].value = '13/45/1990';
submit();
ok('validation: first name flagged', B['err-first'].hidden === false && B['f-first'].classList.contains('bad'));
ok('validation: last name flagged', B['err-last'].hidden === false);
ok('validation: bad birthday flagged, no popup', B['err-bday'].hidden === false && B['overlay'].hidden === true);

/* ---------- 3. admin flows ---------- */
console.log('\n[3] ADMIN FLOWS');
for (let i = 0; i < 5; i++) { B['admin-pass'].value = 'wrong'; B['admin-login-form'].dispatch('submit', { preventDefault() {} }); }
ok('lockout after 5 wrong attempts', B['admin-err'].textContent.includes('Too many attempts'));
B['admin-pass'].value = '@EdiMAO2024';
B['admin-login-form'].dispatch('submit', { preventDefault() {} });
ok('correct password blocked while locked', B['admin-panel'].hidden === true && B['admin-gate'].hidden === false);

const env2 = makeEnv(html, {
  pcic_rice_db_v3: JSON.stringify({ records: riceRecs.records, updatedAt: Date.now() })
});
new vm.Script(appJs).runInContext(env2.ctx);
const C = env2.byId;
C['admin-pass'].value = '@EdiMAO2024';
C['admin-login-form'].dispatch('submit', { preventDefault() {} });
ok('admin login succeeds with default password', C['admin-panel'].hidden === false);
ok('status shows device source', C['status-rice'].innerHTML.includes('uploaded on this device'));
ok('status shows record count', C['status-rice'].innerHTML.includes('9 record'));

C['msg-found-title'].value = 'Naka-insured ka, {{Name}}! ({{Commodity}})';
C['prev-found'].click();
ok('message editor preview applies template',
   C['modal-body'].innerHTML.includes('Naka-insured ka, <strong>Juan Dizon Dela Cruz</strong>! (Rice)'),
   C['modal-body'].innerHTML.slice(0, 120));
C['modal-close'].click();

C['msg-nf-title'].value = 'Saan ka pay mabirukan, {{Name}}.';
C['msgs-form'].dispatch('submit', { preventDefault() {} });
ok('message editor saves to storage', JSON.parse(env2.storage.getItem('pcic_msgs_v1')).notFoundTitle === 'Saan ka pay mabirukan, {{Name}}.');
C['f-first'].value = 'Nobody'; C['f-last'].value = 'Here'; C['f-bday'].value = '01/01/1970';
C['search-form'].dispatch('submit', { preventDefault() {} });
ok('saved custom message reaches farmer popup', C['modal-body'].innerHTML.includes('Saan ka pay mabirukan, Nobody Here.'), C['modal-body'].innerHTML.slice(0, 100));
C['modal-close'].click();

/* ---------- 4. baked-in export round trip ---------- */
console.log('\n[4] BAKED-IN EXPORT ROUND TRIP (farmer edition)');
C['bake-btn'].click();
const blob = env2.getBlob();
ok('export produced a file', !!blob);
if (blob) {
  const out = blob.text;
  fs.writeFileSync(__dirname + '/exported-farmer-app.debug.html', out);
  const noScript = out.replace(/<script>[\s\S]*?<\/script>/, '').replace(/<script data-pcic-baked="1">[\s\S]*?<\/script>/g, '');
  ok('export: single doctype outside scripts', out.startsWith('<!DOCTYPE html>') && (noScript.match(/<!DOCTYPE/gi) || []).length === 1);
  ok('export: baked script tag present', out.includes('<script data-pcic-baked="1">'));
  ok('export: payload carries rice records', out.includes('"records"') && out.includes('Juan Dizon Dela Cruz'));
  ok('export: NO password hash in payload', !out.includes('"passHash"'));
  ok('export: custom message baked in', out.includes('Saan ka pay mabirukan'));

  const bakedMatches = [...out.matchAll(/<script data-pcic-baked="1">([\s\S]*?)<\/script>/g)];
  const bakedJs = bakedMatches[bakedMatches.length - 1][1];
  const mainJs = out.match(/<script>([\s\S]*?)<\/script>/)[1];
  ok('export: exactly one real baked tag appended', bakedMatches.length === 1, 'found ' + bakedMatches.length);
  ok('export: main script identical to original', mainJs === appJs);

  const env3 = makeEnv(out, {});
  new vm.Script(bakedJs).runInContext(env3.ctx);
  new vm.Script(mainJs).runInContext(env3.ctx);
  const D = env3.byId;
  for (let i = 0; i < 5; i++) D['logo'].click();
  ok('exported: 5 logo taps do NOT open admin (farmer edition)', D['view-admin'].hidden === true);
  ok('exported: admin panel stays hidden', D['admin-panel'].hidden === true);
  ok('exported: farmer-edition toast shown', D['toast'].textContent.includes('Farmer edition'));
  D['f-first'].value = 'Juan'; D['f-last'].value = 'Dela Cruz'; D['f-bday'].value = '03/15/1975';
  D['search-form'].dispatch('submit', { preventDefault() {} });
  const mb3 = D['modal-body'].innerHTML;
  ok('exported: baked custom found message used', mb3.includes('Naka-insured ka, <strong>Juan Dizon Dela Cruz</strong>! (Rice)'), mb3.slice(0, 100));
  ok('exported: table intact', mb3.includes('Brgy. San Juan') && mb3.includes('1.5 ha'));
  D['f-first'].value = 'Nobody'; D['f-last'].value = 'X'; D['f-bday'].value = '01/01/1970';
  D['search-form'].dispatch('submit', { preventDefault() {} });
  ok('exported: baked custom message shown', D['modal-body'].innerHTML.includes('Saan ka pay mabirukan, Nobody X.'));
  D['modal-close'].click();
  env3.doc.querySelectorAll('.choice')[1].click();
  D['f-first'].value = 'Danilo'; D['f-last'].value = 'Tumbaga'; D['f-bday'].value = '04/04/1978';
  D['search-form'].dispatch('submit', { preventDefault() {} });
  ok('exported: missing commodity -> no-database popup', D['modal-body'].innerHTML.includes('No Corn database yet.'));
}

/* ---------- 5. clean boot ---------- */
console.log('\n[5] CLEAN BOOT (no data at all)');
const env4 = makeEnv(html, {});
new vm.Script(appJs).runInContext(env4.ctx);
const E = env4.byId;
E['f-first'].value = 'Juan'; E['f-last'].value = 'Dela Cruz'; E['f-bday'].value = '03/15/1975';
E['search-form'].dispatch('submit', { preventDefault() {} });
ok('clean boot: no-database popup', E['modal-body'].innerHTML.includes('No Rice database yet.'));

/* ---------- 6. $-in-data export safety ---------- */
console.log('\n[6] EXPORT SAFETY: $ CHARACTERS IN DATA');
const env5 = makeEnv(html, {
  pcic_rice_db_v3: JSON.stringify({
    records: [{ firstName: 'Dollar', middleName: '$&', lastName: 'Farmer', name: 'Dollar $& Farmer $` $\' $1', birthday: '1970-01-01', commodity: 'Rice', farmLocation: 'Brgy. $&`\'', area: '$1', variety: 'V$', planting: '2026-01-01' }],
    updatedAt: Date.now()
  })
});
new vm.Script(appJs).runInContext(env5.ctx);
env5.byId['bake-btn'].click();
const blob5 = env5.getBlob();
let dollarOk = false, dollarWhy = '';
if (blob5) {
  const matches5 = [...blob5.text.matchAll(/<script data-pcic-baked="1">([\s\S]*?)<\/script>/g)];
  try {
    const ctx5 = vm.createContext({ window: {} });
    new vm.Script(matches5[matches5.length - 1][1]).runInContext(ctx5);
    dollarOk = ctx5.window.__PCIC_BAKED__.rice.records[0].name === 'Dollar $& Farmer $` $\' $1';
  } catch (e) { dollarWhy = e.message; }
}
ok('export survives $ & ` \' characters in farmer data', dollarOk, dollarWhy);

console.log(`\n=== DEBUG COMPLETE: ${pass} passed, ${fail} failed ===`);
if (fail === 0) { try { fs.unlinkSync(__dirname + '/exported-farmer-app.debug.html'); } catch (e) {} }
process.exit(fail ? 1 : 0);
