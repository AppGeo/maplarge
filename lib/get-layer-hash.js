import md5 from 'create-hash/md5';

var mdCache = new Map();
export function makeMD5(string) {
  if (mdCache.has(string)) {
    return mdCache.get(string);
  }
  var out = md5(string).toString('hex');
  mdCache.set(string, out);
  return out;
}

export default function createHash(object) {
  return makeMD5(stringify(object));
}

var cache = new Map();
export function stringify(thing) {
  if (cache.has(thing)) {
    return cache.get(thing);
  }
  var out = _stringify(thing);
  cache.set(thing, out);
  return out;
}
function _stringify(thing) {
  switch (typeof thing) {
  case 'boolean':
  case 'number':
  case 'string':
    return JSON.stringify(thing);
  case 'undefined':
    return 'null';
  case 'object':
    if (!thing) {
      return 'null';
    }
    if (Array.isArray(thing)) {
      return '[' + thing.map(stringify).join(',') + ']';
    }
    if (thing instanceof Date) {
      return JSON.stringify(thing);
    }
    return Object.keys(thing).sort().reduce(function (acc, key) {
      if (key === 'undefined') {
        return acc;
      }
      if (acc === null) {
        acc = '{"';
      } else {
        acc += ',"';
      }
      acc += key;
      acc += '":';
      acc += stringify(thing[key]);
      return acc;
    }, null) + '}';
  case 'function':
    return functionToString(thing);
  default:
    throw new Error('unknown type ' + typeof thing);
  }
}

function removeComments(part) {
  var idx = part.indexOf('//');
  if (idx === -1) {
    return part.trim();
  }
  return part.slice(0, idx).trim();
}

function functionToString(func) {
  return func.toString()
    .replace(/[\r\t]/g, ' ')
    .split('\n')
    .map(removeComments)
    .join('');
}
