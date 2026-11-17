/**
 * Small fallbacks for array methods added in iOS 16 Safari, so the web app also
 * runs on older iPhones (e.g. an iPhone 7, which stops at iOS 15). Expo Router's
 * navigation code calls `toSpliced`. Each method is only added when missing.
 */
/* eslint-disable no-extend-native */
type AnyArray = unknown[];

function define(name: string, fn: (this: AnyArray, ...args: any[]) => unknown) {
  if (!(name in Array.prototype)) {
    Object.defineProperty(Array.prototype, name, {
      value: fn,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
}

define('toSpliced', function (this: AnyArray, ...args: any[]) {
  const copy = this.slice();
  (copy.splice as (...a: any[]) => unknown)(...args);
  return copy;
});

define('toSorted', function (this: AnyArray, compare?: (a: any, b: any) => number) {
  return this.slice().sort(compare);
});

define('toReversed', function (this: AnyArray) {
  return this.slice().reverse();
});

define('with', function (this: AnyArray, index: number, value: unknown) {
  const copy = this.slice();
  const i = index < 0 ? copy.length + index : index;
  if (i < 0 || i >= copy.length) throw new RangeError('Invalid index');
  copy[i] = value;
  return copy;
});

export {};
