// Campos de números enteros sin `type="number"` (spec 011).
//
// Con `type="number"`, Chrome cambia el valor si se gira la rueda del mouse sobre el campo enfocado (y también con
// las flechas ↑/↓): al desplazar un formulario, un 6 se vuelve 9 sin que la persona lo note. Un campo de texto con
// `inputMode="numeric"` muestra igual el teclado numérico en el celular, pero nada cambia el valor salvo lo que se
// escribe.

/** Propiedades comunes de un campo de entero ≥ 0 (hasta 4 cifras: 0–9999, como las validaciones de la base). */
export const NUMERIC_INPUT = {
  type: 'text',
  inputMode: 'numeric',
  pattern: '[0-9]*',
  autoComplete: 'off',
  maxLength: 4,
} as const

/** Deja solo las cifras de lo escrito o pegado («1 2», «12a», «-3» → «12», «12», «3»); máximo 4. */
export const digits = (raw: string): string => raw.replace(/\D/g, '').slice(0, NUMERIC_INPUT.maxLength)
