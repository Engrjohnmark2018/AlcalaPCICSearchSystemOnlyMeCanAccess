const fs = require('fs');
const crypto = require('crypto');

const src = fs.readFileSync('/home/user/pcic-crop-insurance/index.html', 'utf8');
const m = src.match(/\/\*__CORE_START__\*\/([\s\S]*?)\/\*__CORE_END__\*\//);
if (!m) { console.error('FAIL: core markers not found'); process.exit(1); }

(0, eval)(m[1]);
const C = globalThis.__PCIC_CORE__;
if (!C) { console.error('FAIL: __PCIC_CORE__ export missing'); process.exit(1); }
for (const fn of ['findFarmer', 'applyTemplate']) {
  if (typeof C[fn] !== 'function') { console.error('FAIL: ' + fn + ' not exported'); process.exit(1); }
}

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
eq('sha256 password', C.sha256Hex('@EdiMAO2024'), ref('@EdiMAO2024'));
eq('sha256 long (>64 bytes)', C.sha256Hex('a'.repeat(200)), ref('a'.repeat(200)));
eq('sha256 utf8 ñ', C.sha256Hex('passwördñ'), ref('passwördñ'));
eq('sha256 default hash constant', 'sha256:' + C.sha256Hex('@EdiMAO2024'),
   'sha256:2900010e92fdc3cd4b6312fa14b15a1974d264a32186516b442274c6a712186e');

console.log('--- parseCSV ---');
const csv1 = 'First Name,Middle Name,Last Name\n"Juan, Jr.",D, Cruz\r\nAna,,Reyes\n';
const rows1 = C.parseCSV(csv1);
eq('row count', rows1.length, 3);
eq('quoted comma field', rows1[1][0], 'Juan, Jr.');
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
eq('periods', C.canonicalName('Maria D. Santos'), C.canonicalName('Maria D Santos'));
eq('extra spaces', C.canonicalName('  Maria   Santos '), 'maria santos');
eq('ñ folding', C.canonicalName('Roberto Muñoz'), C.canonicalName('roberto munoz'));
eq('Ñ folding', C.canonicalName('ÑOÑO'), 'nono');
eq('hyphen', C.canonicalName('Dela Cruz-Ramos'), C.canonicalName('Dela Cruz Ramos'));
eq('apostrophe', C.canonicalName("O'Brien"), C.canonicalName('OBrien'));
eq('comma reversal still works (legacy names)', C.canonicalName('Dela Cruz, Juan'), 'juan dela cruz');

console.log('--- mapHeaders (First / Middle / Last) ---');
const h = C.mapHeaders(['First Name', 'Middle Name', 'Last Name', 'Birthday', 'Commodity', 'Farm Location', 'Area', 'Variety', 'Planting Date']);
eq('basic 9-col headers', [h.first, h.middle, h.last, h.birthday, h.commodity, h.farmloc, h.area, h.variety, h.planting], [0, 1, 2, 3, 4, 5, 6, 7, 8]);
const h2 = C.mapHeaders(['Given Name', 'Middle', 'Surname', 'Birth Date', 'Crop', 'Barangay', 'Hectares', 'Seed Variety', 'Date Planted']);
eq('alias headers', [h2.first, h2.middle, h2.last, h2.birthday, h2.commodity, h2.farmloc, h2.area, h2.variety, h2.planting], [0, 1, 2, 3, 4, 5, 6, 7, 8]);
const h2b = C.mapHeaders(['Firstname', 'Middlename', 'Lastname', 'Apelyido']);
eq('one-word + apelyido', [h2b.first, h2b.middle, h2b.last], [0, 1, 2]);
eq('apelyido alias for last', C.mapHeaders(['First Name', 'Apelyido']).last, 1);
const h3 = C.mapHeaders(['First Name', 'Last Name', 'Birthday']);
eq('missing optionals', [h3.middle, h3.commodity, h3.variety, h3.planting, h3.area, h3.farmloc], [-1, -1, -1, -1, -1, -1]);
const h4 = C.mapHeaders(['Name', 'Birthday']);
eq('legacy Name header maps to nothing', [h4.first, h4.middle, h4.last], [-1, -1, -1]);

console.log('--- buildRecords (3-column names) ---');
const riceCsv = fs.readFileSync('/home/user/pcic-crop-insurance/sample-Rice-Database.csv', 'utf8');
const rr = C.buildRecords(C.parseCSV(riceCsv), 'Rice');
eq('rice no error', rr.error, null);
eq('rice count (11 rows - 2 incomplete)', rr.records.length, 9);
eq('rice invalid', rr.invalid, 0);
eq('rice skipped (no variety or planting)', rr.skipped, 2);
const juan = rr.records.filter(r => r.lastName === 'Dela Cruz');
eq('juan has 2 entries', juan.length, 2);
eq('record fields (3-part name)', [juan[0].firstName, juan[0].middleName, juan[0].lastName, juan[0].name, juan[0].birthday, juan[0].commodity, juan[0].farmLocation, juan[0].area, juan[0].variety, juan[0].planting],
   ['Juan', 'Dizon', 'Dela Cruz', 'Juan Dizon Dela Cruz', '1975-03-15', 'Rice', 'Brgy. San Juan', '1.5 ha', 'NSIC Rc222', '2026-01-12']);
const marites = rr.records.filter(r => r.lastName === 'Dungao');
eq('marites: one row no middle, one with', [marites[0].name, marites[1].name], ['Marites Dungao', 'Marites Cayanan Dungao']);
eq('blank middle -> First + Last name only', rr.records.filter(r => r.lastName === 'Tabin')[0].name, 'Elias Tabin');
eq('record without middle has empty middleName', rr.records.filter(r => r.lastName === 'Tabin')[0].middleName, '');

// invalid + skipped rows
const bad = C.buildRecords(C.parseCSV(
  'First Name,Middle Name,Last Name,Birthday,Commodity,FarmLocation,Area,Variety,PlantingDate\n' +
  'Good,,Farmer,01/01/1970,Rice,Brgy. A,1 ha,V1,01/01/2026\n' +
  ',,NoFirst,02/02/1970,Rice,Brgy. A,1 ha,V,01/01/2026\n' +
  'NoLast,,,02/02/1970,Rice,Brgy. A,1 ha,V,01/01/2026\n' +
  'No,,Bday,notadate,Rice,Brgy. A,1 ha,V,01/01/2026\n' +
  'No,,Plant,04/04/1970,Rice,Brgy. A,1 ha,V2,\n' +
  'No,,Var,05/05/1970,Rice,Brgy. A,1 ha,,01/01/2026\n' +
  'Bad,,Date,03/03/1970,Rice,Brgy. A,1 ha,V,13/45/2026\n'), 'Rice');
eq('bad: valid kept', bad.records.length, 1);
eq('bad: invalid (name/birthday) counted', bad.invalid, 3);
eq('bad: incomplete rows skipped (strict)', bad.skipped, 3);

// legacy single Name column rejected with a clear message
const legacy = C.buildRecords(C.parseCSV('Name,Birthday,Commodity,Variety,PlantingDate\nJuan,01/01/1970,Rice,V,01/01/2026\n'), 'Rice');
t('legacy single Name -> specific error', !!legacy.error && legacy.error.indexOf('no longer supported') >= 0, legacy.error);

// missing last name column
const noLast = C.buildRecords(C.parseCSV('First Name,Birthday,Variety,PlantingDate\nJuan,01/01/1970,V,01/01/2026\n'), 'Rice');
t('missing Last Name column -> error', !!noLast.error && noLast.error.indexOf('Missing required columns') >= 0);

// missing birthday/variety/planting columns
const noCols = C.buildRecords(C.parseCSV('First Name,Last Name\nJuan,Cruz\n'), 'Rice');
t('missing birthday/variety/planting columns -> error', !!noCols.error);

// duplicates removed
const dup = C.buildRecords(C.parseCSV(
  'First Name,Middle Name,Last Name,Birthday,Commodity,FarmLocation,Area,Variety,PlantingDate\n' +
  'A,,B,01/01/1970,Rice,X,1 ha,V1,01/01/2026\n' +
  'A,,B,01/01/1970,Rice,X,1 ha,V1,01/01/2026\n' +
  'A,,B,01/01/1970,Rice,X,1 ha,V2,01/01/2026\n'), 'Rice');
eq('dup removed', dup.records.length, 2);
eq('dup counted', dup.duplicates, 1);

// empty file
eq('empty file error', !!C.buildRecords(C.parseCSV(''), 'Rice').error, true);

// all rows incomplete -> error
const allInc = C.buildRecords(C.parseCSV('First Name,Last Name,Birthday,Variety,PlantingDate\nA,B,01/01/1970,,\n'), 'Rice');
t('all rows incomplete -> error', !!allInc.error);

// minimal CSV: no middle/farmlocation/area columns -> parses with warnings
const minimal = C.buildRecords(C.parseCSV('First Name,Last Name,Birthday,Commodity,Variety,PlantingDate\nA,B,01/01/1970,Rice,V,01/01/2026\n'), 'Rice');
eq('minimal CSV parses', [minimal.error, minimal.records.length], [null, 1]);
eq('minimal CSV: blank middle/farmloc/area', [minimal.records[0].middleName, minimal.records[0].farmLocation, minimal.records[0].area], ['', '', '']);
t('minimal CSV warns about missing optional columns', minimal.warnings.length >= 3);

// default commodity when cell blank
const dc = C.buildRecords(C.parseCSV('First Name,Last Name,Birthday,Commodity,Variety,PlantingDate\nA,B,01/01/1970,,V,01/01/2026\n'), 'Rice');
eq('default commodity', dc.records[0].commodity, 'Rice');

console.log('--- search index: identity = First + Last + birthday ---');
eq('index keys on first+last (middle excluded)', (() => {
  const ix = C.buildIndex([{ firstName: 'Maria', middleName: 'Dizon', lastName: 'Santos', name: 'Maria Dizon Santos', birthday: '1970-01-02' }]);
  return (ix['maria santos|1970-01-02'] || []).length;
})(), 1);
eq('legacy records keep full-name key', (() => {
  const ix = C.buildIndex([{ name: 'Maria Dizon Santos', birthday: '1970-01-02' }]);
  return (ix['maria dizon santos|1970-01-02'] || []).length;
})(), 1);

console.log('--- full search simulation (corn, 3-field input) ---');
const cornCsv = fs.readFileSync('/home/user/pcic-crop-insurance/sample-Corn-Database.csv', 'utf8');
const cr = C.buildRecords(C.parseCSV(cornCsv), 'Corn');
eq('corn skipped (test row without variety & planting date)', cr.skipped, 1);
const cornDb = { records: cr.records, index: C.buildIndex(cr.records) };
const danilo = C.findFarmer(cornDb, 'Danilo', '', 'Tumbaga', '1978-04-04');
eq('danilo found 3 entries', danilo.length, 3);
eq('danilo entry 1 line', `${danilo[0].commodity}, ${danilo[0].variety}, ${C.fmtMDY(danilo[0].planting)} — Area: ${danilo[0].area}`,
   'Corn, IPB Var 4, 11/28/2025 — Area: 2 ha');
eq('danilo farm location', danilo[0].farmLocation, 'Brgy. Galarin');
eq('blank-row farmer NOT on list (Cristino)', C.findFarmer(cornDb, 'Cristino', '', 'Balweg', '1985-05-05').length, 0);
eq('wrong birthday not found', C.findFarmer(cornDb, 'Danilo', '', 'Tumbaga', '1978-04-05').length, 0);
eq('unknown farmer not found', C.findFarmer(cornDb, 'Nonexistent', '', 'Farmer', '1978-04-04').length, 0);

console.log('--- max 5 entries ---');
const many = [];
for (let i = 0; i < 8; i++) many.push({ name: 'Many Row', birthday: '1970-01-01', commodity: 'Rice', variety: 'V' + i, planting: '2026-01-0' + (i + 1), area: (i + 1) + ' ha' });
eq('index groups all 8 (legacy name key)', C.buildIndex(many)[C.canonicalName('Many Row') + '|1970-01-01'].length, 8);
eq('display slices to 5', many.slice(0, 5).length, 5);

console.log('--- findFarmer (First / Middle optional / Last) ---');
const DB = recs => ({ records: recs, index: C.buildIndex(recs) });
const riceDb = DB(rr.records);
eq('first+last, no middle (bucket)', C.findFarmer(riceDb, 'Juan', '', 'Dela Cruz', '1975-03-15').length, 2);
eq('with middle (bucket ignores middle)', C.findFarmer(riceDb, 'Juan', 'Dizon', 'Dela Cruz', '1975-03-15').length, 2);
eq('case-insensitive', C.findFarmer(riceDb, 'JUAN', '', 'dela cruz', '1975-03-15').length, 2);
eq('typed Munoz finds DB Muñoz', C.findFarmer(riceDb, 'Roberto', '', 'Munoz', '1965-09-08').length, 1);
eq('no-middle search finds rows with AND without middle (Marites)', C.findFarmer(riceDb, 'Marites', '', 'Dungao', '1968-07-09').length, 2);
eq('middle search also finds both rows (Marites)', C.findFarmer(riceDb, 'Marites', 'Cayanan', 'Dungao', '1968-07-09').length, 2);
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

console.log('--- findFarmer: middle/suffix edge cases (3-col CSV) ---');
const midCsv = 'First Name,Middle Name,Last Name,Birthday,Commodity,Variety,PlantingDate\n' +
  'Maria,Dizon,Santos,01/02/1970,Rice,V1,01/01/2026\n' +
  'Maria,D,Santos,01/03/1970,Rice,V2,01/01/2026\n' +
  'Juan,,Dela Cruz Jr.,01/04/1970,Rice,V3,01/01/2026\n' +
  'Ana,,Reyes,01/05/1970,Rice,V4,01/01/2026\n';
const midDb = DB(C.buildRecords(C.parseCSV(midCsv), 'Rice').records);
eq('midCsv: 4 records', midDb.records.length, 4);
eq('exact with middle name', C.findFarmer(midDb, 'Maria', 'Dizon', 'Santos', '1970-01-02').length, 1);
eq('middle initial with period', C.findFarmer(midDb, 'Maria', 'D.', 'Santos', '1970-01-03').length, 1);
eq('no middle vs DB with middle', C.findFarmer(midDb, 'Maria', '', 'Santos', '1970-01-02').length, 1);
eq('typed middle but DB has none', C.findFarmer(midDb, 'Ana', 'Dizon', 'Reyes', '1970-01-05').length, 1);
eq('DB suffix Jr. (token fallback)', C.findFarmer(midDb, 'Juan', '', 'Dela Cruz', '1970-01-04').length, 1);
eq('different first name -> none', C.findFarmer(midDb, 'Pedro', '', 'Santos', '1970-01-02').length, 0);

console.log('--- findFarmer: legacy records (old baked files, name as one string) ---');
const legacyDb = DB([{ name: 'Maria Dizon Santos', birthday: '1970-01-02', commodity: 'Rice', variety: 'V', planting: '2026-01-01', area: '1 ha' }]);
eq('legacy: exact full name with middle', C.findFarmer(legacyDb, 'Maria', 'Dizon', 'Santos', '1970-01-02').length, 1);
eq('legacy: no middle (token fallback)', C.findFarmer(legacyDb, 'Maria', '', 'Santos', '1970-01-02').length, 1);
eq('legacy: wrong middle still found (fallback)', C.findFarmer(legacyDb, 'Maria', 'Reyes', 'Santos', '1970-01-02').length, 1);
eq('multi-word middle name', (() => {
  const mdb = DB([{ firstName: 'Jose', middleName: 'Dizon', lastName: 'Reyes', name: 'Jose Dizon Reyes', birthday: '1970-06-01', commodity: 'Rice', variety: 'V', planting: '2026-01-01', area: '1 ha' }]);
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
