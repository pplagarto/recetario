import test from 'node:test';
import assert from 'node:assert/strict';
import { recipes, pendingRecipes } from '../data/recipes.js';
import { pantryShoppingList } from '../pantry.js';

test('incomplete cookbook cards cannot enter purchases or recommendations', () => {
  const ids = [...recipes, ...pendingRecipes].map(recipe => recipe.id);
  assert.equal(new Set(ids).size, 7);
  assert.equal(pendingRecipes.length, 4);
  assert.ok(pendingRecipes.every(recipe => recipe.ingredients.every(ingredient => typeof ingredient === 'string')));
  const selection = { selected: [...ids], portions: Object.fromEntries(recipes.map(recipe => [recipe.id, recipe.base])), extras: {}, pantry: {}, onlyMissing: false };
  const rows = pantryShoppingList(recipes, selection);
  assert.ok(rows.length > 0);
  assert.ok(rows.every(row => row.sources.every(source => recipes.some(recipe => recipe.title === source))));
});

test('new burrito extras remain opt-in', () => {
  const burritos = recipes.find(recipe => recipe.id === 'burritos');
  for (const id of ['papa', 'champiñones']) {
    assert.equal(burritos.ingredients.find(ingredient => ingredient.id === id)?.optional, true);
  }
});
