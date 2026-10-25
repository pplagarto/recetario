import { scaledIngredients, shoppingList } from './calculations.js';

export const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
export const pantryKey = item => `${item.id}:${item.unit}`;
export function ingredientCatalog(recipes) {
  const items = new Map();
  for (const recipe of recipes) for (const item of recipe.ingredients) {
    if (!items.has(pantryKey(item))) items.set(pantryKey(item), { ...item, key: pantryKey(item) });
  }
  return [...items.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
export function cleanPantry(value, catalog) {
  const result = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const { key } of catalog) {
    if (!Object.hasOwn(value, key)) continue;
    const qty = value[key];
    if (qty === null || (typeof qty === 'number' && Number.isFinite(qty) && qty >= 0)) result[key] = qty;
  }
  return result;
}
// Quantities use the recipe's units. Unknown quantities are never deducted.
export function compareIngredient(item, pantry) {
  const stock = pantry[pantryKey(item)];
  const present = stock === null || (Number.isFinite(stock) && stock > 0);
  const uncertain = present && (stock === null || item.qty === null || item.toTaste);
  const deduct = present && stock !== null && item.qty !== null ? stock : 0;
  const low = item.qty === null ? null : Math.max(0, item.qty - deduct);
  const high = item.qty === null ? null : Math.max(0, (item.max ?? item.qty) - deduct);
  const missing = !present || (stock !== null && high > 1e-8);
  const remaining = { ...item, qty: low, max: high !== null && Math.abs(high - low) > 1e-8 ? high : undefined };
  // An unquantified addition still needs reviewing when measured requirements are covered.
  if (uncertain && high === 0) { remaining.qty = null; remaining.max = undefined; }
  return { item, stock, present, review: Boolean(uncertain), missing, covered: present && !uncertain && !missing, remaining };
}
export function recommendRecipes(recipes, pantry, portions = {}, extras = {}) {
  return recipes.map(recipe => {
    const checks = scaledIngredients(recipe, portions[recipe.id] ?? recipe.base, extras[recipe.id] || []).map(i => compareIngredient(i, pantry));
    const used = checks.filter(i => i.present).length;
    const missing = checks.filter(i => i.missing);
    const review = checks.filter(i => i.review);
    return { recipe, checks, used, missing, review, ready: checks.every(i => i.covered) };
  }).sort((a, b) => Number(b.ready) - Number(a.ready) || Number(!b.missing.length) - Number(!a.missing.length) || b.used - a.used || a.missing.length - b.missing.length || a.recipe.title.localeCompare(b.recipe.title, 'es'));
}
export function pantryShoppingList(recipes, state) {
  // Aggregate first: the same stock cannot be spent twice across selected recipes.
  return shoppingList(recipes, state).map(item => {
    const check = compareIngredient(item, state.pantry || {});
    return { ...(state.onlyMissing ? check.remaining : item), pantryCheck: check };
  }).filter(item => !state.onlyMissing || !item.pantryCheck.covered);
}

const aliases = {
  avena: ['harina de avena'], cacao: ['cacao', 'cacao en polvo'], 'azucar-coco': ['azucar de coco'],
  'polvo-hornear': ['polvo para hornear'], chocolate: ['chocolate', 'chispas de chocolate'], yogur: ['yogur griego', 'yogurt griego', 'yogur griego natural'], huevo: ['huevo', 'huevos'], clara: ['clara', 'claras', 'claras de huevo'], vainilla: ['vainilla'],
  tortilla: ['tortillas de harina', 'tortillas de harina grandes'], carne: ['carne molida', 'carne molida magra'], 'cebolla-amarilla': ['cebolla amarilla'], 'tomate-lata': ['tomate enlatado', 'tomate triturado en lata'], 'queso-cremoso': ['laughing cow', 'queso laughing cow'], mozzarella: ['mozzarella'], aceite: ['aceite'], 'ajo-polvo': ['ajo en polvo'], oregano: ['oregano', 'oregano seco'], pimienta: ['pimienta', 'pimienta negra'], sal: ['sal'], pimiento: ['pimiento', 'pimiento morron'], frijol: ['frijoles negros', 'frijoles negros cocidos'], poblano: ['poblano', 'chile poblano'], comino: ['comino'], paprika: ['paprika', 'paprika ahumada'],
  pollo: ['pollo', 'pechuga', 'pechuga de pollo'], garbanzo: ['garbanzos en lata'], jitomate: ['jitomate', 'jitomates', 'tomate fresco'], cebolla: ['cebolla'], ajo: ['ajo'], calabaza: ['calabacita', 'calabacitas'], chayote: ['chayote'], zanahoria: ['zanahoria', 'zanahorias'], elote: ['elote', 'granos de elote'], chipotle: ['chipotle', 'chipotles', 'chipotles adobados'], apio: ['apio'], perejil: ['perejil'], laurel: ['laurel'], 'aceite-oliva': ['aceite de oliva'], agua: ['agua'], ejotes: ['ejotes'], panela: ['panela', 'queso panela'], aguacate: ['aguacate', 'aguacates'], limon: ['limon', 'limones']
};
const units = { g: ['g', 'gr', 'gramo', 'gramos'], kg: ['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'], l: ['l', 'litro', 'litros'], ml: ['ml', 'mililitros'], pieza: ['pieza', 'piezas', 'pza', 'pzas'], lata: ['lata', 'latas'], cda: ['cda', 'cdas', 'cucharada', 'cucharadas'], cdta: ['cdta', 'cdtas', 'cucharadita', 'cucharaditas'], diente: ['diente', 'dientes'], tallo: ['tallo', 'tallos'], manojo: ['manojo', 'manojos'], hoja: ['hoja', 'hojas'], cuña: ['cuna', 'cunas'] };
export function parsePantryText(text, catalog) {
  const found = new Map(), unmatched = [];
  // Commas separate ingredients; decimal commas are accepted between digits.
  const parts = String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/(\d),(\d)/g, '$1.$2').replace(/^(?:yo )?(?:tengo|hay|en mi cocina tengo|en casa tengo)\s+/, '').split(/[,;\n]+|\s+y\s+/);
  for (const raw of parts) {
    const part = normalize(raw); if (!part) continue;
    let name = part, qty = null, unit = '', warning = '';
    const match = part.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
      qty = Number(match[1]); name = match[2];
      for (const [canonical, variants] of Object.entries(units)) {
        const token = variants.find(v => name === v || name.startsWith(v + ' '));
        if (token) { unit = canonical; name = name.slice(token.length).trim(); break; }
      }
      name = name.replace(/^de\s+/, '');
    }
    const candidates = catalog.filter(i => normalize(i.name) === name || (aliases[i.id] || []).includes(name));
    if (candidates.length !== 1 || (qty !== null && !Number.isFinite(qty))) { unmatched.push(part); continue; }
    const item = candidates[0];
    if (qty !== null) {
      if (unit === 'kg' && item.unit === 'g') qty *= 1000;
      else if (unit === 'ml' && item.unit === 'l') qty /= 1000;
      else if (unit !== item.unit && !(unit === '' && item.unit === 'pieza')) {
        qty = null; warning = `Revisa la cantidad en ${item.unit}; no convertimos esa unidad.`;
      }
    }
    if (qty !== null && !Number.isFinite(qty)) { unmatched.push(part); continue; }
    if (found.has(item.key)) warning = 'Ingrediente repetido: se conserva la última mención. Revisa la cantidad.';
    found.set(item.key, { ...item, qty, warning });
  }
  return { found: [...found.values()], unmatched };
}
