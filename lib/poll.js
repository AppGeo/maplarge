import EE from 'events';
import ajax from 'zoku';
export default class Poll extends EE.EventEmitter {
  constructor (options, frequency) {
    super();
    this.url = 'https://' + options.host + '/Remote/GetActiveTableID';
    this.opts = {
      shortTableId: options.account + '/' + options.table
    };
    this.table = void 0;
    frequency = frequency || 30;
    this.interval = frequency * 1000;
    this.timeout = void 0;
    this.aborted = false;
    this.checkTable();
  }
  checkTable() {
    var self = this;
    return ajax(this.url, this.opts).then(function (resp) {
      if (self.aborted) {
        return false;
      }
      if (!resp) {
        throw new Error('no response');
      }
      if (Array.isArray(resp.errors) && resp.errors.length) {
        throw new Error(resp.errors.join());
      }
      if (!resp.success || !resp.table) {
        throw new Error('invalid response');
      }
      return resp.table;
    }).then(function (table) {
      if (self.aborted) {
        return;
      }
      var oldTable = self.table;
      if (self.table !== table) {
        self.table = table;
        if (!oldTable) {
          self.emit('ready');
        }
        self.emit('change', table);
      }
      self.timeout = setTimeout(function () {
        self.timeout = void 0;
        if (self.aborted) {
          return;
        }
        self.checkTable();
      }, self.interval);
      // if (typeof self.timeout.unref === 'function') {
      //   self.timeout.unref();
      // }
    }).catch(function (e) {
      if (self.timeout) {
        clearTimeout(self.timeout);
      }
      self.emit('error', e);
    });
  }
  abort () {
    this.aborted = true;
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.removeAllListeners();
  }
}
