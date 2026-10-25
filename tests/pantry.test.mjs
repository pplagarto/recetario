import test from 'node:test';
import assert from 'node:assert/strict';
import { recipes } from '../data/recipes.js';
import { ingredientCatalog, cleanPantry, parsePantryText, compareIngredient, recommendRecipes, pantryShoppingList } from '../pantry.js';
const catalog = ingredientCatalog(recipes);
const item = (id, unit = 'g', qty = 100, max) => ({ id, unit, qty, max });

test('la despensa recupera solo ingredientes y cantidades válidos sin asumir básicos', () => {
  assert.deepEqual(cleanPantry({ 'carne:g': 300, 'sal:cdta': null, 'pollo:g': -2, 'huevo:pieza': '2', 'avena:g': Infinity, 'fantasma:g': 1 }, catalog), { 'carne:g': 300, 'sal:cdta': null });
  assert.deepEqual(cleanPantry(undefined, catalog), {});
  assert.equal(catalog.filter(i => i.id === 'oregano').length, 1);
  assert.ok(catalog.some(i => i.id === 'ejotes'));
});
test('texto reconoce lista, plurales, acentos, líneas y conversiones compatibles', () => {
  const result = parsePantryText('Tengo 0,5 kg de carne molida, 4 tortillas de harina y sal\n500 ml de agua', catalog);
  assert.deepEqual(result.unmatched, []);
  assert.deepEqual(result.found.map(i => [i.id, i.qty]), [['carne', 500], ['tortilla', 4], ['sal', null], ['agua', .5]]);
});
test('no confunde productos ni inventa equivalencias de unidades', () => {
  const result = parsePantryText('queso, arroz, avena, 200 g de garbanzos en lata, ajo y ajo en polvo', catalog);
  assert.deepEqual(result.unmatched, ['queso', 'arroz', 'avena']);
  assert.equal(result.found[0].qty, null);
  assert.match(result.found[0].warning, /no convertimos/);
  assert.deepEqual(result.found.slice(1).map(i => i.id), ['ajo', 'ajo-polvo']);
});
test('tener sin cantidad requiere revisión; cero no cuenta como disponible', () => {
  assert.equal(compareIngredient(item('carne'), { 'carne:g': null }).review, true);
  assert.equal(compareIngredient(item('carne'), { 'carne:g': null }).covered, false);
  assert.equal(compareIngredient(item('carne'), { 'carne:g': 0 }).present, false);
  assert.equal(compareIngredient(item('sal','cdta',null), { 'sal:cdta': 10 }).review, true);
});
test('faltantes usan rango completo y cantidades acordes a porciones', () => {
  const result = compareIngredient(item('cebolla-amarilla','g',167,170), {'cebolla-amarilla:g':168});
  assert.equal(result.missing, true);
  assert.equal(result.remaining.qty, 0);
  assert.equal(result.remaining.max, 2);
  const recommended = recommendRecipes(recipes, {'carne:g':600}, {burritos:8}).find(r => r.recipe.id === 'burritos');
  assert.equal(recommended.missing.find(c => c.item.id === 'carne').remaining.qty, 600);
});
test('primero recetas completas, después mayor aprovechamiento; extras solo si se eligieron', () => {
  const pantry = Object.fromEntries(recipes[0].ingredients.map(i => [`${i.id}:${i.unit}`, i.qty]));
  pantry['carne:g'] = 600;
  const ranked = recommendRecipes(recipes, pantry);
  assert.equal(ranked[0].recipe.id, 'brownies');
  assert.equal(ranked[0].ready, true);
  assert.equal(ranked[1].recipe.id, 'burritos');
  assert.ok(!ranked[1].checks.some(c => c.item.id === 'pimiento'));
  const extras = recommendRecipes(recipes, pantry, {}, {burritos:['pimiento']});
  assert.ok(extras.find(r => r.recipe.id === 'burritos').missing.some(c => c.item.id === 'pimiento'));
});
test('ingredientes registrados sin cantidades nunca se anuncian como suficientes', () => {
  const pantry = Object.fromEntries(recipes[0].ingredients.map(i => [`${i.id}:${i.unit}`, null]));
  const result = recommendRecipes(recipes, pantry)[0];
  assert.equal(result.recipe.id, 'brownies');
  assert.equal(result.missing.length, 0);
  assert.equal(result.review.length, 9);
  assert.equal(result.ready, false);
});
test('compras descuentan una sola vez la existencia compartida y conservan revisión al gusto', () => {
  const state = {selected:['burritos','caldo'], portions:{}, extras:{}, pantry:{'oregano:cdta':1, 'sal:cdta':1}, onlyMissing:true};
  const rows = pantryShoppingList(recipes, state);
  assert.equal(rows.find(i => i.id === 'oregano').qty, .5);
  assert.equal(rows.find(i => i.id === 'sal').qty, null);
  assert.equal(rows.find(i => i.id === 'sal').pantryCheck.review, true);
  assert.equal(pantryShoppingList(recipes, {...state,onlyMissing:false}).find(i => i.id === 'oregano').qty,1.5);
});
test('plan cubierto no genera compras; cantidades desconocidas conservan el requerimiento', () => {
  const pantry = Object.fromEntries(recipes[0].ingredients.map(i => [`${i.id}:${i.unit}`, i.qty]));
  const state = {selected:['brownies'], portions:{}, extras:{}, pantry, onlyMissing:true};
  assert.deepEqual(pantryShoppingList(recipes, state), []);
  pantry['avena:g'] = null;
  assert.equal(pantryShoppingList(recipes,state)[0].qty,50);
});
