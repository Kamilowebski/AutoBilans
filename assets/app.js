'use strict';
const paths = {
  card:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m-14 5h4"/>',
  more:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  settings:'<path d="m10 2-.6 2.5-1.9 1-2.4-.8-2 3.5 1.8 1.8v2l-1.8 1.8 2 3.5 2.4-.8 1.9 1 .6 2.5h4l.6-2.5 1.9-1 2.4.8 2-3.5-1.8-1.8v-2l1.8-1.8-2-3.5-2.4.8-1.9-1L14 2z" transform="translate(0 1)"/><circle cx="12" cy="12" r="3"/>',
  cloud:'<path d="M7 18H6a4 4 0 0 1-.5-8 6 6 0 0 1 11.7-1.4A5 5 0 0 1 18 18h-1m-8-2 3-3 3 3m-3-3v8"/>',
  car:'<path d="M5 17h14M5 17v2m14-2v2M4 12l2-5a2 2 0 0 1 2-1h8a2 2 0 0 1 2 1l2 5m-16 0h16a1 1 0 0 1 1 1v4H3v-4a1 1 0 0 1 1-1zm2 3h2m8 0h2"/>',
  home:'<path d="m3 11 9-8 9 8M5 10v10h14V10m-9 10v-6h4v6"/>',
  wallet:'<path d="M19 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v9H6a3 3 0 0 1-3-3V7m17 5h-4v4h4"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2"/>',
  chart:'<path d="M4 4v16h16M8 16v-4m5 4V8m5 8V5"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  wrench:'<path d="m14 7 3-3a6 6 0 0 0-8 8l-5 5a2 2 0 1 0 3 3l5-5a6 6 0 0 0 8-8l-3 3z"/>',
  shield:'<path d="M12 22s7-3 7-9V6l-7-3-7 3v7c0 6 7 9 7 9Z"/><path d="m9 12 2 2 4-4"/>',
  fuel:'<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16m-11 0h12M4 10h10m0 3h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6l-4-4"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const $ = id => document.getElementById(id);
const fuels = ['Benzyna 95','Benzyna 98','Diesel','LPG','Inne'];
const programs = ['ORLEN VITAY','Shell ClubSmart','BP / PAYBACK','Circle K EXTRA','MOYA','AMIC','Inna stacja'];
const formats = {CODE_128:'Code 128',EAN_13:'EAN-13',QR_CODE:'Kod QR',TEXT:'Sam numer'};
const categories = ['Paliwo','Serwis','Ubezpieczenie','Przegląd','Parking','Opłaty drogowe','Inne'];
const routeNames = {start:'Przegląd',cars:'Garaż',expenses:'Wydatki',dates:'Terminy',stats:'Statystyki',settings:'Ustawienia',cards:'Karty paliwowe',fuel:'Paliwo i stacje',more:'Więcej'};
const types = {inspection:{name:'Przegląd techniczny',icon:'wrench',color:'orange'},insurance:{name:'Ubezpieczenie OC',icon:'shield',color:'blue'}};
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = cents => new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN'}).format(cents / 100);
const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today = () => iso(new Date());
const dateLabel = date => date ? new Date(date+'T12:00:00').toLocaleDateString('pl-PL',{day:'numeric',month:'short',year:'numeric'}) : 'Brak terminu';
const daysUntil = date => Math.round((Date.parse(date)-Date.parse(today()))/86400000);
const badge = (name,color='') => `<span class="badge ${color}">${icon(name)}</span>`;
const button = (action,label,glyph='',secondary=false) => `<button class="button ${secondary?'secondary':''}" data-action="${action}">${glyph?icon(glyph):''}${label}</button>`;
const native = window.AndroidApp;
const creator = 'kamilsamiec@gmail.com';
let data = {cars:[], expenses:[], active:null, cards:[], skippedTanks:[]};
try {
  const saved = JSON.parse(native.load() || 'null');
  if (Array.isArray(saved?.cars) && Array.isArray(saved?.expenses)) data = {...data,...saved};
} catch {}
let toastTimer;
function toast(message) {
  $('toast').textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').textContent = '',3500);
}
function change(update) {
  const next = JSON.parse(JSON.stringify(data));
  update(next);
  if (!native.store(JSON.stringify(next))) throw new Error('Nie udało się zapisać danych.');
  data = next;
}
function run(update,message) {
  try {
    change(update);
    render();
    if (message) toast(message);
  } catch { toast('Nie udało się zapisać danych na tym urządzeniu.'); }
}
const current = () => data.cars.find(car => car.id === data.active);
const expenses = () => data.expenses.filter(item => item.car === data.active).sort((a,b) => b.date.localeCompare(a.date));
const total = items => items.reduce((sum,item) => sum + item.cents,0);
const fuelNumber = (value,digits=2) => new Intl.NumberFormat('pl-PL',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(value);
function drivingSummary(items, skipped = []) {
  const tanks = items.filter(item => item.fuel && item.odometer != null)
    .sort((a,b) => a.odometer-b.odometer || a.date.localeCompare(b.date));
  let baseline;
  let liters = 0;
  let totalLiters = 0;
  let cents = 0;
  let totalCents = 0;
  let kilometers = 0;
  for (const tank of tanks) {
    if (baseline != null) {
      liters += tank.liters;
      cents += tank.cents;
    }
    if (!tank.full) continue;
    if (baseline != null && tank.odometer > baseline.odometer) {
      const incomplete = skipped.some(mark => mark.odometer == null
        ? mark.date >= baseline.date && mark.date <= tank.date
        : mark.odometer >= baseline.odometer && mark.odometer <= tank.odometer);
      if (!incomplete) {
        totalLiters += liters;
        totalCents += cents;
        kilometers += tank.odometer-baseline.odometer;
      }
    }
    baseline = tank;
    liters = 0;
    cents = 0;
  }
  return kilometers ? {litersPer100:totalLiters*100/kilometers, centsPer100:totalCents*100/kilometers} : null;
}
function drivingForCar() {
  const all = expenses().filter(item => item.fuel);
  const type = current()?.fuel || all[0]?.fuel;
  return drivingSummary(all.filter(item => item.fuel===type), skippedTanks().filter(item => item.fuel===type));
}
const monthItems = () => expenses().filter(item => item.date.startsWith(today().slice(0,7)));
const carLabel = car => [car.registration,car.year,car.fuel].filter(Boolean).join(' · ');
const heading = (title,description,action='') => `<div class="heading"><div><h1>${title}</h1><p class="muted">${description}</p></div>${action}</div>`;
const noCar = () => `<div class="card"><p class="empty">Dodaj samochód, aby zacząć.</p>${button('car','Dodaj samochód','plus')}</div>`;
function status(date) {
  if (!date) return ['Ustaw datę',''];
  const days = daysUntil(date);
  if (days < 0) return ['Po terminie','danger'];
  if (days === 0) return ['Dzisiaj','due'];
  return [days === 1 ? 'Jutro' : `Za ${days} dni`,days <= 14 ? 'due' : ''];
}
function chart() {
  const now = new Date();
  const items = expenses();
  const months = Array.from({length:6},(_,i) => {
    const date = new Date(now.getFullYear(), now.getMonth()+i-5,1);
    return {label:date.toLocaleDateString('pl-PL',{month:'short'}), value:total(items.filter(item => item.date.startsWith(iso(date).slice(0,7))))};
  });
  const max = Math.max(1,...months.map(month => month.value));
  return `<div class="chart" aria-label="Wydatki z ostatnich sześciu miesięcy">${months.map(month => `<div class="column" title="${month.label} · ${money(month.value)}" aria-label="${month.label} ${money(month.value)}"><div class="bar-track"><div class="bar" style="height:${100*month.value/max}%"></div></div><span>${month.label}</span></div>`).join('')}</div>`;
}
function deadlineRows(car, detailed=false) {
  return Object.entries(types).map(([key,type]) => {
    const date = car?.[key];
    const [label,tone] = status(date);
    return `<div class="row"><div class="row-main">${badge(type.icon,type.color)}<div><h3>${type.name}</h3><div class="sub ${tone}">${date ? dateLabel(date)+' · '+label : 'Brak terminu'}</div></div></div><div class="actions">${detailed && date ? `<button class="quiet" data-action="calendar:${key}">Do kalendarza</button>` : ''}${car ? `<button class="quiet" data-action="date:${key}" aria-label="${date?'Zmień':'Ustaw'} termin: ${type.name}">${date?'Zmień':'Ustaw'}</button>` : ''}</div></div>`;
  }).join('');
}
function expenseRows(items,editable=false) {
  if (!items.length) return '<p class="empty">Brak zapisanych wydatków.</p>';
  return items.map(item => `<div class="row"><div class="row-main">${badge(item.category==='Paliwo'?'fuel':'wallet')}<div><h3>${esc(item.note || item.category)}</h3><div class="sub">${dateLabel(item.date)}${item.note?' · '+esc(item.category):''}${item.workshop?' · '+esc(item.workshop):''}${item.station?' · '+esc(item.station):''}</div></div></div><div class="actions"><span class="amount">${money(item.cents)}</span>${editable?`<button class="quiet" data-action="expense:${item.id}">Edytuj</button>`:''}</div></div>`).join('');
}
function home(car) {
  const metrics = Object.entries(types).map(([key,type]) => {
    const date = car?.[key];
    const [label,tone] = status(date);
    return `<article class="card"><div class="card-title">${badge(type.icon,type.color)}<span class="sub">${type.name}</span></div><div class="metric">${date ? dateLabel(date) : '—'}</div><div class="sub ${tone}">${date ? label : 'Brak terminu'}</div></article>`;
  }).join('');
  return heading('Przegląd','Wydatki i terminy Twojego samochodu.',car ? button('expense','Dodaj wydatek','plus') : '')+
    `<section class="hero"><div class="hero-copy"><div class="eyebrow">${icon('car')} GARAŻ</div><h2>${car ? esc(car.name) : 'Twój pierwszy samochód'}</h2><p>${car ? esc(carLabel(car)) : 'Dodaj auto, aby zacząć zapisywać wydatki.'}</p>${car ? '<a class="button secondary" href="#cars">Zarządzaj garażem</a>' : button('car','Dodaj samochód','plus')}</div><div class="hero-art" aria-hidden="true">${icon('car')}</div></section>
    <section class="cards"><article class="card"><div class="card-title">${badge('wallet')}<span class="sub">Wydatki w tym miesiącu</span></div><div class="metric">${money(total(monthItems()))}</div><div class="sub">${new Date().toLocaleDateString('pl-PL',{month:'long',year:'numeric'})}</div></article>${metrics}</section>
    <div class="split"><section class="card"><div class="card-title"><h2>Wydatki w czasie</h2><a class="quiet" href="#stats">Statystyki</a></div>${chart()}</section><section class="card"><div class="card-title"><h2>Terminy</h2><a class="quiet" href="#dates">Zobacz terminy</a></div>${deadlineRows(car)}</section></div>
    ${cardShortcut()}
    ${fuelShortcut()}
    <section class="card spaced"><div class="card-title"><h2>Ostatnie wydatki</h2><a class="quiet" href="#expenses">Zobacz wydatki</a></div>${expenseRows(expenses().slice(0,4))}</section>`;
}
function garage() {
  return heading('Garaż','Dodawaj samochody i wybieraj aktywne auto.',button('car','Dodaj samochód','plus'))+
    (data.cars.length ? `<div class="garage">${data.cars.map(car => `<article class="card ${car.id===data.active?'selected':''}"><div class="card-title">${badge('car')}<span class="sub">${car.id===data.active?'Aktywne auto':''}</span></div><h2>${esc(car.name)}</h2><p class="muted">${esc(carLabel(car))}</p><div class="actions spaced">${car.id===data.active?'':button('select:'+car.id,'Wybierz')}${button('car:'+car.id,'Edytuj','',true)}</div></article>`).join('')}</div>` : '<div class="card"><p class="empty">Twój garaż jest pusty.</p></div>');
}
function stats(car) {
  const items = expenses();
  const sum = total(items);
  const breakdown = categories.map(name => ({name,value:total(items.filter(item => item.category===name))})).filter(item => item.value).sort((a,b) => b.value-a.value);
  return heading('Statystyki','Zobacz, ile kosztuje utrzymanie wybranego auta.')+
    (car ? `<div class="cards"><article class="card"><span class="sub">Łącznie</span><div class="metric">${money(sum)}</div></article><article class="card"><span class="sub">W tym miesiącu</span><div class="metric">${money(total(monthItems()))}</div></article><article class="card"><span class="sub">Liczba wydatków</span><div class="metric">${items.length}</div></article></div><div class="split"><section class="card"><h2>Ostatnie 6 miesięcy</h2>${chart()}</section><section class="card"><h2>Według kategorii</h2>${breakdown.length ? breakdown.map(({name,value}) => `<div class="category-item"><div class="row"><span>${name}</span><strong class="amount">${money(value)}</strong></div><div class="category-track"><span style="width:${value/sum*100}%"></span></div></div>`).join('') : '<p class="empty">Dodaj pierwszy wydatek, aby zobaczyć podsumowanie.</p>'}</section></div>` : noCar());
}
const cardName = item => item.name || item.program;
function fuelShortcut() {
  const summary = drivingForCar();
  return `<section class="card spaced card-shortcut"><div class="row-main">${badge('fuel')}<div><h2>Paliwo i stacje</h2><p class="sub">${summary == null ? 'Tankowania i spalanie' : fuelNumber(summary.litersPer100)+' l/100 km · '+money(summary.centsPer100)+'/100 km'}</p></div></div>
    <a href="#fuel" class="quiet">Zobacz paliwo</a></section>`;
}
const skippedTanks = () => data.skippedTanks.filter(item => item.car === data.active);
function skipTankForm(id, defaults = {}) {
  const car = current();
  if (!car) return;
  const mark = skippedTanks().find(item => item.id === id);
  openForm(mark ? 'Edytuj pominięte tankowanie' : 'Pomiń tankowanie',
    '<p class="muted">Użyj, gdy tankowanie się odbyło, ale brakuje danych. Odcinek z tym tankowaniem wypadnie ze średniego spalania.</p>' +
    input('Data tankowania','date',mark?.date ?? defaults.date ?? today(),'type="date" required') +
    `<label>Typ paliwa<select name="fuel" required><option value="">Wybierz paliwo</option>${fuels.map(fuel =>
      `<option ${(mark?.fuel ?? defaults.fuel ?? car.fuel)===fuel?'selected':''}>${fuel}</option>`).join('')}</select></label>` +
    input('Przebieg (opcjonalnie)','odometer',mark?.odometer ?? defaults.odometer,'type="number" min="0" max="9999999"'),
    values => {
      if (!fuels.includes(values.fuel)) throw new Error('Wybierz typ paliwa.');
      if (values.odometer && !/^\d{1,7}$/.test(values.odometer)) throw new Error('Podaj przebieg w pełnych kilometrach.');
      const updated = {id:mark?.id ?? newId(),car:car.id,date:values.date,fuel:values.fuel,
        odometer:values.odometer ? Number(values.odometer) : null};
      change(next => {
        if (mark) next.skippedTanks = next.skippedTanks.map(item => item.id===id ? updated : item);
        else next.skippedTanks.push(updated);
      });
    }, mark ? next => next.skippedTanks = next.skippedTanks.filter(item => item.id!==id) : undefined);
}
function fuelPage() {
  const car = current();
  const summary = drivingForCar();
  const skipped = skippedTanks().sort((a,b) => b.date.localeCompare(a.date));
  return heading('Paliwo i stacje','Spalanie i koszt jazdy z Twoich tankowań.',button('nearby','Stacje w Mapach','fuel',true))+
    (car ? `<div class="split"><section class="card"><h2>Średnie spalanie</h2><div class="metric">${summary == null ? '—' : fuelNumber(summary.litersPer100)+' l/100 km'}</div>
      <p class="sub">Wpisz litry i przebieg przy każdym tankowaniu. Zaznacz co najmniej dwa tankowania do pełna dla tego samego paliwa.</p>
      <div class="actions spaced">${button('tank','Dodaj tankowanie','plus')}${button('skip-tank','Pomiń tankowanie','',true)}</div></section>
    <section class="card"><div class="card-title"><h2>Typ paliwa</h2>${badge('fuel')}</div><p>${esc(car.fuel || 'Nie ustawiono')}</p>
      <div class="actions spaced">${button('car:'+car.id,'Ustaw w garażu','',true)}</div></section></div>
    <section class="card spaced"><h2>Koszt paliwa na 100 km</h2><div class="metric">${summary ? money(summary.centsPer100)+' / 100 km' : '—'}</div>
      <p class="sub">Koszt z kompletnych odcinków między tankowaniami do pełna. Uwzględnia tankowania częściowe.</p></section>
    ${skipped.length ? `<section class="card spaced"><h2>Pominięte tankowania</h2>
      ${skipped.map(mark => `<div class="row"><div><h3>${esc(mark.fuel)}</h3><p class="sub">${dateLabel(mark.date)}${mark.odometer == null ? '' : ' · '+mark.odometer+' km'}</p></div>
      <button class="quiet" data-action="skip-tank:${mark.id}">Edytuj</button></div>`).join('')}</section>` : ''}` : noCar());
}
function cardShortcut() {
  const favorite = data.cards.find(item => item.favorite);
  return `<section class="card spaced card-shortcut"><div class="row-main">${badge('card')}<div><h2>Karty paliwowe</h2><p class="sub">${favorite ? esc(cardName(favorite)) : 'Karty lojalnościowe pod ręką'}</p></div></div>
    ${favorite ? button('show-card:'+favorite.id,'Pokaż kartę','',true) : '<a href="#cards" class="quiet">Otwórz portfel</a>'}</section>`;
}
function cardsPage() {
  const cards = [...data.cards].sort((a,b) => Number(b.favorite)-Number(a.favorite));
  return heading('Karty paliwowe','Wybierz kartę przy kasie i pokaż jej kod.',button('loyalty','Dodaj kartę','plus'))+
    (cards.length ? `<div class="garage">${cards.map(item => `<article class="card loyalty-card">
      <div class="card-title">${badge('card')}<button class="quiet" data-action="favorite:${item.id}" aria-pressed="${item.favorite}">${item.favorite?'★ Ulubiona':'☆ Ustaw jako ulubioną'}</button></div>
      <h2>${esc(cardName(item))}</h2><p class="sub">${esc(item.program)} · •••• ${esc(item.value.slice(-4))}</p>
      <div class="actions spaced">${button('show-card:'+item.id,'Pokaż kartę')}${button('loyalty:'+item.id,'Edytuj','',true)}</div>
      </article>`).join('')}</div>` : '<section class="card"><p class="empty">Dodaj pierwszą kartę, np. ORLEN VITAY lub Shell ClubSmart.</p></section>');
}
function loyaltyForm(id) {
  const item = data.cards.find(entry => entry.id === id);
  openForm(item ? 'Edytuj kartę' : 'Dodaj kartę',
    `<label>Program<select name="program">${programs.map(program => `<option ${item?.program===program?'selected':''}>${program}</option>`).join('')}</select></label>
    ${input('Własna nazwa (opcjonalnie)','name',item?.name,'maxlength="50"')}
    ${input('Numer karty lub treść kodu','value',item?.value,'required maxlength="100"')}
    <label>Format kodu<select name="format">${Object.entries(formats).map(([key,label]) => `<option value="${key}" ${(item?.format ?? 'CODE_128')===key?'selected':''}>${label}</option>`).join('')}</select></label>
    <p class="sub">Wybierz format zgodny z oryginalną kartą. Kody generowane przez aplikację stacji otwieraj w tej aplikacji.</p>`,
    values => {
      const value = values.value.trim();
      if (!value) throw new Error('Wpisz numer karty lub treść kodu.');
      if (values.format !== 'TEXT' && !native.cardCode(values.format,value)) {
        throw new Error('Numer lub treść nie pasuje do tego formatu kodu.');
      }
      change(next => {
        const updated = {...item,id:item?.id ?? newId(), program:values.program,name:values.name.trim(),value,format:values.format,favorite:item?.favorite ?? false};
        if (item) next.cards = next.cards.map(entry => entry.id===id ? updated : entry);
        else next.cards.push(updated);
      });
    }, item ? next => next.cards = next.cards.filter(entry => entry.id !== id) : undefined);
}
function showCard(id) {
  const item = data.cards.find(entry => entry.id === id);
  if (!item) return;
  const code = item.format === 'TEXT' ? '' : native.cardCode(item.format,item.value);
  $('form').onsubmit = null;
  $('form').innerHTML = `<h2>${esc(cardName(item))}</h2>
    ${code ? `<div class="scan-card ${item.format==='QR_CODE'?'qr':''}"><img src="data:image/png;base64,${code}" alt="${formats[item.format]} do zeskanowania"></div>` : ''}
    <p class="card-number">${esc(item.value)}</p>
    <button class="button secondary" type="button" data-close>Zamknij</button>`;
  $('form').querySelector('[data-close]').onclick = () => $('dialog').close();
  $('dialog').showModal();
}
function settingsPage() {
  return `<div class="heading"><h1>Ustawienia</h1></div>
    <div class="settings-list">
      <section class="card">
        <div class="card-title settings-heading">${badge('calendar','orange')}<h2>Powiadomienia</h2><span class="sub" id="reminder-status"></span></div>
        <h3>Terminy</h3>
        <p class="muted">Przypomnienia według daty pojawiają się około 9:00, 7 dni przed terminem, dzień przed i w dniu terminu. Przypomnienia według przebiegu pojawiają się po zapisaniu odczytu, który osiąga ustawiony limit.</p>
        <div class="actions spaced"><button class="button secondary" data-action="reminder-settings" id="reminder-settings"></button></div>
      </section>
      <section class="card">
        <div class="card-title settings-heading">${badge('cloud','blue')}<h2>Kopia zapasowa</h2></div>
        <p class="muted">Zapisz lub przywróć swoje dane. W systemowym oknie plików możesz wybrać Dysk Google.</p>
        <div class="actions spaced">${button('export','Zapisz kopię')}${button('import','Przywróć kopię','',true)}</div>
        <h3 class="spaced">Kopia systemowa Androida</h3>
        <p class="sub">Android może automatycznie zapisywać dane na koncie Google, jeśli kopia zapasowa jest włączona w ustawieniach telefonu.</p>
      </section>
      <section class="card">
        <div class="card-title settings-heading">${badge('car')}<h2>O aplikacji</h2><span class="sub">Wersja ${esc(native.version())}</span></div>
        <h3>AutoBilans</h3><p>Twórca: ${esc(creator)}</p>

      </section>
    </div>`;
}
function currentMileage(car) {
  const readings = [car.odometer, ...expenses().map(item => item.odometer), ...skippedTanks().map(item => item.odometer)];
  return readings.reduce((highest,value) => Number.isInteger(value) && (highest == null || value > highest) ? value : highest,null);
}
function serviceSection(car) {
  const mileage = currentMileage(car);
  const rows = (car.service ?? []).map(item => {
    const remaining = item.odometer != null && mileage != null ? item.odometer-mileage : null;
    const details = [];
    if (item.date) details.push(dateLabel(item.date)+' · '+status(item.date)[0]);
    if (item.odometer != null) {
      details.push(fuelNumber(item.odometer,0)+' km');
      if (remaining != null) details.push(remaining <= 0 ? 'Limit osiągnięty' : 'Pozostało '+fuelNumber(remaining,0)+' km');
    }
    return `<div class="row"><div class="row-main">${badge('wrench','orange')}<div><h3>${esc(item.name)}</h3>
      <p class="sub">${details.join(' · ')}</p></div></div><button class="quiet" data-action="service:${item.id}">Edytuj</button></div>`;
  }).join('');
  return `<section class="card spaced">
    <div class="card-title"><h2>Serwis</h2>${button('service','Dodaj','plus',true)}</div>
    <p class="sub">${mileage == null ? 'Brak zapisanego przebiegu' : 'Zapisany przebieg · '+fuelNumber(mileage,0)+' km'}</p>
    ${rows || '<p class="empty">Dodaj np. wymianę oleju, filtrów lub opon.</p>'}
  </section>`;
}
function serviceForm(id) {
  const car = current();
  if (!car) return;
  const item = car.service?.find(entry => entry.id===id);
  openForm(item ? 'Edytuj przypomnienie' : 'Dodaj przypomnienie serwisowe',
    input('Nazwa','name',item?.name ?? 'Wymiana oleju','required maxlength="70"')+
    input('Termin (opcjonalnie)','date',item?.date,'type="date"')+
    input('Przebieg docelowy (opcjonalnie)','odometer',item?.odometer,'type="number" min="0" max="9999999"')+
    '<p class="sub">Ustaw termin, przebieg docelowy lub oba. Przebieg możesz aktualizować w garażu i przy tankowaniu.</p>',
    values => {
      const name = values.name.trim();
      if (!name || (!values.date && !values.odometer)) throw new Error('Podaj nazwę oraz datę lub przebieg.');
      if (values.odometer && !/^\d{1,7}$/.test(values.odometer)) throw new Error('Podaj przebieg w pełnych kilometrach.');
      const updated = {id:item?.id ?? newId(),name,date:values.date || null,odometer:values.odometer ? Number(values.odometer) : null};
      change(next => {
        const stored = next.cars.find(entry => entry.id===car.id);
        const service = stored.service ?? [];
        stored.service = item ? service.map(entry => entry.id===id ? updated : entry) : [...service,updated];
      });
    }, item ? next => {
      const stored = next.cars.find(entry => entry.id===car.id);
      stored.service = stored.service.filter(entry => entry.id!==id);
    } : undefined);
}
const moreLinks = [
  {route:'cars', icon:'car', detail:'Twoje samochody'},
  {route:'cards', icon:'card', detail:'Karty lojalnościowe'},
  {route:'fuel', icon:'fuel', detail:'Tankowania i spalanie'},
  {route:'stats', icon:'chart', detail:'Podsumowanie wydatków'}
];
function morePage() {
  return `<div class="heading"><h1>Więcej</h1></div>
    <div class="more-grid">${moreLinks.map(({route,icon,detail}) => `
      <a class="card more-card" href="#${route}">
        ${badge(icon)}<h2>${routeNames[route]}</h2><p class="sub">${detail}</p>
      </a>`).join('')}</div>`;
}
function render() {
  const car = current();
  const requested = location.hash.slice(1);
  const hash = ['backup','about'].includes(requested) ? 'settings' : requested;
  const route = Object.prototype.hasOwnProperty.call(routeNames,hash) ? hash : 'start';
  $('crumb').textContent = routeNames[route];
  document.querySelectorAll('nav a, #settings-link').forEach(link => {
    if (link.hash === '#'+route) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
    link.classList.toggle('nav-related', link.hash === '#more' && moreLinks.some(item => item.route === route));
  });
  $('picker').innerHTML = data.cars.length ? `<select id="active-car" aria-label="Wybierz samochód">${data.cars.map(item => `<option value="${item.id}" ${item.id===data.active?'selected':''}>${esc(item.name)}</option>`).join('')}</select>` : '';
  const pages = {
    start:() => home(car),
    cars:garage,
    expenses:() => heading('Wydatki','Historia kosztów wybranego samochodu.',car?button('expense','Dodaj wydatek','plus'):'')+(car?`<section class="card">${expenseRows(expenses(),true)}</section>`:noCar()),
    dates:() => heading('Terminy','Przegląd, koniec OC i terminy serwisowe.') +
      (car ? `<section class="card">${deadlineRows(car,true)}</section>${serviceSection(car)}` : noCar()) +
      '<p class="spaced"><a class="quiet" href="#settings">Ustawienia powiadomień</a></p>',
    stats:() => stats(car)+(car ? fuelShortcut() : ''),
    cards:cardsPage,
    fuel:fuelPage,
    settings:settingsPage,
    more:morePage
  };
  $('page').innerHTML = pages[route]();
  if (route === 'settings') window.refreshReminderStatus();
}
function openForm(title,fields,submit,remove) {
  $('form').innerHTML = `<h2>${title}</h2>${fields}<p class="form-error" role="alert" hidden></p><div class="actions"><button class="button" type="submit">Zapisz</button><button class="button secondary" type="button" data-close>Anuluj</button>${remove?'<button class="quiet danger" type="button" data-remove>Usuń</button>':''}</div>`;
  $('form').querySelector('[data-close]').onclick = () => $('dialog').close();
  if (remove) $('form').querySelector('[data-remove]').onclick = () => {
    if (!confirm('Czy na pewno usunąć ten wpis?')) return;
    try {
      change(remove);
      $('dialog').close();
      render();
      toast('Usunięto wpis.');
    } catch { toast('Nie udało się zapisać zmian.'); }
  };
  $('form').onsubmit = event => {
    event.preventDefault();
    try {
      submit(Object.fromEntries(new FormData($('form'))));
      $('dialog').close();
      render();
      toast('Zapisano.');
    } catch (error) {
      const field = $('form').querySelector('.form-error');
      field.hidden = false;
      field.textContent = error instanceof TypeError || error instanceof DOMException ? 'Nie udało się zapisać danych.' : error.message;
    }
  };
  $('dialog').showModal();
}
const input = (label,name,value='',attrs='') => `<label>${label}<input name="${name}" value="${esc(value)}" ${attrs}></label>`;
function carForm(id) {
  const car = data.cars.find(item => item.id===id);
  openForm(car?'Edytuj samochód':'Dodaj samochód',
    input('Marka i model','name',car?.name,'required maxlength="70" placeholder="np. Toyota Corolla"')+
    input('Numer rejestracyjny (opcjonalnie)','registration',car?.registration,'maxlength="16"')+
    input('Rok produkcji (opcjonalnie)','year',car?.year,`type="number" min="1886" max="${new Date().getFullYear()+1}"`)+
    `<label>Typ paliwa<select name="fuel"><option value="">Wybierz paliwo</option>${fuels.map(fuel => `<option ${car?.fuel===fuel?'selected':''}>${fuel}</option>`).join('')}</select></label>`+
    input('Przebieg (opcjonalnie)','odometer',car?.odometer,'type="number" min="0" max="9999999"'),
    values => {
      const name = values.name.trim();
      if (!name) throw new Error('Wpisz markę i model.');
      if (values.odometer && !/^\d{1,7}$/.test(values.odometer)) throw new Error('Podaj przebieg w pełnych kilometrach.');
      change(next => {
        const updated = {...car,id:car?.id ?? newId(),name,registration:values.registration.trim().toUpperCase(),year:values.year,fuel:values.fuel || '',odometer:values.odometer ? Number(values.odometer) : null};
        if (car) next.cars = next.cars.map(item => item.id===id ? updated : item);
        else { next.cars.push(updated); next.active = updated.id; }
      });
    });
}
function expenseForm(id,tank=false) {
  const car = current();
  if (!car) return;
  const item = expenses().find(entry => entry.id===id);
  const stationRequest = newId();
  const workshops = [...new Set(data.expenses.filter(entry => entry.category === 'Serwis' && entry.workshop)
    .map(entry => entry.workshop))].sort((a,b) => a.localeCompare(b,'pl'));
  openForm(item?'Edytuj wydatek':tank?'Dodaj tankowanie':'Dodaj wydatek',
    input('Kwota (zł)','amount',item?String(item.cents/100).replace('.',','):'','required inputmode="decimal" maxlength="12" placeholder="0,00"')+
    `<label>Kategoria<select name="category" id="expense-category">${categories.map(category => `<option ${item?.category===category?'selected':''}>${category}</option>`).join('')}</select></label>`+
    input('Data wydatku','date',item?.date ?? today(),'type="date" required')+
    input('Opis (opcjonalnie)','note',item?.note,'maxlength="120"')+
    `<fieldset id="tank-fields"><legend>Tankowanie</legend>
    <label>Paliwo<select name="fuel"><option value="">Wybierz paliwo</option>${fuels.map(fuel => `<option ${(item?.fuel || car.fuel)===fuel?'selected':''}>${fuel}</option>`).join('')}</select></label>
    <p class="sub">Wpisz dwie wartości: kwotę, litry lub cenę za litr. Trzecia wyliczy się automatycznie.</p>
    ${input('Litry','liters',item?.liters,'inputmode="decimal" maxlength="8" placeholder="np. 42,50"')}
    ${input('Cena za litr (zł)','unitPrice',item?.liters ? (item.cents/(100*item.liters)).toFixed(3).replace('.',',') : '', 'inputmode="decimal" maxlength="8" placeholder="np. 6,59"')}
    ${input('Przebieg (km)','odometer',item?.odometer,'type="number" min="0" max="9999999"')}
    ${input('Stacja (opcjonalnie)','station',item?.station,'maxlength="80" placeholder="np. ORLEN, Warszawa"')}
    <button class="button secondary" type="button" id="station-gps">Znajdź stację z GPS</button>
    <p class="sub">Pozycja zostaje na telefonie. <button class="quiet" type="button" data-action="station-source">Źródło: BenzynaMAPA.pl + OpenStreetMap</button></p>
    <div id="station-results" aria-live="polite"></div>
    <button class="quiet" type="button" id="skip-from-expense">Pominięto tankowanie</button>
    <label class="check-label"><input name="full" type="checkbox" ${item?.full?'checked':''}> Zalano do pełna</label>
    </fieldset>
    <fieldset id="workshop-fields"><legend>Warsztat</legend>
      <label>Wybierz warsztat<select name="workshop" id="workshop-choice">
        <option value="">Bez warsztatu</option>
        ${workshops.map((name,index) => `<option value="${index}" ${name===item?.workshop?'selected':''}>${esc(name)}</option>`).join('')}
        <option value="new">Dodaj nowy warsztat</option>
      </select></label>
      <div id="workshop-name-field">${input('Nazwa warsztatu','workshopName','','maxlength="80"')}</div>
    </fieldset>`,
    values => {
      const raw = values.amount.trim();
      if (!/^\d{1,9}([.,]\d{1,2})?$/.test(raw)) throw new Error('Wpisz kwotę w formacie 0,00.');
      const cents = Math.round(Number(raw.replace(',','.'))*100);
      if (cents <= 0) throw new Error('Kwota musi być większa od zera.');
      const fuelDetails = {};
      if (values.category === 'Paliwo' && (tank || values.liters || values.odometer || values.station?.trim() || values.full)) {
        const volume = (values.liters || '').trim();
        const liters = Number(volume.replace(',','.'));
        if (!fuels.includes(values.fuel) || !/^\d{1,4}([.,]\d{1,3})?$/.test(volume) || liters <= 0) {
          throw new Error('Wybierz typ paliwa i podaj liczbę litrów.');
        }
        if (!/^\d{1,7}$/.test(values.odometer || '')) throw new Error('Podaj przebieg w pełnych kilometrach.');
        Object.assign(fuelDetails,{fuel:values.fuel,liters,odometer:Number(values.odometer),
          station:values.station.trim(),full:values.full==='on'});
      }
      const workshop = values.category === 'Serwis' && values.workshop
        ? values.workshop === 'new' ? values.workshopName.trim() : workshops[Number(values.workshop)]
        : '';
      if (values.category === 'Serwis' && values.workshop === 'new' && !workshop) throw new Error('Wpisz nazwę warsztatu.');
      change(next => {
        const updated = {id:item?.id ?? newId(),car:car.id,cents,category:values.category,date:values.date,note:values.note.trim(),...fuelDetails};
        if (workshop) updated.workshop = workshop;
        if (item) next.expenses = next.expenses.map(entry => entry.id===id ? updated : entry);
        else next.expenses.push(updated);
      });
    }, item ? next => next.expenses = next.expenses.filter(entry => entry.id!==id) : undefined);
  const form = $('form');
  const fields = ['amount','liters','unitPrice'].map(name => form.elements.namedItem(name));
  const date = form.elements.namedItem('date');
  const station = form.elements.namedItem('station');
  station.dataset.request = stationRequest;
  $('station-gps').onclick = () => {
    $('station-gps').disabled = true;
    $('station-results').textContent = 'Szukam pobliskich stacji…';
    native.findFuelStation(stationRequest);
  };
  $('skip-from-expense').onclick = () => {
    const defaults = {date:date.value || today(),fuel:form.elements.namedItem('fuel').value,
      odometer:form.elements.namedItem('odometer').value};
    $('dialog').close();
    skipTankForm(undefined, defaults);
  };
  const category = $('expense-category');
  bindTankCalculation(fields,category);
  const tankFields = $('tank-fields');
  const workshopFields = $('workshop-fields');
  const workshopChoice = $('workshop-choice');
  const workshopName = $('workshop-name-field');
  category.addEventListener('change', updateFields);
  workshopChoice.addEventListener('change', updateFields);
  updateFields();
  function updateFields() {
    tankFields.hidden = tankFields.disabled = category.value !== 'Paliwo';
    workshopFields.hidden = workshopFields.disabled = category.value !== 'Serwis';
    workshopName.hidden = workshopChoice.value !== 'new';
    workshopName.querySelector('input').required = !workshopName.hidden;
  }
}
function bindTankCalculation(fields, category) {
  const [amount, liters, unitPrice] = fields;
  let supplied = fields.filter(field => field.value).slice(0,2);
  let calculated = supplied.length === 2 ? fields.find(field => !supplied.includes(field)) : null;
  const read = field => /^\d+([.,]\d+)?$/.test(field.value.trim()) ? Number(field.value.replace(',','.')) : 0;
  for (const field of fields) field.addEventListener('input', () => {
    if (category.value !== 'Paliwo') return;
    if (calculated && calculated !== field) calculated.value = '';
    supplied = supplied.filter(other => other !== field);
    if (field.value.trim()) supplied.unshift(field);
    supplied = supplied.slice(0,2);
    calculated = null;
    if (supplied.length !== 2 || !supplied.every(other => read(other) > 0)) return;
    const missing = fields.find(other => !supplied.includes(other));
    const result = missing === amount ? read(liters)*read(unitPrice)
      : missing === liters ? read(amount)/read(unitPrice) : read(amount)/read(liters);
    const rounded = result.toFixed(missing === amount ? 2 : 3);
    if (Number(rounded) <= 0 || rounded.length > missing.maxLength) {
      missing.value = '';
      return;
    }
    missing.value = rounded.replace('.',',');
    calculated = missing;
  });
}
window.fuelStationResults = (request, message, json) => {
  const field = $('form').elements.namedItem('station');
  if (!$('dialog').open || field?.dataset.request !== request) return;
  $('station-gps').disabled = false;
  const container = $('station-results');
  const stations = JSON.parse(json);
  container.textContent = message || (stations.length ? 'Wybierz stację' : 'Nie znaleziono nazwanych stacji w pobliżu.');
  for (const station of stations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button secondary station-option';
    button.textContent = [station.name,station.address,station.meters+' m'].filter(Boolean).join(' · ');
    button.onclick = () => {
      field.value = [station.name,station.address].filter(Boolean).join(', ').slice(0,80);
      container.textContent = '';
    };
    container.append(button);
  }
};
function dateForm(key) {
  const car = current();
  if (!car || !types[key]) return;
  const label = key==='inspection' ? 'Data przeglądu' : 'Data końca ważności OC';
  openForm(types[key].name,input(label,'date',car[key],'type="date" required'),
    values => change(next => next.cars.find(item => item.id===car.id)[key] = values.date),
    car[key] ? next => delete next.cars.find(item => item.id===car.id)[key] : undefined);
}
function exportCalendar(key) {
  const car = current();
  if (!car?.[key] || !types[key]) return;
  native.openCalendar(types[key].name+' – '+car.name,car[key]);
}
function newId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2,'0')).join('');
}
window.validateBackup = raw => {
  try {
    const entry = JSON.parse(raw);
    const validId = id => typeof id === 'string' && /^[a-f0-9-]{16,40}$/.test(id);
    const validDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
    if (!Array.isArray(entry?.cars) || !Array.isArray(entry?.expenses)) return false;
    const cars = new Set();
    for (const car of entry.cars) {
      if (!car || !validId(car.id) || cars.has(car.id) || typeof car.name !== 'string' || !car.name.trim() || car.name.length > 70 ||
          typeof car.registration !== 'string' || car.registration.length > 16 || typeof car.year !== 'string' || !/^\d{0,4}$/.test(car.year) ||
          (car.fuel != null && car.fuel !== '' && !fuels.includes(car.fuel)) || (car.inspection != null && !validDate(car.inspection)) || (car.insurance != null && !validDate(car.insurance))) return false;
      const validKm = value => Number.isInteger(value) && value >= 0 && value <= 9999999;
      if (car.odometer != null && !validKm(car.odometer)) return false;
      if (car.service != null) {
        if (!Array.isArray(car.service)) return false;
        const serviceIds = new Set();
        for (const item of car.service) {
          if (!item || !validId(item.id) || serviceIds.has(item.id) || typeof item.name !== 'string' ||
              !item.name.trim() || item.name.length > 70 || (item.date == null && item.odometer == null) ||
              (item.date != null && !validDate(item.date)) || (item.odometer != null && !validKm(item.odometer))) return false;
          serviceIds.add(item.id);
        }
      }
      cars.add(car.id);
    }
    if (cars.size ? !cars.has(entry.active) : entry.active !== null) return false;
    const ids = new Set();
    for (const item of entry.expenses) {
      if (!item || !validId(item.id) || ids.has(item.id) || !cars.has(item.car) || !Number.isSafeInteger(item.cents) ||
          item.cents <= 0 || item.cents > 99999999999 || !categories.includes(item.category) || !validDate(item.date) ||
          typeof item.note !== 'string' || item.note.length > 120 ||
          (item.workshop != null && (item.category !== 'Serwis' || typeof item.workshop !== 'string' ||
            !item.workshop.trim() || item.workshop.length > 80))) return false;
      if (item.fuel != null && (!fuels.includes(item.fuel) || item.category !== 'Paliwo' ||
          typeof item.liters !== 'number' || item.liters <= 0 || item.liters >= 10000 ||
          (!Number.isInteger(item.odometer) || item.odometer < 0 || item.odometer > 9999999) ||
          typeof item.station !== 'string' || item.station.length > 80 || typeof item.full !== 'boolean')) return false;
      ids.add(item.id);
    }
    if (Object.prototype.hasOwnProperty.call(entry,'cards')) {
      if (!Array.isArray(entry.cards)) return false;
      const cardIds = new Set();
      let favorites = 0;
      for (const item of entry.cards) {
        if (!item || !validId(item.id) || cardIds.has(item.id) || !programs.includes(item.program) ||
            typeof item.name !== 'string' || item.name.length > 50 || typeof item.value !== 'string' ||
            !item.value.trim() || item.value.length > 100 || typeof item.favorite !== 'boolean' ||
            !Object.prototype.hasOwnProperty.call(formats,item.format)) return false;
        cardIds.add(item.id);
        if (item.favorite) favorites++;
      }
      if (favorites > 1) return false;
    }
    if (Object.prototype.hasOwnProperty.call(entry,'skippedTanks')) {
      if (!Array.isArray(entry.skippedTanks)) return false;
      const skippedIds = new Set();
      for (const mark of entry.skippedTanks) {
        if (!mark || !validId(mark.id) || skippedIds.has(mark.id) || !cars.has(mark.car) ||
            !validDate(mark.date) || !fuels.includes(mark.fuel) ||
            (mark.odometer !== null && (!Number.isInteger(mark.odometer) || mark.odometer < 0 || mark.odometer > 9999999))) return false;
        skippedIds.add(mark.id);
      }
    }
    return true;
  } catch { return false; }
};
window.refreshReminderStatus = () => {
  const status = $('reminder-status');
  if (!status) return;
  const enabled = native.remindersEnabled();
  status.textContent = enabled ? 'Włączone' : 'Wyłączone';
  $('reminder-settings').textContent = enabled ? 'Ustawienia powiadomień' : 'Włącz powiadomienia';
};
document.addEventListener('click',event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  const [name,id] = action.split(':');
  if (name==='car') carForm(id);
  if (name==='expense') expenseForm(id);
  if (name==='date') dateForm(id);
  if (name==='calendar') exportCalendar(id);
  if (name==='reminder-settings') native.reminderSettings();
  if (name==='tank') expenseForm(undefined,true);
  if (name==='station-source') native.fuelStationSource();
  if (name==='nearby') native.nearbyStations();
  if (name==='loyalty') loyaltyForm(id);
  if (name==='show-card') showCard(id);
  if (name==='service') serviceForm(id);
  if (name==='skip-tank') skipTankForm(id);
  if (name==='favorite') run(next => {
    const chosen = next.cards.find(item => item.id===id);
    if (chosen) {
      const favorite = !chosen.favorite;
      next.cards.forEach(item => item.favorite = item.id===id && favorite);
    }
  });
  if (name==='export') native.exportBackup();
  if (name==='import') native.importBackup();
  if (name==='select') run(next => next.active=id,'Wybrano samochód.');
});
$('picker').addEventListener('change',event => {
  const id = event.target.value;
  run(next => next.active=id,'Wybrano samochód.');
});
window.openShortcut = action => {
  if ($('dialog').open) $('dialog').close();
  if (action === 'dates') {
    location.hash = 'dates';
  } else if (action === 'tank' || action === 'expense') {
    if (!current()) {
      location.hash = 'cars';
      carForm();
    } else {
      location.hash = action === 'tank' ? 'fuel' : 'expenses';
      expenseForm(undefined, action === 'tank');
    }
  }
};
window.addEventListener('hashchange',() => { render(); window.scrollTo(0,0); });
window.addEventListener('pageshow',render);
render();

