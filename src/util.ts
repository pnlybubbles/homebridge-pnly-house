export function unreachable(_: never): never {
  throw new Error(`unreachable (${_})`);
}

export function delay(second: number) {
  return new Promise(resolve => setTimeout(resolve, second * 1000));
}
