var Db = require('mongodb').Db
  , Server = require('mongodb').Server
  , map = require('async').map
  , collection
  , idProperty = '_id'
  , db = new Db('test', new Server('127.0.0.1', 27017, {}) , { fsync: true, w: 1 })
  , assert = require('assert')
  , Stream = require('stream').Stream
  , streamAssert = require('stream-assert')

function getEngine(options, callback) {
  if (callback === undefined) {
    callback = options
    options = {}
  }
  collection.remove({}, function () {
    callback(undefined, require('../lib/mongodb-engine')(collection, options))
  })
}

function connect(done) {

  db.open(function (err, connection) {
    if (err) return done(err)
    connection.collection('test', function (err, c) {
      if (err) return done(err)
      collection = c
      done()
    })
  })
}

function drop() {
  db.dropDatabase()
}

require('save/test/engine.tests')(idProperty, getEngine, connect, drop)

describe('mongodb-engine', function () {

  after(drop)

  it('should find documents by id with a $in query', function (done) {
    getEngine(function (err, engine) {
      if (err) return done(err)
      map([ { a: 1 }, { a: 2 }, { a: 3 } ], engine.create, function (err, documents) {
        if (err) return done(err)
        var query = {}
        query[idProperty] = { $in: [ documents[0][idProperty], documents[1][idProperty] ] }
        engine.find(query, function (err, queryResults) {
          if (err) return done(err)
          queryResults.length.should.equal(2)
          done()
        })
      })
    })
  })

  it('should find documents by id with a $nin query', function (done) {
    getEngine(function (err, engine) {
      if (err) return done(err)
      map([ { a: 1 }, { a: 2 } ], engine.create, function (err, documents) {
        if (err) return done(err)
        var query = {}
        query[idProperty] = { $nin: [ documents[0][idProperty] ] }
        engine.find(query, function (err, queryResults) {
          if (err) return done(err)
          queryResults.length.should.equal(1)
          queryResults[0][idProperty].should.equal(documents[1][idProperty])
          done()
        })
      })
    })
  })

  it('should find documents by id with a $ne query', function (done) {
    getEngine(function (err, engine) {
      if (err) return done(err)
      map([ { a: 1 }, { a: 2 } ], engine.create, function (err, documents) {
        if (err) return done(err)
        var query = {}
        query[idProperty] = { $ne: documents[0][idProperty] }
        engine.find(query, function (err, queryResults) {
          if (err) return done(err)
          queryResults.length.should.equal(1)
          queryResults[0][idProperty].should.equal(documents[1][idProperty])
          done()
        })
      })
    })
  })

  it('should callback with mongo errors', function (done) {
    getEngine(function (err, engine) {
      if (err) return done(err)
      engine.create({ a: 1 }, function (err, saved) {
        if (err) return done(err)
        engine.update({ _id: saved._id }, false, function (err) {
          err.message.should.not.match(/No object found with '_id' =/)
          done()
        })
      })
    })
  })

  describe('streaming interface of find()', function() {
    it('should return stream if no callback is provided', function (done) {

      getEngine(function (err, engine) {
        if (err) return done(err)
        assert.ok(engine.find({}) instanceof Stream, 'not a instance of Stream')
        done()
      })
    })

    it('should stream result data via ‘objectIdToString’ transformation', function (done) {

      getEngine(function (err, engine) {
        if (err) return done(err)
        map([ { a: 1, b: 0 }, { a: 2, b: 0 } ], engine.create, function (err, documents) {
          var stream = engine.find({ b: 0 })
          stream
          .pipe(streamAssert.first(function(data) { assert.deepEqual(data, documents[0]) }))
          .pipe(streamAssert.second(function(data) { assert.deepEqual(data, documents[1]) }))
          .pipe(streamAssert.end(done))
        })
      })
    })

    it('should not lose any data if the stream is read asynchronously', function (done) {

      getEngine(function (err, engine) {
        if (err) return done(err)
        map([ {}, {}, {}, {}, {} ], engine.create, function (err) {
          if (err) return done(err)
          var stream = engine.find({})
          setTimeout(function () {
            stream
              .pipe(streamAssert.length(5))
              .pipe(streamAssert.end(done))
          }, 100)
        })
      })

    })

  })

})
