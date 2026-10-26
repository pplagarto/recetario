import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recipes, pendingRecipes } from '../data/recipes.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataPath = path.join(root, 'data/user-recipes.json');
const modulePath = path.join(root, 'data/user-recipes.js');
const idPattern = /^[a-z][a-z0-9-]*$/;
const categories = new Set(['desayuno', 'comida', 'cena']);
const groups = new Set(['Frutas y verduras', 'Carnes', 'Lácteos y huevos', 'Pan y tortillas', 'Despensa', 'Básicos de casa']);
const units = new Set(['g', 'l', 'pieza', 'lata', 'cda', 'cdta', 'diente', 'tallo', 'manojo', 'hoja', 'cuña']);
const safeText = (value, label) => {
  if (typeof value !== 'string' || !value.trim() || /[<>\u0000-\u001f]/u.test(value)) throw new Error(`${label}: escribe texto no vacío, sin etiquetas HTML.`);
  return value.trim();
};
const safeId = (value, label) => {
  if (typeof value !== 'string' || !idPattern.test(value)) throw new Error(`${label}: usa letras minúsculas, números y guiones; empieza con una letra.`);
  return value;
};
const textArray = (value, label) => {
  if (!Array.isArray(value) || !value.length) throw new Error(`${label}: se requiere al menos un elemento.`);
  return value.map((item, index) => safeText(item, `${label}[${index}]`));
};
const optionalTextArray = (value, label) => value === undefined ? [] : Array.isArray(value) ? value.map((item, index) => safeText(item, `${label}[${index}]`)) : (() => { throw new Error(`${label}: debe ser una lista.`); })();
const validateCategories = value => {
  if (!Array.isArray(value) || !value.length || value.some(item => !categories.has(item))) throw new Error('categories: usa desayuno, comida y/o cena.');
  return [...new Set(value)];
};
const validateIngredient = (item, index) => {
  const label = `ingredients[${index}]`;
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${label}: se requiere un ingrediente con campos.`);
  const ingredient = {
    id: safeId(item.id, `${label}.id`),
    name: safeText(item.name, `${label}.name`),
    qty: item.qty,
    unit: item.unit,
    group: item.group
  };
  if (ingredient.qty !== null && !(typeof ingredient.qty === 'number' && Number.isFinite(ingredient.qty) && ingredient.qty > 0)) throw new Error(`${label}.qty: usa un número positivo o null si es al gusto.`);
  if (!units.has(ingredient.unit)) throw new Error(`${label}.unit: unidad no admitida. Convierte kg a g y ml a l.`);
  if (!groups.has(ingredient.group)) throw new Error(`${label}.group: grupo de compras no admitido.`);
  if (item.max !== undefined) {
    if (ingredient.qty === null || typeof item.max !== 'number' || !Number.isFinite(item.max) || item.max < ingredient.qty) throw new Error(`${label}.max: debe ser mayor o igual que qty.`);
    ingredient.max = item.max;
  }
  for (const key of ['optional', 'approx', 'roundPurchase']) if (item[key] !== undefined) {
    if (typeof item[key] !== 'boolean') throw new Error(`${label}.${key}: usa true o false.`);
    ingredient[key] = item[key];
  }
  for (const key of ['note', 'section']) if (item[key] !== undefined) ingredient[key] = safeText(item[key], `${label}.${key}`);
  return ingredient;
};
export function validateRecipe(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('La ficha debe ser un objeto JSON.');
  const status = input.status;
  if (!['complete', 'pending'].includes(status)) throw new Error('status: usa "complete" o "pending".');
  const common = {
    id: safeId(input.id, 'id'),
    title: safeText(input.title, 'title'),
    short: safeText(input.short, 'short'),
    categories: validateCategories(input.categories),
    image: input.image === undefined ? 'placeholder' : safeId(input.image, 'image')
  };
  if (status === 'pending') return { status, recipe: {
    ...common,
    original: safeText(input.original ?? input.title, 'original'),
    yield: safeText(input.yield ?? 'No indicado', 'yield'),
    ingredients: textArray(input.ingredients, 'ingredients'),
    missing: safeText(input.missing, 'missing')
  } };
  if (!Number.isInteger(input.base) || input.base < 1 || input.base > 100) throw new Error('base: indica el rendimiento original entre 1 y 100.');
  if (!Array.isArray(input.ingredients) || !input.ingredients.length) throw new Error('ingredients: faltan ingredientes medidos.');
  const ingredients = input.ingredients.map(validateIngredient);
  if (new Set(ingredients.map(item => `${item.id}:${item.unit}`)).size !== ingredients.length) throw new Error('ingredients: hay identificadores y unidades duplicados.');
  if (ingredients.some(item => item.qty === null && !['sal', 'pimienta'].includes(item.id))) throw new Error('ingredients: una receta completa necesita cantidades; deja sin medir solo sal o pimienta al gusto.');
  return { status, recipe: {
    ...common,
    description: safeText(input.description, 'description'),
    base: input.base,
    portion: safeText(input.portion, 'portion'),
    plural: safeText(input.plural, 'plural'),
    time: safeText(input.time ?? 'Tiempo no indicado', 'time'),
    badge: safeText(input.badge ?? 'Receta nueva', 'badge'),
    ingredients,
    steps: textArray(input.steps, 'steps'),
    storage: safeText(input.storage ?? 'Conservar según los ingredientes y el método de preparación.', 'storage'),
    notes: optionalTextArray(input.notes, 'notes'),
    source: null
  } };
}

async function main() {
  const [flag, filename] = process.argv.slice(2);
  const dryRun = flag === '--check';
  const file = dryRun ? filename : flag;
  if (!file || (dryRun && !filename)) throw new Error('Uso: npm run recipe:add -- ruta/receta.json o npm run recipe:check -- ruta/receta.json');
  const input = JSON.parse(await readFile(path.resolve(file), 'utf8'));
  const { status, recipe } = validateRecipe(input);
  await access(path.join(root, 'assets', `${recipe.image}.svg`));
  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  const complete = recipes.find(item => item.id === recipe.id);
  const pending = pendingRecipes.find(item => item.id === recipe.id);
  if (complete) throw new Error(`Ya existe una receta completa con id "${recipe.id}".`);
  if (pending && status === 'pending') throw new Error(`Ya existe una ficha pendiente con id "${recipe.id}".`);
  const prior = recipes.flatMap(item => item.ingredients);
  for (const item of status === 'complete' ? recipe.ingredients : []) {
    const known = prior.find(ingredient => ingredient.id === item.id && ingredient.unit === item.unit);
    if (known && known.name !== item.name) throw new Error(`El ingrediente ${item.id}:${item.unit} ya se llama "${known.name}". Usa ese nombre para sumar compras correctamente.`);
  }
  if (dryRun) { console.log(`Ficha válida: ${recipe.title} (${status}). No se modificaron archivos.`); return; }
  if (status === 'complete') {
    data.pending = data.pending.filter(item => item.id !== recipe.id);
    data.complete.push(recipe);
  } else data.pending.push(recipe);
  await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
  await writeFile(modulePath, `// Generated by npm run recipe:add. Edit data/user-recipes.json through the importer.\nexport const userRecipes = ${JSON.stringify(data.complete, null, 2)};\nexport const userPendingRecipes = ${JSON.stringify(data.pending, null, 2)};\n`);
  console.log(`Agregada: ${recipe.title}. Ejecuta npm test && npm run build; después revisa y publica el cambio.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
