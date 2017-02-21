import Promise from 'lie';
import google from './google';
import EE from 'events';
import Poll from './poll';
import getLayerHash, {
  stringify
}
from './get-layer-hash';
import ImageMap from './image-map';
import zoku from 'zoku';
import Utfgrid from './utfgrid';
import SphericalMercator from 'sphericalmercator';
import replaceImg from './replace-img';
import sortLayers from './sort-layers';
import processMlData from './process-ml-data';
const merc = new SphericalMercator();
const CIRCUMFERENCE = 6371009;
const metersPerPixel = (lat, z) => Math.abs(CIRCUMFERENCE * Math.cos(lat / 180) / Math.pow(2, z + 4));
const blankUrl = `https://maps.gstatic.com/mapfiles/transparent.png`;
const blankPromise = Promise.resolve(blankUrl);

export default class Layer extends EE.EventEmitter {
  constructor(opts) {
    super();
    this.account = opts.account;
    var table = this.table = opts.table;
    this.host = opts.host;
    var type = opts.type;
    if (!type) {
      if (table.length > 4 && table.slice(-4) === 'Line') {
        type = 'line';
      } else if (table.length > 5 && table.slice(-5) === 'Point') {
        type = 'point';
      }
    }
    var zindex = -1;
    if (typeof opts.zindex === 'number') {
      zindex = opts.zindex;
    }
    this._zindex = zindex;
    this.name = opts.name || 'unk' + Math.random();
    this.minZoom = opts.minZoom || 0;
    this.maxZoom = opts.maxZoom || 20;
    this.utfGrid = null;
    this.subdomains = opts.subdomains || false;
    this.click = opts.click;
    this.type = type;
    this.rules = opts.rules;
    this.watching = null;
    this.map = null;
    this.fields = opts.fields || [];
    this.refreshRate = opts.refresh;
    this._sort = opts.sort;
    this.tileLayer = null;
    this.cache = new Map();
    this._index = null;
    this._verificationCache = new Map();
    this.limit = 500;
    this.hashCache = new Map();
    this.divCache = new Map();
    this._tableName = `${this.account}/${this.table}`;
    this.specialQuery = [];
    this.knownHashes = new Set();
    this.waitingImages = new Map();
    this._fullTable = null;
    this._zooming = false;
    this.zoomlisteners = null;
    this._changeFun = e => {
      var first = !this._fullTable;
      this._fullTable = e;
      this._tableName = e;
      this.emit('fullTable', e);
      this.refreshTiles(first);
    };
    this.on('change', this._changeFun);
    if (this.refreshRate) {
      this.watch();
    }
  }
  putIntoOverlayMapTypes() {
    if (!this.map || !this.tileLayer) {
      return;
    }
    if (this.map.overlayMapTypes.indexOf(this.tileLayer) > -1) {
      return;
    }
    this.hashCache = new Map();

    if (this._index !== null && this._index < this.map.overlayMapTypes.getLength()) {
      this.map.overlayMapTypes.insertAt(this._index, this.tileLayer);
    } else {
      this.map.overlayMapTypes.push(this.tileLayer);
      this._index = this.map.overlayMapTypes.indexOf(this.tileLayer);
    }
    sortLayers(this.map);
  }
  removeFromOverlayMapTypes() {
    if (!this.map || !this.tileLayer) {
      return;
    }
    let index = this._index = this.map.overlayMapTypes.indexOf(this.tileLayer);
    while (index > -1) {
      this.map.overlayMapTypes.removeAt(index);
      index = this.map.overlayMapTypes.indexOf(this.tileLayer);
    }
    this.hashCache = new Map();
  }
  getRules(opts) {
    var _out = this._getRules(opts);
    if (!_out) {
      return _out;
    }
    if (Array.isArray(_out)) {
      return _out.map(this.addQuery, this);
    } else {
      return this.addQuery(_out);
    }
  }
  addQuery(_out) {
    var out = {};
    Object.keys(_out).forEach(key=>{
      out[key] = _out[key];
    });
    out.query = out.query || [];
    out.query = out.query.concat(this.specialQuery);
    return out;
  }
  _getRules(opt) {
    if (!this.rules) {
      return false;
    }
    if (this.rules.simple) {
      return this.rules;
    }
    if (opt === true) {
      return this.rules.styles;
    }
    if (typeof opt === 'number') {
      let zoom = opt;
      let result = this.rules.styles.find(style => {
        if (zoom >= style.range[0] && zoom <= style.range[1]) {
          return true;
        }
        return false;
      });
      return result;
    }
  }

  getLayerJson(rules, zoom, q) {
    var query = [];
    rules = rules || this.getRules(zoom);
    var type = this.type;
    if (rules.type) {
      type = rules.type;
    }
    if (q) {
      query = q;
    } else if (rules.query) {
      query = rules.query;
    }
    if (rules.rules) {
      rules = rules.rules;
    }

    var out = {
      layer: {
        style: {
          method: 'rules'
        },
        query: {
          select: {

          },
          table: {
            name: this._tableName
          }
        }
      }
    };
    if (rules) {
      out.layer.style.rules = rules;
    }
    out.layer.query.where = query;
    switch (type) {
    case 'line':
      out.layer.query.select.type = 'geo.line';
      break;
    case 'point':
      out.layer.query.select.type = 'geo.dot';
      break;
    }
    if (this._sort) {
      out.layer.style.orderBy = this._sort;
    }
    return out;
  }

  getLayerHash(layerJson) {
    if (this.cache.has(layerJson)) {
      return this.cache.get(layerJson);
    }
    var hash = getLayerHash(layerJson);
    this.cache.set(layerJson, hash);
    return hash;
  }

  getTileUrl(z, x, y) {
    if (z < this.minZoom || z > this.maxZoom) {
      return blankPromise;
    }
    return this.getHash(z).then(hash =>
      `https://${this.getSubdomain(x, y)}${this.host}/Api/ProcessRequest?hash=${hash}&uParams=x:${x};y:${y};z:${z};action:tile%2Fgettile`
    );
  }

  getSubdomain(x, y) {
    if (this.subdomains === false) {
      return '';
    }
    var rawPoint = x + y;
    if (rawPoint < 0) {
      rawPoint = -rawPoint;
    }
    return rawPoint % this.subdomains;
  }

  watch() {
    if (this.watching) {
      // already watching..
      return;
    }
    var opts = {
      account: this.account,
      host: this.host,
      table: this.table
    };

    var watcher = new Poll(opts, this.refreshRate);
    var self = this;
    watcher.on('change', e => {
      self.emit('change', e);
    });
    this.watching = watcher;
  }

  stopWatching() {
    var watcher = this.watching;
    if (!watcher) {
      throw new Error('no such watcher');
    }
    this.watching = null;
    watcher.abort();
  }

  getClickBox(lat, lon, zoom) {
    zoom += 4;
    var numTiles = 1 << zoom;
    var projection = this.map.getProjection();
    var worldCoordinate = projection.fromLatLngToPoint(new google.maps.LatLng(
        lat,
        lon));
    var pixelCoord = new google.maps.Point(
        worldCoordinate.x * numTiles,
        worldCoordinate.y * numTiles);
    var tileCoordinate = new google.maps.Point(
        Math.floor(pixelCoord.x / 256),
        Math.floor(pixelCoord.y / 256));
    return merc.bbox(tileCoordinate.x, tileCoordinate.y, zoom);
  }

  getInfo(lat, lon, zoom) {
    if (!this._fullTable) {
      return new Promise(fullfill =>
        this.on('fullTable', () =>
          fullfill(this.getInfo(lat, lon, zoom))
        )
      );
    }
    var clickBox = this.getClickBox(lat, lon, zoom);

    // var rec = new google.maps.Rectangle({
    //   bounds: new google.maps.LatLngBounds({
    //     lat: clickBox[1],
    //     lng: clickBox[0]
    //   }, {
    //     lat: clickBox[3],
    //     lng: clickBox[2]
    //   })
    // });
    // rec.setMap(this.map);

    var radius = metersPerPixel(lat, zoom - 1);
    var reqQuery = {
      col: this.type === 'point' ? 'XY' : this.table,
      test: `DWithin:${~~radius}`,
      value: `WKT(POLYGON(${clickBox[0]} ${clickBox[1]/*bl*/},${clickBox[2]} ${clickBox[1]/*tl*/},${clickBox[2]} ${clickBox[3]/*tr*/},${clickBox[0]} ${clickBox[3]/*br*/},${clickBox[0]} ${clickBox[1]})),COL(${this.type === 'point' ? 'XY' : this.table})`
    };
    var query = this.getRules(zoom);
    query = query && query.query || [];
    query = query.slice();
    query.push(reqQuery);
    var data = {
      action: 'table/query',
      query: {
        sqlselect: this.fields,
        start: 0,
        table: this._fullTable,
        take: this.limit,
        where: query
      }
    };
    return this.query(data);
  }
  getFields(field) {
    var data = {
      action: 'table/query',
      query: {
        sqlselect: [`${field}.count`, field],
        groupby: [field],
        start: 0,
        table: this._fullTable,
        take: this.limit,
        where: []
      }
    };
    return this.query(data);
  }
  query(data) {
    var hash = this.getLayerHash(data);
    return this.checkRegistration(data, hash).then(()=>
      zoku(`https://${this.subdomainFromHash(hash)}${this.host}/Api/ProcessRequest?hash=${hash}&action:table%2Fquery`)
    ).then(resp => this.transposeResp(resp));
  }
  updateQuery(query=[]) {
    this.specialQuery = query;
    return this.refreshTiles();
  }
  transposeResp(resp) {
    if (!resp.success) {
      if (resp.errors.length) {
        throw resp.errors;
      }
      throw new Error('not found');
    }
    var data = resp.data.data;
    var keys = Object.keys(data);
    var len = keys.reduce((a, b) => Math.min(a, data[b].length), Infinity);
    var out = new Array(len);
    var i = -1;
    var item, j;
    while (++i < len) {
      item = out[i] = {};
      j = -1;
      while (++j < keys.length) {
        item[keys[j]] = data[keys[j]][i];
      }
    }
    return out;
  }
  subdomainFromHash(hash) {
    return this.subdomains ? parseInt(hash.slice(-8), 16) % this.subdomains : '';
  }
  checkRegistration(json, hash) {
    if (this.knownHashes.has(hash)) {
      return Promise.resolve(true);
    }
    if (this._verificationCache.has(hash)) {
      return this._verificationCache.get(hash);
    }
    var url = `https://${this.subdomainFromHash(hash)}${this.host}/Api/VerifyRequest`;
    var opts = {
      hash: hash
    };
    var prom = zoku(url, opts).then(resp => {
      if (resp.isCached) {
        return true;
      }
      return this.cacheRequest({
        request: stringify(json)
      });
    }).then(resp => {
      this._verificationCache.delete(hash);
      this.knownHashes.add(hash);
      return resp;
    }, resp => {
      this._verificationCache.delete(hash);
      throw resp;
    });
    this._verificationCache.set(hash, prom);
    return prom;
  }
  getHash(z) {
    if(this.hashCache.has(z)) {
      return Promise.resolve(this.hashCache.get(z));
    }
    var hashCache = this.hashCache;
    var layer = this.getLayerJson(false, z);
    var hash = this.getLayerHash(layer);
    if (this.knownHashes.has(hash)) {
      hashCache.set(z, hash);
      return Promise.resolve(hash);
    }
    return this.checkRegistration(layer, hash).then(() => {
      hashCache.set(z, hash);
      return hash;
    });
  }
  getGrid() {
    return new Utfgrid((z, x, y) => {
      if (z < this.minZoom || z > this.maxZoom) {
        return Promise.resolve(false);
      }
      return this.getHash(z).then(hash =>
        [`https://${this.getSubdomain(x, y)}${this.host}/Api/ProcessRequest`, {hash: hash,
          uParams: `x:${x};y:${y};z:${z};label:${this.fields.join(',')};action:tile/hovergrid`
        }]
      );
    }, {
      minZoom: this.minZoom,
      maxZoom: this.maxZoom
    });
  }
  getMap() {
    if (this.map) {
      return this.map;
    }
  }
  setMap(map) {
    if (map === this.map) {
      return;
    }
    if (map) {
      return this.addTo(map);
    }
    this.removeFromMap();
  }

  removeFromMap() {
    this.removeListener('change', this._changeFun);
    if (this.zoomlisteners) {
      this.zoomlisteners.map(l=>l.remove());
      this.zoomlisteners = null;
    }
    if (this.watching) {
      this.stopWatching();
    }

    if (this.utfGrid) {
      this.utfGrid.setMap(null);
    }
    if (this.tileLayer) {
      this.removeFromOverlayMapTypes();
    }
    this.cache.clear();
    this.map = null;
  }

  refreshTiles(force) {
    this.hashCache = new Map();
    this.cache.clear();
    if (this.tileLayer && this.map) {
      this._replaceImages(force);
    }
  }
  replaceImg(url, div) {
    if (!this.divCache.has(div)) {
      return false;
    }
    if (this._zooming) {
      this.waitingImages.set(div, url);
    } else {
      replaceImg(url, div);
    }
    return true;
  }
  _replaceImages() {
    let replaceThing = (div, zoom, coord) => {
      return url => {
        if (this.replaceImg(url, div) && this.utfGrid) {
          this.utfGrid._loadTile(zoom, coord.x, coord.y);
        }
      };
    };
    if (this.utfGrid) {
      this.utfGrid.reset();
    }
    for (let [div, {zoom, coord}] of this.divCache) {
      this.replaceImg(blankUrl, div);
      this.getTileUrl(zoom, coord.x, coord.y).then(replaceThing(div, zoom, coord));
    }
  }
  _drainReplaceImg () {
    for (let [div, url] of this.waitingImages) {
      this.waitingImages.delete(div);
      if (!this.divCache.has(div)) {
        return false;
      }
      replaceImg(url, div);
    }
  }
  addTo(map) {
    this.map = map;
    this.hashCache = new Map();
    this.cache.clear();
    if (this.zoomlisteners) {
      this.zoomlisteners.map(l=>l.remove());
    }
    this.zoomlisteners = [
      google.maps.event.addListener(map, 'zoom_changed', () => {
        this._zooming = true;
        this.emit('zoom-started');
      }),
      google.maps.event.addListener(map, 'idle', () => {
        this._zooming = false;
        this._drainReplaceImg();
        this.emit('zoom-ended');
      })
    ];
    if (!this.tileLayer) {
      this.tileLayer = new ImageMap(this);
    }
    this.putIntoOverlayMapTypes();
    this.makeUtf();
  }

  makeUtf() {
    if (typeof this.click !== 'function') {
      return;
    }
    if (!this.utfGrid) {
      this.utfGrid = this.getGrid();
    }
    this.utfGrid.on('click', data => {
      this.click({
        latLng: data.latLng,
        data: processMlData(this.fields, data.data)
      });
    });
    this.utfGrid.setMap(this.map);
  }

  cacheRequest(data, location) {
    location = location || 'CacheRequest';
    var baseURL = `https://${this.host}/Api/${location}?aInfo=mluser:null;mltoken:null`;
    return zoku(baseURL, 'POST', data).then(resp => {
      if (!resp.success) {
        throw resp;
      }
      return resp;
    });
  }
}
