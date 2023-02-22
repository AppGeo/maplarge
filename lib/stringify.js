export default (obj) => {
  const out = new URLSearchParams(obj);
  return out.toString();
}
