import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipe } from '../tools/recipe-intake.mjs';

const base = { status: 'complete', id: 'ensalada-prueba', title: 'Ensalada de prueba', short: 'Fresca y sencilla.', categories: ['comida'], description: 'Verduras frescas.', base: 2, portion: 'porción', plural: 'porciones', ingredients: [{ id: 'pepino-prueba', name: 'Pepino', qty: 1, unit: 'pieza', group: 'Frutas y verduras' }], steps: ['Corta el pepino.', 'Sirve.'] };

test('las recetas completas requieren cantidades para generar compras fiables', () => {
  assert.equal(validateRecipe(base).recipe.base, 2);
  assert.throws(() => validateRecipe({ ...base, ingredients: [{ ...base.ingredients[0], qty: null }] }), /necesita cantidades/);
  assert.throws(() => validateRecipe({ ...base, ingredients: [{ ...base.ingredients[0], group: 'Otro' }] }), /grupo de compras/);
  assert.throws(() => validateRecipe({ ...base, title: '<script>' }), /HTML/);
});

test('una ficha sin medidas solo puede entrar como pendiente', () => {
  const { recipe } = validateRecipe({ status: 'pending', id: 'desayuno-prueba', title: 'Desayuno de prueba', short: 'Con huevo.', categories: ['desayuno'], ingredients: ['Huevo'], missing: 'Cantidades y preparación.' });
  assert.deepEqual(recipe.ingredients, ['Huevo']);
  assert.equal(recipe.image, 'placeholder');
  assert.equal(recipe.yield, 'No indicado');
});
