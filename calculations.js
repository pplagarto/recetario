export const validPortions = value => Math.max(1, Math.min(100, Math.round(Number(value) || 1)));
export function scaledIngredients(recipe, portions, extras = []) {
  const factor = validPortions(portions) / recipe.base;
  return recipe.ingredients.filter(i => !i.optional || extras.includes(i.id)).map(i => ({ ...i, qty: i.qty === null ? null : i.qty * factor, max: i.max === undefined ? undefined : i.max * factor }));
}
export function shoppingList(recipes, state) {
  const rows = new Map();
  recipes.filter(r => state.selected.includes(r.id)).forEach(recipe => {
    scaledIngredients(recipe, state.portions[recipe.id] ?? recipe.base, state.extras[recipe.id] || []).forEach(i => {
      const key = `${i.id}:${i.unit}`;
      if (!rows.has(key)) rows.set(key, { ...i, key, qty: 0, max: 0, hasAmount: false, toTaste: false, sources: [], notes: [] });
      const row = rows.get(key);
      if (i.qty === null) row.toTaste = true;
      else { row.qty += i.qty; row.max += i.max ?? i.qty; row.hasAmount = true; }
      row.sources.push(recipe.title);
      if (i.note && !row.notes.includes(i.note)) row.notes.push(i.note);
    });
  });
  return [...rows.values()].map(r => ({ ...r, qty: r.hasAmount ? r.qty : null, max: r.hasAmount && Math.abs(r.max - r.qty) > 1e-8 ? r.max : undefined }));
}
export function number(value) {
  if (Math.abs(value - Math.round(value)) < 0.00001) return String(Math.round(value));
  const whole = Math.floor(value), fraction = value - whole;
  for (const [part, label] of [[.25, '¼'], [1/3, '⅓'], [.5, '½'], [2/3, '⅔'], [.75, '¾']]) {
    if (Math.abs(fraction - part) < .00001) return `${whole || ''}${label}`;
  }
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value);
}
export function amount(i) {
  if (i.qty === null) return i.id === 'ejotes' ? 'Cantidad a elegir' : 'Al gusto';
  const plurals = { pieza: 'piezas', lata: 'latas', cuña: 'cuñas', diente: 'dientes', tallo: 'tallos', manojo: 'manojos', hoja: 'hojas' };
  const unit = (i.max ?? i.qty) > 1 ? (plurals[i.unit] || i.unit) : i.unit;
  const format = value => ['g', 'l'].includes(i.unit) ? new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value) : number(value);
  return `${i.approx ? '≈ ' : ''}${format(i.qty)}${i.max === undefined ? '' : '–' + format(i.max)} ${unit}${i.toTaste ? ' + al gusto' : ''}`;
}
export const rowSignature = i => `${i.key}:${i.qty}:${i.max}:${i.toTaste}`;
