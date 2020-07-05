'use strict'
var pull = require('pull-stream')
var mfr = require('map-filter-reduce')
var Flatmap = require('pull-flatmap')
var FlumeViewLevel = require('flumeview-level')

var query = require('./query')
var select = require('./select')
var u = require('./util')

var isArray = Array.isArray
// sorted index.

module.exports = function (indexes, emitLinks, version) {
  if (!emitLinks) { emitLinks = function (data, emit) { emit(data) } }

  function getIndexes (data, seq) {
    var A = []
    indexes.forEach(function (index) {
      var a = [index.key]
      for (var i = 0; i < index.value.length; i++) {
        var key = index.value[i]
        if (!u.has(key, data)) return
        a.push(u.get(key, data))
      }
      a.push(seq)
      A.push(a)
    })
    return A
  }

  var create = FlumeViewLevel(version || 2, function (value, seq) {
    var A = []
    emitLinks(value, function (value) {
      A = A.concat(getIndexes(value, seq))
    })
    return A
  })

  return function (log, name) {
    var index = create(log, name)
    var _read = index.read

    index.methods.explain = 'async'
    index.explain = function (opts = {}, cb) {
      var q, sort
      if (isArray(opts.query)) {
        q = opts.query[0].$filter || {}
        sort = opts.query[opts.query.length - 1].$sort
        if (sort) opts.query.pop()
      } else if (opts.query) {
        q = opts.query
      } else { q = {} }

      var index = sort ? u.findByPath(indexes, sort) : select(indexes, q)

      if (sort && !index) return cb(new Error('could not sort by:' + JSON.stringify(sort)))

      return cb(null, {
        index
      })
    }

    index.read = function (opts = {}) {
      var q, sort
      if (isArray(opts.query)) {
        q = opts.query[0].$filter || {}
        sort = opts.query[opts.query.length - 1].$sort
        if (sort) opts.query.pop()
      } else if (opts.query) {
        q = opts.query
      } else { q = {} }

      var index = sort ? u.findByPath(indexes, sort) : select(indexes, q)

      if (sort && !index) return pull.error(new Error('could not sort by:' + JSON.stringify(sort)))

      if (!index) {
        return pull(
          log.stream({
            values: true, seqs: false, live: opts.live, old: opts.old, limit: opts.limit, reverse: opts.reverse
          }),
          Flatmap(function (data) {
            var emit = []
            emitLinks(data, function (a) {
              emit.push(a)
            })
            return emit
          })
        )
      }

      var _opts = query(index, q)

      _opts.values = true
      _opts.keys = true

      _opts.reverse = !!opts.reverse
      _opts.live = opts.live
      _opts.old = opts.old
      _opts.sync = opts.sync
      _opts.unlinkedValues = opts.unlinkedValues

      return pull(
        _read(_opts),
        pull.map(function (data) {
          if (data.sync) return data
          var o = opts.unlinkedValues ? data.value : {}
          for (var i = 0; i < index.value.length; i++) { u.set(index.value[i], data.key[i + 1], o) }
          return o
        }),
        isArray(opts.query) ? mfr(opts.query) : pull.through(),
        opts.limit ? pull.take(opts.limit) : pull.through()
      )
    }
    return index
  }
}
