
export default sort;

function sort(map) {
  let items = [];
  let spots = [];
  map.overlayMapTypes.forEach((item, index)=> {
    if (!item) {
      return;
    }
    if (typeof item._zindex !== 'number') {
      return;
    }
    items.push({
      item,
      cur: index
    });
    spots.push(index);
  });
  if (items.length <= 1) {
    return;
  }
  items.sort((a, b) => a.item._zindex - b.item._zindex);
  items.forEach((item, i) => {
    item.next = spots[i];
  });
  items.filter(item=> item.cur !== item.next).forEach(item=>{
    map.overlayMapTypes.setAt(item.next, item.item);
  });
}
