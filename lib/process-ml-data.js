export default function processMlData(fields, data) {
  if (!data) {
    return null;
  }

  var items = data[2].split('`~!');
  var out = {};
  var i = -1;
  var len = fields.length;

  while (++i < len) {
    out[fields[i]] = items[i];
  }

  return out;
}
