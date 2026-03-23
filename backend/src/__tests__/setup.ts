// Jest setup: enable BigInt JSON serialization to prevent
// "TypeError: Do not know how to serialize a BigInt" in test workers
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};
