var package = require('../package.json');
require('babel-register')(package.browserify.transform[0][1]);
var test = require('tape');
var testData = require('./data.json');
var getHash = require('../lib/get-layer-hash');
test('stringify', function (t) {
  t.plan(1);
  var res = getHash.stringify(testData);
  try {
    JSON.parse(res);
    t.ok(true, 'works');
  } catch (e) {
    t.error(e, 'no!');
  }
});
