let counter = 0;

/** Short unique id: time + counter + randomness. No native crypto module needed. */
export function makeId(prefix = ''): string {
  counter = (counter + 1) % 1296;
  const time = Date.now().toString(36);
  const sequence = counter.toString(36).padStart(2, '0');
  const random = Math.floor(Math.random() * 1679616)
    .toString(36)
    .padStart(4, '0');
  return `${prefix}${time}${sequence}${random}`;
}
