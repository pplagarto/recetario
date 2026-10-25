import { siteConfig } from './config.js';
import { recipes } from './data/recipes.js';
import { validPortions, scaledIngredients, shoppingList, amount, rowSignature } from './calculations.js';

const $ = selector => document.querySelector(selector);
const esc = str => String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labels = { desayuno: 'Desayuno', comida: 'Comida', cena: 'Cena' };
const storageKey = 'mi-cocina:v1';
const themes = {
  original: { name: 'Original', color: '#f7f5ef', description: 'Papel crema, verde oliva y tipografía editorial.' },
  mercado: { name: 'Mercado', color: '#fff5e3', description: 'Colores cálidos, títulos expresivos y detalles de mercado.' },
  minimal: { name: 'Minimal', color: '#f8f9fc', description: 'Blanco, tipografía limpia y acentos azules.' }
};
let theme = siteConfig.theme;
try {
  const savedTheme = localStorage.getItem('mi-cocina:theme');
  if (siteConfig.enableStylePreview && Object.hasOwn(themes, savedTheme)) theme = savedTheme;
} catch { /* Theme previews still work without browser storage. */ }
const requestedTheme = new URLSearchParams(location.search).get('estilo');
if (siteConfig.enableStylePreview && Object.hasOwn(themes, requestedTheme)) theme = requestedTheme;
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = themes[theme].color;
  document.querySelectorAll('[data-style]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.style === theme)));
}
function stylePicker() {
  if (!siteConfig.enableStylePreview) return '';
  return `<div class="style-picker"><span class="style-picker-label">Probar estilos</span><div class="style-options" role="group" aria-label="Estilo del recetario">${Object.entries(themes).map(([id, item]) => `<button class="style-option" data-style="${id}" aria-pressed="${id === theme}" title="${item.description}"><span class="style-swatch" aria-hidden="true"></span>${item.name}</button>`).join('')}</div></div>`;
}
applyTheme();
const defaults = () => ({ selected: [], portions: Object.fromEntries(recipes.map(r => [r.id, r.base])), extras: {}, checked: [] });
let state = defaults();
let storageStatus = 'ready';
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved === 'object') {
    storageStatus = 'saved';
    state.selected = recipes.filter(r => Array.isArray(saved.selected) && saved.selected.includes(r.id)).map(r => r.id);
    for (const r of recipes) {
      state.portions[r.id] = validPortions(saved.portions?.[r.id] ?? r.base);
      state.extras[r.id] = r.ingredients.filter(i => i.optional && Array.isArray(saved.extras?.[r.id]) && saved.extras[r.id].includes(i.id)).map(i => i.id);
    }
    state.checked = Array.isArray(saved.checked) ? saved.checked.filter(k => typeof k === 'string') : [];
  }
} catch { storageStatus = 'error'; }
let category = 'todas', query = '', activeRecipe = null;
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800); }
function save() {
  const signatures = shoppingList(recipes, state).map(rowSignature);
  state.checked = state.checked.filter(k => signatures.includes(k));
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    storageStatus = 'saved';
  } catch {
    storageStatus = 'error';
    toast('El navegador no permite guardar. Puedes seguir usando y descargar tu lista.');
  }
  document.querySelectorAll('[data-save-status]').forEach(el => { el.innerHTML = saveStatus(); });
}
function saveStatus() {
  const message = storageStatus === 'saved' ? 'Selección guardada en este navegador' : storageStatus === 'error' ? 'No se pudo guardar. Descarga tu lista para conservarla.' : 'Tu selección se guardará automáticamente';
  return `<span class="save-status ${storageStatus === 'error' ? 'save-error' : ''}"><span aria-hidden="true">${storageStatus === 'saved' ? '✓' : storageStatus === 'error' ? '!' : '↺'}</span>${message}</span>`;
}
const arrow = '<span aria-hidden="true">↗</span>';
const stepper = r => `<div class="stepper" aria-label="Cantidad de ${esc(r.title)}"><button type="button" data-step="-1" data-recipe="${r.id}" aria-label="Reducir cantidad de ${esc(r.title)}" ${state.portions[r.id] <= 1 ? 'disabled' : ''}>−</button><input type="number" min="1" max="100" step="1" inputmode="numeric" data-portions="${r.id}" aria-label="Cantidad de ${esc(r.title)}" value="${state.portions[r.id]}"><button type="button" data-step="1" data-recipe="${r.id}" aria-label="Aumentar cantidad de ${esc(r.title)}" ${state.portions[r.id] >= 100 ? 'disabled' : ''}>+</button></div>`;
function selectionSummary() {
  return recipes.filter(r => state.selected.includes(r.id)).map(r => `${state.portions[r.id]} ${state.portions[r.id] === 1 ? r.portion : r.plural}`).join(' · ');
}
function dock() {
  const count = state.selected.length;
  $('#nav-count').textContent = count;
  $('#selection-dock').innerHTML = count && location.hash !== '#compras' ? `<aside class="selection-bar" aria-label="Tu selección"><span class="selection-icon" aria-hidden="true">✓</span><div><strong>${count} ${count === 1 ? 'receta seleccionada' : 'recetas seleccionadas'}</strong><small>${selectionSummary()}</small></div><button class="text-button clear-selection">Limpiar</button><button class="button primary confirm">Crear lista de compras <span aria-hidden="true">→</span></button></aside>` : '';
  document.body.classList.toggle('has-selection', Boolean(count && location.hash !== '#compras'));
}
function card(r, index) {
  const selected = state.selected.includes(r.id);
  return `<article class="recipe-card ${selected ? 'selected' : ''}"><div class="card-visual"><button class="image-button" data-open="${r.id}" aria-label="Ver receta: ${esc(r.title)}"><img src="assets/${r.image}.svg" alt="Ilustración de ${esc(r.title.toLowerCase())}"></button><span class="image-badge">${r.badge}</span><label class="select-recipe"><input type="checkbox" data-select="${r.id}" ${selected ? 'checked' : ''} aria-label="Seleccionar ${esc(r.title)}"><span aria-hidden="true"></span></label></div><div class="card-content"><div class="card-eyebrow"><span>${r.categories.map(c => labels[c]).join(' / ')}</span><span class="recipe-index">0${index + 1}</span></div><h3><button data-open="${r.id}">${r.title}</button></h3><p>${r.short}</p><div class="recipe-meta"><span aria-hidden="true">◷</span> ${r.time}<span class="card-tag">${r.badge}</span></div></div><div class="card-bottom"><div><span class="portion-label">${r.plural}</span>${stepper(r)}</div><button class="recipe-link" data-open="${r.id}">Ver receta ${arrow}</button></div></article>`;
}
function renderCards() {
  const normalized = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = recipes.filter(r => (category === 'todas' || r.categories.includes(category)) && normalized(`${r.title} ${r.ingredients.map(i => i.name).join(' ')}`).includes(normalized(query.trim())));
  $('#recipe-grid').innerHTML = filtered.length ? filtered.map(r => card(r, recipes.indexOf(r))).join('') : `<div class="empty-state"><span>⌕</span><h3>No encontramos esa receta</h3><p>Prueba otro nombre o ingrediente, o cambia la categoría.</p><button class="button secondary reset-filter">Ver todas las recetas</button></div>`;
  $('#result-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'receta' : 'recetas'}`;
  dock();
}
function renderHome() {
  $('#app').innerHTML = `<section class="page-intro"><h1>Recetario de pepe</h1>${stylePicker()}</section><section class="collection" aria-label="Recetas"><div class="section-heading"><label class="search"><span aria-hidden="true">⌕</span><input type="search" id="search" placeholder="Buscar receta o ingrediente" aria-label="Buscar receta o ingrediente" value="${esc(query)}"><kbd>/</kbd></label></div><div class="save-info" data-save-status role="status">${saveStatus()}</div><div class="filter-row"><div class="filters" role="group" aria-label="Filtrar por categoría">${[['todas','Todas'],...Object.entries(labels)].map(([id, label]) => `<button data-category="${id}" class="filter ${category === id ? 'active' : ''}" aria-pressed="${category === id}">${label}<span>${recipes.filter(r => id === 'todas' || r.categories.includes(id)).length}</span></button>`).join('')}</div><span id="result-count" class="muted"></span></div><div id="recipe-grid" class="recipe-grid"></div><div class="collection-note"><span aria-hidden="true">＋</span><div><strong>Este recetario apenas comienza.</strong><p>Las próximas recetas que me compartas tendrán su lugar aquí.</p></div><span class="note-label">Hecho a tu gusto</span></div></section>`;
  renderCards();
}
function ingredientRow(i) {
  return `<li class="ingredient-row"><span>${i.name}${i.section ? `<small>${i.section}</small>` : ''}${i.note ? `<small>${i.note}</small>` : ''}</span><strong>${amount(i)}</strong></li>`;
}
function renderDialog() {
  const r = recipes.find(r => r.id === activeRecipe);
  if (!r) return;
  const extras = state.extras[r.id] || [];
  const ingredients = scaledIngredients(r, state.portions[r.id], extras);
  const optional = r.ingredients.filter(i => i.optional);
  const selected = state.selected.includes(r.id);
  $('#recipe-dialog').innerHTML = `<button class="dialog-close" aria-label="Cerrar receta">×</button><div class="detail-cover"><img src="assets/${r.image}.svg" alt="Ilustración de ${r.title}"><span class="image-badge">${r.badge}</span></div><div class="detail-body"><div class="eyebrow">${r.categories.map(c => labels[c]).join(' · ')} <span> / </span> ${r.time}</div><h2 id="recipe-title">${r.title}</h2><p class="detail-description">${r.description}</p><div class="detail-controls"><div><strong>¿${r.id === 'burritos' ? 'Cuántos' : 'Cuántas'} ${r.plural}?</strong><small>Receta base: ${r.base} ${r.base === 1 ? r.portion : r.plural}</small></div>${stepper(r)}</div><div class="detail-columns"><section><h3>Ingredientes <span class="heading-count">${ingredients.length}</span></h3><ul class="ingredients">${ingredients.map(ingredientRow).join('')}</ul>${optional.length ? `<div class="extras"><h4>Hazla a tu gusto</h4><p>Estos extras son opcionales. Al activarlos, se suman a tus compras.</p>${optional.map(i => `<label><input type="checkbox" data-extra="${i.id}" data-recipe="${r.id}" ${extras.includes(i.id) ? 'checked' : ''}>${i.name}</label>`).join('')}</div>` : ''}</section><section><h3>Manos a la cocina</h3><ol class="steps">${r.steps.map((s, index) => `<li><span>${index+1}</span><p>${s}</p></li>`).join('')}</ol><div class="storage-note"><h4>Para guardar y disfrutar después</h4><p>${r.storage}</p></div></section></div><details class="source-notes"><summary>Notas y cantidades de la receta original</summary><ul>${r.notes.map(n => `<li>${n}</li>`).join('')}</ul><a href="data/recetario-original.md" target="_blank" rel="noopener">Consultar recetario original ↗</a></details><div class="detail-action"><span>${state.portions[r.id]} ${state.portions[r.id] === 1 ? r.portion : r.plural} · ingredientes ajustados</span><button class="button ${selected ? 'secondary' : 'primary'}" data-toggle-detail="${r.id}">${selected ? '✓ En tu selección · Quitar' : '+ Agregar a mi selección'}</button></div></div>`;
}
function openRecipe(id) { activeRecipe = id; renderDialog(); $('#recipe-dialog').showModal(); document.body.classList.add('modal-open'); }
function closeRecipe() { $('#recipe-dialog').close(); activeRecipe = null; document.body.classList.remove('modal-open'); }
function renderShopping() {
  const rows = shoppingList(recipes, state);
  const selected = recipes.filter(r => state.selected.includes(r.id));
  const done = rows.filter(i => state.checked.includes(rowSignature(i))).length;
  const groups = ['Frutas y verduras', 'Carnes', 'Lácteos y huevos', 'Pan y tortillas', 'Despensa', 'Básicos de casa'];
  $('#app').innerHTML = `<section class="shopping-page"><a class="back-link" href="#recetas">← Volver al recetario</a><div class="shopping-heading"><div><div class="eyebrow">DE TU COCINA AL MERCADO</div><h1>Tu lista de <em>compras.</em></h1><p>Las cantidades que necesitas, todas en un solo lugar.</p></div><div class="shopping-actions">${rows.length ? '<button class="button secondary" id="copy-list">Copiar</button><button class="button secondary" id="download-list">Descargar</button><button class="button primary" id="print-list">Imprimir ↗</button>' : ''}</div></div>${!rows.length ? `<div class="empty-state"><span>✳</span><h2>Algo rico empieza con una receta</h2><p>Selecciona tus recetas y ajusta las porciones para crear tu lista.</p><a class="button primary" href="#recetas">Explorar el recetario →</a></div>` : `<div class="shopping-layout"><aside class="plan-summary"><div class="eyebrow">TU PLAN</div><h2>${selected.length} ${selected.length === 1 ? 'receta elegida' : 'recetas elegidas'}</h2>${selected.map(r => `<div class="plan-recipe"><img src="assets/${r.image}.svg" alt=""><div><button data-open="${r.id}">${r.title}</button><small>${r.plural}</small>${stepper(r)}</div><button class="remove-recipe" data-remove="${r.id}" aria-label="Quitar ${r.title}">×</button></div>`).join('')}<a href="#recetas" class="recipe-link">+ Agregar más recetas</a><div class="plan-tip"><span>✳</span><p>Revisa tu despensa antes de salir. Marca lo que ya tengas o vayas comprando.</p></div><p class="local-note">Al volver a esta dirección en el mismo navegador, recuperas tu selección, porciones y productos marcados. Evita el modo privado y borrar los datos del sitio. Puedes descargar tu lista para llevarla contigo.</p></aside><div class="shopping-list"><div class="save-info" data-save-status role="status">${saveStatus()}</div><div class="shopping-progress"><div><strong id="progress-text">${done} de ${rows.length} ingredientes listos</strong><button class="text-button" id="uncheck-all">Desmarcar todo</button></div><progress max="${rows.length}" value="${done}" aria-label="Ingredientes listos"></progress></div>${groups.map(group => {
    const items = rows.filter(i => i.group === group);
    return items.length ? `<section class="shopping-group"><h2>${group}<span>${items.length}</span></h2>${items.map(i => `<label class="shopping-item ${state.checked.includes(rowSignature(i)) ? 'is-checked' : ''}"><input type="checkbox" data-check="${esc(rowSignature(i))}" ${state.checked.includes(rowSignature(i)) ? 'checked' : ''}><span class="shopping-item-name"><strong>${i.name}</strong><small>${i.sources.join(' · ')}</small>${i.notes.length ? `<small>${i.notes.join(' ')}</small>` : ''}${i.roundPurchase && i.qty % 1 > .00001 ? `<small class="purchase-tip">Compra ${Math.ceil(i.qty)} ${i.unit === 'lata' ? 'latas' : 'cuñas'}; usa ${amount(i)}.</small>` : ''}</span><span class="shopping-amount">${amount(i)}</span></label>`).join('')}</section>` : '';
  }).join('')}<p class="list-footnote">Las cantidades son proporcionales a tu selección. Los rangos y los ingredientes “al gusto” se conservan. Las presentaciones de compra se redondean solo donde se indica.</p></div></div>`}</section>`;
  dock();
}
function render() {
  const shopping = location.hash === '#compras';
  $('#nav-recipes').classList.toggle('current', !shopping); $('#nav-shopping').classList.toggle('current', shopping);
  if (shopping) renderShopping(); else renderHome();
}
function refresh() { save(); render(); if (activeRecipe) renderDialog(); }
function changePortions(id, value) { state.portions[id] = validPortions(value); refresh(); }
function toggleSelection(id) { state.selected = state.selected.includes(id) ? state.selected.filter(v => v !== id) : [...state.selected, id]; refresh(); }
function listText() {
  const rows = shoppingList(recipes, state);
  let text = 'MI COCINA · LISTA DE COMPRAS\n\n' + recipes.filter(r => state.selected.includes(r.id)).map(r => `${r.title}: ${state.portions[r.id]} ${state.portions[r.id] === 1 ? r.portion : r.plural}`).join('\n');
  for (const group of [...new Set(rows.map(i => i.group))]) text += `\n\n${group.toUpperCase()}\n` + rows.filter(i => i.group === group).map(i => `${state.checked.includes(rowSignature(i)) ? '[x]' : '[ ]'} ${i.name}: ${amount(i)}${i.notes.length ? ' (' + i.notes.join(' ') + ')' : ''}${i.roundPurchase && i.qty % 1 > .00001 ? ' · Compra ' + Math.ceil(i.qty) + ' ' + (i.unit === 'lata' ? 'latas' : 'cuñas') : ''}`).join('\n');
  return text + '\n';
}
document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (siteConfig.enableStylePreview && button.dataset.style && Object.hasOwn(themes, button.dataset.style)) {
    theme = button.dataset.style;
    const url = new URL(location.href);
    url.searchParams.set('estilo', theme);
    history.replaceState(null, '', url);
    applyTheme();
    try { localStorage.setItem('mi-cocina:theme', theme); }
    catch { toast('Puedes probar este estilo, pero el navegador no permite guardar tu preferencia.'); }
    return;
  }
  if (button.dataset.open) openRecipe(button.dataset.open);
  if (button.classList.contains('dialog-close')) closeRecipe();
  if (button.dataset.step) {
    const id = button.dataset.recipe, delta = button.dataset.step;
    const inDialog = Boolean(button.closest('dialog'));
    changePortions(id, state.portions[id] + Number(delta));
    (inDialog ? $('#recipe-dialog') : $('#app')).querySelector(`[data-recipe="${id}"][data-step="${delta}"]`)?.focus();
  }
  if (button.dataset.category) {
    category = button.dataset.category;
    document.querySelectorAll('[data-category]').forEach(b => { b.classList.toggle('active', b.dataset.category === category); b.setAttribute('aria-pressed', String(b.dataset.category === category)); });
    renderCards();
  }
  if (button.dataset.toggleDetail) { const id = button.dataset.toggleDetail; toggleSelection(id); $(`[data-toggle-detail="${id}"]`)?.focus(); }
  if (button.dataset.remove) { state.selected = state.selected.filter(id => id !== button.dataset.remove); refresh(); }
  if (button.classList.contains('clear-selection')) { state.selected = []; refresh(); }
  if (button.classList.contains('confirm')) { location.hash = 'compras'; window.scrollTo(0, 0); }
  if (button.classList.contains('reset-filter')) { category = 'todas'; query = ''; renderHome(); }
  if (button.id === 'uncheck-all') { state.checked = []; refresh(); }
  if (button.id === 'print-list') window.print();
  if (button.id === 'copy-list') {
    try { await navigator.clipboard.writeText(listText()); toast('Lista copiada. Lista para llevar.'); } catch { toast('No se pudo copiar. Usa Descargar para guardar tu lista.'); }
  }
  if (button.id === 'download-list') {
    const url = URL.createObjectURL(new Blob([listText()], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'mi-lista-de-compras.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Tu lista se descargó.');
  }
});
document.addEventListener('change', event => {
  const el = event.target;
  if (el.dataset.select) {
    const id = el.dataset.select; toggleSelection(id); $(`[data-select="${id}"]`)?.focus();
  }
  if (el.dataset.portions) changePortions(el.dataset.portions, el.value);
  if (el.dataset.extra) {
    const id = el.dataset.recipe, extra = el.dataset.extra;
    state.extras[id] = el.checked ? [...(state.extras[id] || []), extra] : (state.extras[id] || []).filter(i => i !== extra);
    refresh(); $(`[data-extra="${extra}"]`)?.focus();
  }
  if (el.dataset.check) {
    state.checked = el.checked ? [...state.checked, el.dataset.check] : state.checked.filter(k => k !== el.dataset.check);
    save(); el.closest('.shopping-item').classList.toggle('is-checked', el.checked);
    const rows = shoppingList(recipes, state); const count = rows.filter(i => state.checked.includes(rowSignature(i))).length;
    $('#progress-text').textContent = `${count} de ${rows.length} ingredientes listos`; $('progress').value = count;
  }
});
document.addEventListener('input', event => {
  const el = event.target;
  if (el.id === 'search') { query = el.value; renderCards(); }
  if (el.dataset.portions && el.value !== '' && Number.isInteger(Number(el.value)) && Number(el.value) >= 1) {
    const id = el.dataset.portions;
    const inDialog = Boolean(el.closest('dialog'));
    changePortions(id, el.value);
    (inDialog ? $('#recipe-dialog') : $('#app')).querySelector(`[data-portions="${id}"]`)?.focus({ preventScroll: true });
  }
});
document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName) && !activeRecipe) { event.preventDefault(); $('#search')?.focus(); } });
$('#recipe-dialog').addEventListener('click', event => { if (event.target === $('#recipe-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeRecipe(); } });
$('#recipe-dialog').addEventListener('close', () => { activeRecipe = null; document.body.classList.remove('modal-open'); });
window.addEventListener('hashchange', () => { if (activeRecipe) closeRecipe(); render(); window.scrollTo(0, 0); });
render();
