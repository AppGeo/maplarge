import google from './google';

class ImageMap{
  constructor(parent) {
    this.minZoom = parent.minZoom;
    this.maxZoom = parent.maxZoom;
    this.name = parent.name;
    this.tileSize =  new google.maps.Size(256, 256);
    this._zindex = parent._zindex;
    this.parent = parent;
    this.divs = [];
  }
  getTileUrl() {
    return `https://maps.gstatic.com/mapfiles/transparent.png`;
  }
  destroy() {
    for (let [div] of this.parent.divCache) {
      this.releaseTile(div);
    }
    this.divs = [];
  }
  releaseTile(div) {
    this.parent.divCache.delete(div);
    this.parent.waitingImages.delete(div);
    if (div.firstChild) {
      div.firstChild.style.visibility = 'hidden';
    }
    this.divs.push(div);
  }
  getTile(coord, zoom, doc) {
    var out;
    if (this.divs.length) {
      out = this.divs.pop();
    } else {
      out = doc.createElement('div');
    }
    out.style.width = '256px';
    out.style.height = '256px';
    this.parent.divCache.set(out, {
      coord,
      zoom
    });
    this.parent.getTileUrl(zoom, coord.x, coord.y).then(url => {
      if (this.parent.replaceImg(url, out) && this.parent.utfGrid) {
        this.parent.utfGrid._loadTile(zoom, coord.x, coord.y);
      }
    });
    return out;
  }
}
export default ImageMap;
