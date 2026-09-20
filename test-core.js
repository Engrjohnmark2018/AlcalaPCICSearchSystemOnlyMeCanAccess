const fs = require('fs');
const crypto = require('crypto');

const src = fs.readFileSync('/home/user/pcic-crop-insurance/index.html', 'utf8');
const m = src.match(/\/\*__CORE_START__\*\/([\s\S]*?)\/\*__CORE_END__\*\//);
if (!m) { console.error('FAIL: core markers not found'); process.exit(1); }

(0, eval)(m[1]);
const C = globalThis.__PCIC_CORE__;
if (!C) { console.error('FAIL: __PCIC_CORE__ export missing'); process.exit(1); }
if (typeof C.findFarmer !== 'function') { console.error('FAIL: findFarmer not exported'); process.exit(1); }
if (typeof C.applyTemplate !== 'function') { console.error('FAIL: applyTemplate not exported'); process.exit(1); }

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.error('  FAIL:', name); }
}
function eq(name, a, b) { t(name + `  [${JSON.stringify(a)} === ${JSON.stringify(b)}]`, JSON.stringify(a) === JSON.stringify(b)); }
const ref = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

console.log('--- SHA-256 ---');
eq('sha256 abc', C.sha256Hex('abc'), ref('abc'));
eq('sha256 empty', C.sha256Hex(''), ref(''));
eq('sha256 pcic2026', C.sha256Hex('pcic2026'), ref('pcic2026'));
eq('sha256 new password', C.sha256Hex('@EdiMAO2024'), ref('@EdiMAO2024'));
eq('sha256 long (>64 bytes)', C.sha256Hex('a'.repeat(200)), ref('a'.repeat(200)));
eq('sha256 utf8 ñ', C.sha256Hex('passwördñ'), ref('passwördñ'));
eq('sha256 default hash constant', 'sha256:' + C.sha256Hex('@EdiMAO2024'),
   'sha256:2900010e92fdc3cd4b6312fa14b15a1974d264a32186516b442274c6a712186e');

console.log('--- parseCSV ---');
const csv1 = 'Name,Birthday,Commodity,Variety,PlantingDate,Area\n"Juan, Jr. Dela Cruz",03/15/1975,Rice,"NSIC Rc222, Tubigan 7",01/12/2026,"1.5 ha"\r\nAna,01/01/1990,Corn,DK 818,02/02/2026,2 ha\n';
const rows1 = C.parseCSV(csv1);
eq('row count', rows1.length, 3);
eq('quoted comma name', rows1[1][0], 'Juan, Jr. Dela Cruz');
eq('quoted comma variety', rows1[1][3], 'NSIC Rc222, Tubigan 7');
eq('quoted area', rows1[1][5], '1.5 ha');
eq('crlf row', rows1[2][0], 'Ana');
eq('BOM stripped', C.parseCSV('\uFEFFa,b\nc,d')[0][0], 'a');
eq('escaped quotes', C.parseCSV('a,b\n"say ""hi""",2')[1][0], 'say "hi"');
eq('trailing newline ignored', C.parseCSV('a,b\nc,d\n').length, 2);
eq('empty trailing fields kept', C.parseCSV('a,b,c\nx,y,')[1][2], '');

console.log('--- parseDateAny ---');
const D = (mo, d, y) => ({ y: y, m: mo, d: d });
eq('MM/DD/YYYY', C.parseDateAny('03/15/1975'), D(3, 15, 1975));
eq('M/D/YYYY', C.parseDateAny('3/5/1975'), D(3, 5, 1975));
eq('MM-DD-YYYY', C.parseDateAny('12-05-2025'), D(12, 5, 2025));
eq('YYYY-MM-DD', C.parseDateAny('2026-01-15'), D(1, 15, 2026));
eq('2-digit year 26 -> 2026', C.parseDateAny('01/15/26'), D(1, 15, 2026));
eq('2-digit year 75 -> 1975', C.parseDateAny('03/15/75'), D(3, 15, 1975));
eq('month name 1', C.parseDateAny('Jan 5, 2026'), D(1, 5, 2026));
eq('month name 2', C.parseDateAny('15-Mar-2024'), D(3, 15, 2024));
eq('month name 3', C.parseDateAny('December 25, 2025'), D(12, 25, 2025));
eq('8-digit MMDDYYYY', C.parseDateAny('03151975'), D(3, 15, 1975));
eq('8-digit YYYYMMDD', C.parseDateAny('19750315'), D(3, 15, 1975));
eq('invalid month 13', C.parseDateAny('13/15/1975'), null);
eq('invalid day feb', C.parseDateAny('02/30/2020'), null);
eq('valid leap day', C.parseDateAny('02/29/2020'), D(2, 29, 2020));
eq('invalid leap day', C.parseDateAny('02/29/2021'), null);
eq('garbage', C.parseDateAny('hello'), null);
eq('empty', C.parseDateAny(''), null);
eq('isoOf', C.isoOf(D(1, 5, 2026)), '2026-01-05');
eq('fmtMDY', C.fmtMDY('2026-01-05'), '01/05/2026');
eq('fmtMDY blank', C.fmtMDY(''), '\u2014');

console.log('--- canonicalName ---');
eq('case', C.canonicalName('JUAN DELA CRUZ'), C.canonicalName('juan dela cruz'));
eq('comma reversal', C.canonicalName('Dela Cruz, Juan'), C.canonicalName('Juan Dela Cruz'));
eq('comma reversal typed by farmer', C.canonicalName('Dela Cruz, Juan'), 'juan dela cruz');
eq('periods', C.canonicalName('Maria D. Santos'), C.canonicalName('Maria D Santos'));
eq('extra spaces', C.canonicalName('  Maria   Santos '), 'maria santos');
eq('ñ folding', C.canonicalName('Roberto Muñoz'), C.canonicalName('roberto munoz'));
eq('Ñ folding', C.canonicalName('ÑOÑO'), 'nono');
eq('hyphen', C.canonicalName('Dela Cruz-Ramos'), C.canonicalName('Dela Cruz Ramos'));
eq('apostrophe', C.canonicalName("O'Brien"), C.canonicalName('OBrien'));
eq('jr suffix kept', C.canonicalName('Juan Dela Cruz Jr.'), 'juan dela cruz jr');

console.log('--- mapHeaders (incl. Area) ---');
const h = C.mapHeaders(['NAME', 'Birthday (MM/DD/YYYY)', 'Commodity', 'Variety', 'Planting Date', 'Area']);
eq('headers basic', [h.name, h.birthday, h.commodity, h.variety, h.planting, h.area], [0, 1, 2, 3, 4, 5]);
const h2 = C.mapHeaders(['Farmer Name', 'Birth Date', 'Crop', 'Seed Variety', 'Date Planted', 'Farm Area']);
eq('headers aliases', [h2.name, h2.birthday, h2.commodity, h2.variety, h2.planting, h2.area], [0, 1, 2, 3, 4, 5]);
const h2b = C.mapHeaders(['Name', 'Birthday', 'Commodity', 'Variety', 'PlantingDate', 'Hectares']);
eq('area alias hectares', h2b.area, 5);
const h2c = C.mapHeaders(['Name', 'Birthday', 'Commodity', 'Variety', 'PlantingDate', 'Area Planted']);
eq('area alias "area planted"', h2c.area, 5);
const hF = C.mapHeaders(['Name', 'Birthday', 'Commodity', 'Farm Location', 'Variety', 'PlantingDate', 'Area']);
eq('farm location header mapped', hF.farmloc, 3);
const hG = C.mapHeaders(['Name', 'Birthday', 'Commodity', 'Barangay', 'Variety', 'PlantingDate', 'Area']);
eq('barangay alias mapped', hG.farmloc, 3);
const h3 = C.mapHeaders(['Name', 'Birthday']);
eq('missing optional', [h3.commodity, h3.variety, h3.planting, h3.area], [-1, -1, -1, -1]);

console.log('--- buildRecords ---');
const riceCsv = fs.readFileSync('/home/user/pcic-crop-insurance/sample-Rice-Database.csv', 'utf8');
const rr = C.buildRecords(C.parseCSV(riceCsv), 'Rice');
eq('rice no error', rr.error, null);
eq('rice count (11 rows - 2 incomplete)', rr.records.length, 9);
eq('rice invalid', rr.invalid, 0);
eq('rice skipped (no variety or planting)', rr.skipped, 2);
const juan = rr.records.filter(r => r.name === 'Juan Dela Cruz');
eq('juan has 2 entries', juan.length, 2);
eq('record fields (new column order)', [juan[0].name, juan[0].birthday, juan[0].commodity, juan[0].farmLocation, juan[0].area, juan[0].variety, juan[0].planting],
   ['Juan Dela Cruz', '1975-03-15', 'Rice', 'Brgy. San Juan', '1.5 ha', 'NSIC Rc222', '2026-01-12']);
eq('old CSV format (no FarmLocation) still parses', (() => {
  const r = C.buildRecords(C.parseCSV('Name,Birthday,Commodity,Variety,PlantingDate,Area\nA B,01/01/1970,Rice,V1,01/01/2026,1 ha'), 'Rice');
  return r.error === null && r.records[0].farmLocation === '';
})(), true);
eq('area kept exactly as typed', juan[1].area, '0.75 ha');
eq('blank area kept empty', rr.records.filter(r => r.name === 'Elias Tabin')[0].area, '');

// comma-format name + same person: both rows match one search
const idx = C.buildIndex(rr.records);
eq('comma-name rows merge in index', idx[C.canonicalName('Marites Dungao') + '|1968-07-09'].length, 2);

// strict rule: rows missing name/birthday vs rows missing variety/planting
const bad = C.buildRecords(C.parseCSV('Name,Birthday,Commodity,Variety,PlantingDate,Area\nGood Farmer,01/01/1970,Rice,NSIC Rc222,01/01/2026,1 ha\n,02/02/1970,Rice,V,01/01/2026,1 ha\nNo Bday,notadate,Rice,V,01/01/2026,1 ha\nAlso Good,03/03/1970,Rice,V,13/45/2026,1 ha\nNo Plant,04/04/1970,Rice,V2,,1 ha\nNo Var,05/05/1970,Rice,,01/01/2026,1 ha\n'), 'Rice');
eq('bad: valid kept', bad.records.length, 1);
eq('bad: invalid (name/birthday) counted', bad.invalid, 2);
eq('bad: incomplete rows skipped (strict)', bad.skipped, 3);

// duplicates removed
const dup = C.buildRecords(C.parseCSV('Name,Birthday,Commodity,Variety,PlantingDate,Area\nA B,01/01/1970,Rice,V1,01/01/2026,1 ha\nA B,01/01/1970,Rice,V1,01/01/2026,1 ha\nA B,01/01/1970,Rice,V2,01/01/2026,1 ha\n'), 'Rice');
eq('dup removed', dup.records.length, 2);
eq('dup counted', dup.duplicates, 1);

// missing required columns
const miss = C.buildRecords(C.parseCSV('Name,Variety\nA,V\n'), 'Rice');
t('missing birthday column -> error', !!miss.error);
const noCropCols = C.buildRecords(C.parseCSV('Name,Birthday\nA B,01/01/1970\n'), 'Rice');
t('missing variety/planting columns -> error (required)', !!noCropCols.error);

// empty file
eq('empty file error', !!C.buildRecords(C.parseCSV(''), 'Rice').error, true);

// all rows incomplete -> error (nothing usable)
const allInc = C.buildRecords(C.parseCSV('Name,Birthday,Commodity,Variety,PlantingDate,Area\nA B,01/01/1970,Rice,,,\n'), 'Rice');
t('all rows incomplete -> error', !!allInc.error);

// default commodity applied when column blank
const dc = C.buildRecords(C.parseCSV('Name,Birthday,Commodity,Variety,PlantingDate,Area\nA B,01/01/1970,,V1,01/01/2026,1 ha\n'), 'Rice');
eq('default commodity', dc.records[0].commodity, 'Rice');

console.log('--- full search simulation (corn, 3-field input) ---');
const cornCsv = fs.readFileSync('/home/user/pcic-crop-insurance/sample-Corn-Database.csv', 'utf8');
const cr = C.buildRecords(C.parseCSV(cornCsv), 'Corn');
eq('corn skipped (test row without variety & planting date)', cr.skipped, 1);
const cornDb = { records: cr.records, index: C.buildIndex(cr.records) };
eq('blank-row farmer NOT on list (Cristino)', C.findFarmer(cornDb, 'Cristino', '', 'Balweg', '1985-05-05').length, 0);
const danilo = C.findFarmer(cornDb, 'Danilo', '', 'Tumbaga', '1978-04-04');
eq('danilo found 3 entries', danilo.length, 3);
eq('danilo entry 1 line', `${danilo[0].commodity}, ${danilo[0].variety}, ${C.fmtMDY(danilo[0].planting)} — Area: ${danilo[0].area}`,
   'Corn, IPB Var 4, 11/28/2025 — Area: 2 ha');
eq('danilo farm location', danilo[0].farmLocation, 'Brgy. Galarin');
eq('danilo entry 3 line', `${danilo[2].commodity}, ${danilo[2].variety}, ${C.fmtMDY(danilo[2].planting)} — Area: ${danilo[2].area}`,
   'Corn, DK 818, 02/17/2026 — Area: 1 ha');
eq('wrong birthday not found', C.findFarmer(cornDb, 'Danilo', '', 'Tumbaga', '1978-04-05').length, 0);
eq('unknown farmer not found', C.findFarmer(cornDb, 'Nonexistent', '', 'Farmer', '1978-04-04').length, 0);

console.log('--- max 5 entries ---');
const many = [];
for (let i = 0; i < 8; i++) many.push({ name: 'Many Row', birthday: '1970-01-01', commodity: 'Rice', variety: 'V' + i, planting: '2026-01-0' + (i + 1), area: (i + 1) + ' ha' });
eq('index groups all 8', C.buildIndex(many)[C.canonicalName('Many Row') + '|1970-01-01'].length, 8);
eq('display slices to 5', many.slice(0, 5).length, 5);

console.log('--- findFarmer (First / Middle optional / Last) ---');
const DB = recs => ({ records: recs, index: C.buildIndex(recs) });
const riceDb = DB(rr.records);
eq('first+last, no middle', C.findFarmer(riceDb, 'Juan', '', 'Dela Cruz', '1975-03-15').length, 2);
eq('case-insensitive', C.findFarmer(riceDb, 'JUAN', '', 'dela cruz', '1975-03-15').length, 2);
eq('typed Munoz finds DB Muñoz', C.findFarmer(riceDb, 'Roberto', '', 'Munoz', '1965-09-08').length, 1);
eq('DB "Dungao, Marites" matches 3-field', C.findFarmer(riceDb, 'Marites', '', 'Dungao', '1968-07-09').length, 2);
eq('wrong birthday -> none', C.findFarmer(riceDb, 'Juan', '', 'Dela Cruz', '1975-03-16').length, 0);
eq('unknown farmer -> none', C.findFarmer(riceDb, 'Nobody', '', 'Here', '1975-03-15').length, 0);
eq('null db -> none', C.findFarmer(null, 'A', '', 'B', '1975-03-15').length, 0);
eq('missing last name -> none', C.findFarmer(riceDb, 'Juan', '', '', '1975-03-15').length, 0);

console.log('--- strict rule: not on the list ---');
eq('all rows incomplete -> farmer NOT on list (Liza)', C.findFarmer(riceDb, 'Liza', '', 'Gawisan', '1990-01-17').length, 0);
eq('mixed rows -> only complete row shown (Pedro)', C.findFarmer(riceDb, 'Pedro', '', 'Banganan', '1980-11-22').length, 1);
eq('Pedro complete row has area', C.findFarmer(riceDb, 'Pedro', '', 'Banganan', '1980-11-22')[0].area, '1 ha');
eq('blank area renders as em dash', (() => {
  const e = C.findFarmer(riceDb, 'Elias', '', 'Tabin', '1958-06-06');
  return e[0].area || '\u2014';
})(), '\u2014');

const midCsv = 'Name,Birthday,Commodity,Variety,PlantingDate\n' +
  'Maria Dizon Santos,01/02/1970,Rice,V1,01/01/2026\n' +
  'Maria D. Santos,01/03/1970,Rice,V2,01/01/2026\n' +
  'Juan Dela Cruz Jr.,01/04/1970,Rice,V3,01/01/2026\n' +
  'Ana Reyes,01/05/1970,Rice,V4,01/01/2026\n';
const midDb = DB(C.buildRecords(C.parseCSV(midCsv), 'Rice').records);
eq('midCsv: 4 records (area column absent -> warning only)', midDb.records.length, 4);
eq('exact with middle name', C.findFarmer(midDb, 'Maria', 'Dizon', 'Santos', '1970-01-02').length, 1);
eq('middle initial with period', C.findFarmer(midDb, 'Maria', 'D.', 'Santos', '1970-01-03').length, 1);
eq('no middle vs DB with middle (token fallback)', C.findFarmer(midDb, 'Maria', '', 'Santos', '1970-01-02').length, 1);
eq('no middle vs DB middle initial (token fallback)', C.findFarmer(midDb, 'Maria', '', 'Santos', '1970-01-03').length, 1);
eq('typed middle but DB has none (falls back)', C.findFarmer(midDb, 'Ana', 'Dizon', 'Reyes', '1970-01-05').length, 1);
eq('DB suffix Jr. (token fallback)', C.findFarmer(midDb, 'Juan', '', 'Dela Cruz', '1970-01-04').length, 1);
eq('different middle, same first+last+bday (last fallback)', C.findFarmer(midDb, 'Maria', 'Reyes', 'Santos', '1970-01-02').length, 1);
eq('totally different name -> none', C.findFarmer(midDb, 'Pedro', '', 'Santos', '1970-01-02').length, 0);
eq('multi-word middle name', (() => {
  const mdb = DB([{ name: 'Jose Dizon Reyes', birthday: '1970-06-01', commodity: 'Rice', variety: 'V', planting: '2026-01-01', area: '1 ha' }]);
  return C.findFarmer(mdb, 'Jose', 'Dizon', 'Reyes', '1970-06-01').length;
})(), 1);

console.log('--- applyTemplate (editable popup messages) ---');
eq('basic substitution', C.applyTemplate('{{Name}} naka insure ka ti mulam.', { Name: 'Juan Dela Cruz' }), 'Juan Dela Cruz naka insure ka ti mulam.');
eq('bold key wraps in strong', C.applyTemplate('{{Name}} x', { Name: 'Ana' }, { Name: true }), '<strong>Ana</strong> x');
eq('html in values is escaped', C.applyTemplate('{{Name}}', { Name: '<script>alert(1)</script>' }), '&lt;script&gt;alert(1)&lt;/script&gt;');
eq('html in template is escaped', C.applyTemplate('<b>{{Name}}</b>', { Name: 'A' }), '&lt;b&gt;A&lt;/b&gt;');
eq('unknown placeholder kept visible', C.applyTemplate('{{Name}} {{Oops}}', { Name: 'A' }), 'A {{Oops}}');
eq('spacing variants accepted', C.applyTemplate('{{Name}} / {{ Birthday }}', { Name: 'A', Birthday: '01/02/2003' }), 'A / 01/02/2003');
eq('no placeholders passes through', C.applyTemplate('plain text', {}), 'plain text');
eq('birthday placeholder', C.applyTemplate('Birthday: {{Birthday}}', { Birthday: '03/15/1975' }), 'Birthday: 03/15/1975');

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
