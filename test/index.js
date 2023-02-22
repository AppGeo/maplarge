
import test from 'tape';
import testData from './data.json' assert { type: 'json' };;
import {stringify} from '../lib/get-layer-hash.js'

test('stringify', function (t) {
  t.plan(1);
  var res = stringify(testData);
  try {
    JSON.parse(res);
    t.ok(true, 'works');
  } catch (e) {
    t.error(e, 'no!');
  }
});
