import test from 'node:test';
import assert from 'node:assert/strict';
import { recipes } from '../data/recipes.js';
import { amount, scaledIngredients, shoppingList, validPortions, rowSignature } from '../calculations.js';
const state = (selected, portions = {}, extras = {}) => ({ selected, portions, extras });
test('8 burritos duplican carne, tortillas y el rango de cebolla', () => {
  const items = scaledIngredients(recipes[1], 8);
  assert.equal(items.find(i => i.id === 'carne').qty, 1200);
  assert.equal(items.find(i => i.id === 'tortilla').qty, 8);
  assert.equal(amount(items.find(i => i.id === 'cebolla-amarilla')), '334–340 g');
});
test('1 porción de caldo conserva fracciones y latas sin confundir el peso escurrido', () => {
  const items = scaledIngredients(recipes[2], 1);
  assert.equal(amount(items.find(i => i.id === 'garbanzo')), '½ lata');
  assert.equal(amount(items.find(i => i.id === 'aguacate')), '¼ pieza');
  assert.equal(amount(items.find(i => i.id === 'agua')), '≈ 0.5–0.63 l');
});
test('ingredientes compartidos se suman y al gusto no se convierte en cero', () => {
  const list = shoppingList(recipes, state(['burritos', 'caldo']));
  assert.equal(list.filter(i => i.id === 'oregano').length, 1);
  assert.equal(amount(list.find(i => i.id === 'oregano')), '1½ cdta');
  assert.equal(amount(list.find(i => i.id === 'sal')), '½ cdta + al gusto');
  assert.equal(list.filter(i => i.id.startsWith('cebolla')).length, 2);
});
test('opcionales excluidos por defecto e incluidos solo al seleccionarlos', () => {
  assert.ok(!shoppingList(recipes, state(['caldo'])).some(i => i.id === 'ejotes'));
  const list = shoppingList(recipes, state(['burritos', 'caldo'], { burritos: 8 }, { burritos: ['frijol'], caldo: ['ejotes'] }));
  assert.equal(list.find(i => i.id === 'frijol').qty, 240);
  assert.equal(amount(list.find(i => i.id === 'ejotes')), 'Cantidad a elegir');
  assert.ok(!list.some(i => i.id === 'pimiento'));
});
test('brownies se escalan por preparación y conservan claras adicionales', () => {
  const list = shoppingList(recipes, state(['brownies'], { brownies: 3 }));
  assert.equal(list.find(i => i.id === 'avena').qty, 150);
  assert.equal(list.find(i => i.id === 'huevo').qty, 3);
  assert.equal(list.find(i => i.id === 'clara').qty, 3);
});
test('una cantidad diferente invalida la marca de compra anterior', () => {
  const first = shoppingList(recipes, state(['caldo'], { caldo: 4 })).find(i => i.id === 'pollo');
  const second = shoppingList(recipes, state(['caldo'], { caldo: 8 })).find(i => i.id === 'pollo');
  assert.notEqual(rowSignature(first), rowSignature(second));
});
test('plan vacío y límites de porciones', () => {
  assert.deepEqual(shoppingList(recipes, state([])), []);
  assert.equal(validPortions(-2), 1);
  assert.equal(validPortions(''), 1);
  assert.equal(validPortions('abc'), 1);
  assert.equal(validPortions(1000), 100);
  assert.equal(validPortions(2.7), 3);
});
