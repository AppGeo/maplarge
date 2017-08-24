import google from './google';
import zoku from 'zoku';
import qs from 'querystring';
const equal3Array = (a, b) => {
  if (!b || !a) {
    return false;
  }
  if (a[0] !== b[0]) {
    return false;
  }
  if (a[1] !== b[1]) {
    return false;
  }
  if (a[2] !== b[2]) {
    return false;
  }
  return true;
}
const maps = new WeakMap();
class MapDetails{
  constructor(map) {
    this.map = map;
    this.events = new Map();
    this._listeners = new Map();
  }
  setEvent(eventName, cb, ctx) {

    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
      var listner = this.map.addListener(eventName, e => {
        var events = this.events.get(eventName);
        // if (eventName === 'click') {
        //   console.log(this.events);
        // }
        for (let event of events) {
          event.cb.call(event.ctx, e);
        }
      }, this);
      this._listeners.set(eventName, listner);
    }
    var symbol = {eventName};
    var newEvent = {
      cb,ctx,symbol
    };
    var events = this.events.get(eventName);
    events.push(newEvent);
    events.sort((a, b)=>{
      var za = a.ctx.zindex;
      var zb = b.ctx.zindex;
      if (za === zb) {
        return 0;
      }
      if (za < zb) {
        return 1;
      }
      return -1;
    });
    this.events.set(eventName, events);
    var out = {};
    maps.set(out, symbol);
    return out;
  }
  removeEvent(_eventKey) {
    var eventKey = maps.get(_eventKey);
    if (!eventKey.eventName) {
      return;
    }
    if (!this.events.has(eventKey.eventName) || !this._listeners.has(eventKey.eventName)) {
      return;
    }
    var events = this.events.get(eventKey.eventName);
    events = events.filter(item=>
      item.symbol !== eventKey
    );
    if (events.length) {
      this.events.set(eventKey.eventName, events);
      return;
    }
    this.events.delete(eventKey.eventName);
    var listener = this._listeners.get(eventKey.eventName);
    this._listeners.delete(eventKey.eventName);
    google.maps.event.removeListener(listener);
  }
}
function addListener(map, eventname, cb, ctx) {
  var mapDetails = maps.get(map);
  if (!mapDetails) {
    mapDetails = new MapDetails(map);
    maps.set(map, mapDetails);
  }
  return mapDetails.setEvent(eventname, cb, ctx);
}
function removeListener(map, eventkey) {
  var mapDetails = maps.get(map);
  if (!mapDetails) {
    return;
  }
  mapDetails.removeEvent(eventkey);
}
export default class UtfGrid extends google.maps.OverlayView {
  constructor(url, options) {
    super();
    options = options || {};
    this.options = {
      subdomains: '012',
      minZoom: options.minZoom || 0,
      maxZoom: options.maxZoom || 20,
      tileSize: 256,
      pointerCursor: true
    };
    this.zindex = options.zindex || -Infinity;
    this.options.gridWidth = this.options.tileSize >> 2;
    //The thing the mouse is currently on
    this._mouseOn = null;
    this._url = url;
    this._cache = new Map();
    this._reqCache = new Map();
    this._inProgres = new Set();
    this._attached = false;
    this._events = [];
    var i = 0;
    while (window['lu' + i]) {
      i++;
    }
    this._windowKey = 'lu' + i;
    window[this._windowKey] = {};

    this.draw = function () {
      // placeholder required by google
    };

    var handles = [];
    var self = this;
    this.on = function(event, handler) {
      var handle = google.maps.event.addListener(self, event, handler);
      handles.push(handle);
    };
    this.off = function() {
      while (handles.length) {
        google.maps.event.removeListener(handles.pop());
      }
    };
  }
  onAdd() {
    var map = this.getMap();

    this._map = map;
    this._container = map.getDiv();

    this._zoomEvent = map.addListener('zoom_changed', e => this.zoomChanged(e), this);
    this.zoomChanged();

  }
  zoomChanged() {
    var zoom = this._map.getZoom();
    if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
      return this._removeHandlers();
    }
    if (this._attached) {
      return;
    }
    this._attached = true;
    this._events = [
      addListener(this._map, 'mousemove', e => this._move(e), this),
      addListener(this._map, 'click', e => this._click(e), this)
      // this._map.addListener('mousemove', e => this._move(e), this),
      // this._map.addListener('click', e => this._click(e), this)
    ];
  }
  _removeHandlers(all) {
    if (all && this._zoomEvent) {
      google.maps.event.removeListener(this._zoomEvent);
      this._zoomEvent = null;
      this.off();
    }
    if (!this._attached) {
      return;
    }
    this._attached = false;
    this._events.forEach(e=> removeListener(this._map, e));
    this._events = [];
  }
  onRemove() {
    this._removeHandlers(true);

    if (this.options.pointerCursor) {
      this._container.style.cursor = '';
    }
    this._cache.clear();
  }
  _click(e) {
    this._move(e);
    if (this._mouseOn) {
      google.maps.event.trigger(this, 'click', {
        latLng: e.latLng,
        data: this._mouseOn
      });
    }
  }
  _move(e) {

    var on = this._objectForEvent(e);
    var map = this._map;
    if (!equal3Array(on.data, this._mouseOn)) {
      if (this._mouseOn) {
        google.maps.event.trigger(this, 'mouseout', { latLng: e.latLng, data: this._mouseOn });
        map.setOptions({ draggableCursor: 'url(//maps.google.com/mapfiles/openhand.cur), move' });

      }
      if (on.data) {
        // Should really be setting/triggering events on 'on'
        // but google events aren't that smart and so using 'self'
        // and binding 'on' to that event
        google.maps.event.trigger(this, 'mouseover', on);
        map.setOptions({ draggableCursor: 'pointer' });
      }

      this._mouseOn = on.data;
    } else if (on.data) {
      google.maps.event.trigger(this, 'mouseover', on);
      map.setOptions({ draggableCursor: 'pointer' });
    }
  }
  reset() {
    this._cache.clear();
  }
  _objectForEvent(e) {
    var map = this._map,
      tileSize = this.options.tileSize;
    var pixelPoint = this._getPixelCoordinates(e.latLng);

    // Get x/y of tile for key
    var tileX = Math.floor(pixelPoint.x / tileSize),
      tileY = Math.floor(pixelPoint.y / tileSize);

    // Get x/y of grid
    var gridX = (pixelPoint.x - (tileX * tileSize)) >> 2,
      gridY = (pixelPoint.y - (tileY * tileSize)) >> 2;

    var gridTile = this._cache.get(map.getZoom() + '_' + tileX + '_' + tileY);

    if (!gridTile || !gridTile.data || !gridTile.success) {
      return { latLng: e.latLng, data: null };
    }

    var result = this._decodeTile(gridX, gridY, gridTile);

    return { latLng: e.latLng, data: result};
  }
  _getPixelCoordinates(coord) {
    var numTiles = 1 << this._map.getZoom();
    var projection = this._map.getProjection();
    //var tilesize = this.options.tileSize;

    var worldCoordinate = projection.fromLatLngToPoint(coord);
    var pixelCoordinate = new google.maps.Point(
        worldCoordinate.x * numTiles,
        worldCoordinate.y * numTiles);

    return pixelCoordinate;
  }
  _getTileCoordinates(coord) {
    var tilesize = this.options.tileSize;
    var pixelCoord = this._getPixelCoordinates(coord);

    var tileCoordinate = new google.maps.Point(
        Math.floor(pixelCoord.x / tilesize),
        Math.floor(pixelCoord.y / tilesize));

    return tileCoordinate;
  }
  _loadTile(zoom, x, y) {
    var key = `${zoom}_${x}_${y}`;
    if (this._inProgres.has(key)) {
      return;
    }
    this._inProgres.add(key);
    var xTile = this.normalizeCoordinate(x, zoom);
    var yTile = this.normalizeCoordinate(y, zoom);
    var z = Math.floor(zoom);
    this._url(z, xTile, yTile).then(url => {
      if (!url) {
        return;
      }
      var fullUrl = url[0] + '?' + qs.stringify(url[1]);
      if (this._reqCache.has(fullUrl)) {
        return this._reqCache.get(fullUrl);
      }
      return zoku(fullUrl).then(data => {
        this._reqCache.set(fullUrl, data);
        return data;
      });
    })
      .then(data => {
        this._cache.set(key, data);
        this._inProgres.delete(key);
      });
  }
  _decodeTile(gridX, gridY, gridTile) {
    var gridIndex = (gridY * this.options.gridWidth) + gridX;
    var dataIndex = gridTile.data.index[gridIndex];
    if (dataIndex === -1) {
      return null;
    }
    return gridTile.data.data[dataIndex] || null;
  }
  normalizeCoordinate(coord, zoom) {
    // tiles are on a 4^zoom tile grid
    var maxTiles = Math.sqrt(Math.pow(4, zoom));

    if (zoom > 0) {
      while (coord > maxTiles || coord < 0) {
        if (coord > maxTiles) {
          coord -= maxTiles;
        } else if (coord < 0) {
          coord += maxTiles;
        }
      }
    }

    return coord;
  }
}
