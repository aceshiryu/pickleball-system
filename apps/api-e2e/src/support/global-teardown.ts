/* eslint-disable */

module.exports = async function () {
  // The Nest app is booted/closed per spec (in-process), and the test database
  // is left in place for inspection. Nothing global to tear down.
  console.log('\n[e2e] done.\n');
};
