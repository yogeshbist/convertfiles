/* db.js — IndexedDB store for finished conversions.
   Every successful conversion is written here as a real record with its Blob,
   so the Library tab is a literal view of the local database.              */
(function (root) {
  'use strict';
  // Internal database name — kept from the app's first release so that files
  // people converted before the rename are still there.
  var NAME = 'format-bench', VERSION = 1, STORE = 'conversions';
  var dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!root.indexedDB) return rej(new Error('this browser has no IndexedDB'));
      var req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          os.createIndex('createdAt', 'createdAt');
          os.createIndex('targetExt', 'targetExt');
        }
      };
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error || new Error('could not open the database')); };
    });
    return dbp;
  }

  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, mode), store = t.objectStore(STORE), out;
        try { out = fn(store); } catch (e) { return rej(e); }
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error || new Error('database write failed')); };
        t.onabort = function () { rej(t.error || new Error('database transaction aborted')); };
      });
    });
  }

  function put(rec) { return tx('readwrite', function (s) { return s.add(rec); }); }
  function get(id) { return tx('readonly', function (s) { return s.get(id); }); }
  function remove(id) { return tx('readwrite', function (s) { return s.delete(id); }); }
  function clear() { return tx('readwrite', function (s) { return s.clear(); }); }

  function all() {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var out = [], t = db.transaction(STORE, 'readonly');
        var cur = t.objectStore(STORE).index('createdAt').openCursor(null, 'prev');
        cur.onsuccess = function (e) {
          var c = e.target.result;
          if (!c) return res(out);
          out.push(c.value);
          c.continue();
        };
        cur.onerror = function () { rej(cur.error); };
      });
    });
  }

  function estimate() {
    if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate();
    return Promise.resolve({ usage: null, quota: null });
  }

  root.DB = { put: put, get: get, all: all, remove: remove, clear: clear, estimate: estimate, NAME: NAME, STORE: STORE };
})(window);
