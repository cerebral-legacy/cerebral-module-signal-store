var Controller = require('cerebral')
var Store = require('../index')

var async = function (cb) {
  setTimeout(cb, 0)
}
var Model = function () {
  return function () {
    return {
      mutators: {
        set: function (path, value) {
          var state = {}
          state[path.pop()] = value
        }
      }
    }
  }
}

exports['should keep signals by default'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })
  var signal = [
    function () {}
  ]

  ctrl.addSignals({
    'test': signal
  })
  ctrl.getSignals().test()
  ctrl.getSignals().test()
  async(function () {
    test.equals(ctrl.getServices().store.getSignals().length, 2)
    test.done()
  })
}

exports['should add signalStoreRef to signals'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })
  var asyncSignal = [
    [
      function (context) { async(context.output) }
    ]
  ]
  var signal = [
    function () {}
  ]

  ctrl.addSignals({
    'sync': signal,
    'async': asyncSignal
  })
  ctrl.getSignals().async.sync()
  ctrl.getSignals().sync.sync()
  async(function () {
    test.ok(ctrl.getServices().store.getSignals()[0].signalStoreRef)
    test.ok(ctrl.getServices().store.getSignals()[0].branches[0][0].signals[0].signalStoreRef)
    test.done()
  })
}

exports['should store details about signal'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })
  var signal = [
    function ActionA () {}
  ]

  ctrl.addSignals({
    'test': signal
  })
  ctrl.getSignals().test({
    foo: true
  })
  async(function () {
    var signal = ctrl.getServices().store.getSignals()[0]
    test.equal(signal.name, 'test')
    test.deepEqual(signal.input, {foo: true})
    test.equal(signal.branches.length, 1)
    test.done()
  })
}

exports['should not store default args'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })
  var signal = [
    function ActionA () {}
  ]

  ctrl.addServices({
    utils: 'test'
  })
  ctrl.addSignals({
    'test': signal
  })
  ctrl.getSignals().test({
    foo: true
  })
  async(function () {
    var signal = ctrl.getServices().store.getSignals()[0]
    test.equal(signal.name, 'test')
    test.deepEqual(signal.input, {foo: true})
    test.equal(signal.branches.length, 1)
    test.done()
  })
}

exports['should store details about actions'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })
  var signal = [
    function ActionA () {}
  ]

  ctrl.addSignals({
    'test': signal
  })
  ctrl.getSignals().test({
    foo: true
  })
  async(function () {
    var action = ctrl.getServices().store.getSignals()[0].branches[0]
    test.equal(action.name, 'ActionA')
    test.equal(action.mutations.length, 0)
    test.done()
  })
}

exports['should store details about mutations'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })
  var signal = [
    function ActionA (args) {
      args.state.set('foo', 'bar')
    }
  ]

  ctrl.addSignals({
    'test': signal
  })
  ctrl.getSignals().test()

  async(function () {
    var action = ctrl.getServices().store.getSignals()[0].branches[0]
    test.deepEqual(action.mutations[0], {
      name: 'set',
      path: ['foo'],
      args: ['bar']
    })
    test.done()
  })
}

exports['should store details about mutations correctly across sync and async signals'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })
  var signalSync = [
    function ActionA (args) {
      args.state.set('foo', 'bar')
    }
  ]

  ctrl.addSignals({
    'test': signalSync
  })
  var signalAsync = [
    [
      function ActionB (args) { args.output() }
    ], function ActionC (args) {
      args.state.set('foo', 'bar')

      async(function () {
        var actionAsync = ctrl.getServices().store.getSignals()[0].branches[1]
        test.deepEqual(actionAsync.mutations[0], {
          name: 'set',
          path: ['foo'],
          args: ['bar']
        })

        var action = ctrl.getServices().store.getSignals()[0].branches[0][0].signals[0].branches[0]
        test.deepEqual(action.mutations[0], {
          name: 'set',
          path: ['foo'],
          args: ['bar']
        })
        test.done()
      })
    }
  ]
  ctrl.addSignals({
    'testAsync': signalAsync
  })
  ctrl.getSignals().testAsync()
  ctrl.getSignals().test()
}

exports['should indicate async actions'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })
  var signal = [
    [
      function ActionA (args) { args.output() }
    ], function () {
      async(function () {
        test.ok(ctrl.getServices().store.getSignals()[0].branches[0][0].isAsync)
        test.done()
      })
    }
  ]

  ctrl.addSignals({
    'test': signal
  })
  ctrl.getSignals().test()
}

exports['should indicate when async actions are running'] = function (test) {
  test.expect(5)
  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })
  var signal = [
    function (args) {
      test.ok(!ctrl.getServices().store.isExecutingAsync())
    },
    [
      function (args) {
        test.ok(ctrl.getServices().store.isExecutingAsync())
        ctrl.once('actionEnd', function () {
          test.ok(!ctrl.getServices().store.isExecutingAsync())
        })
        args.output()
      }
    ],
    function (args) {
      test.ok(!ctrl.getServices().store.isExecutingAsync())
    }
  ]

  ctrl.addSignals({
    'test': signal
  })
  ctrl.on('signalEnd', function () {
    test.ok(!ctrl.getServices().store.isExecutingAsync())
    test.done()
  })
  ctrl.getSignals().test()
}

exports['should be able to remember previous signal'] = function (test) {
  var initialState = {}
  var state = initialState
  var Model = function () {
    return function (controller) {
      controller.on('reset', function () {
        state = initialState
      })

      return {
        mutators: {
          set: function (path, value) {
            state = {}
            state[path.pop()] = value
          },
          merge: function (path, value) {
            state = {}
          }
        }
      }
    }
  }
  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })
  var signal = [
    function (args) {
      args.state.set('foo', args.input.foo)
    }
  ]

  ctrl.addSignals({
    'test': signal
  })
  ctrl.getSignals().test({
    foo: 'bar'
  })
  ctrl.getSignals().test({
    foo: 'bar2'
  })
  async(function () {
    ctrl.getServices().store.remember(0)
    test.deepEqual(state, {foo: 'bar'})
    test.done()
  })
}

exports['should be able to remember async actions and run them synchronously when remembering'] = function (test) {
  var signalCount = 0
  var initialState = {}
  var state = initialState
  var Model = function () {
    return function (controller) {
      controller.on('reset', function () {
        state = initialState
      })
      controller.on('signalEnd', function () {
        signalCount++
        if (signalCount === 2) {
          controller.getServices().store.remember(0)
          test.deepEqual(state, {foo: 'bar'})
          test.done()
        }
      })
      return {
        mutators: {
          set: function (path, value) {
            state = {}
            state[path.pop()] = value
          },
          merge: function (path, value) {
            state = {}
          }
        }
      }
    }
  }
  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })
  var signal = [
    [
      function ActionA (args) {
        args.output({
          result: args.input.foo
        })
      }
    ], function ActionB (args) {
      args.state.set('foo', args.input.result)
    }
  ]

  ctrl.addSignals({
    'test': signal
  })
  ctrl.getSignals().test({
    foo: 'bar'
  })
  ctrl.getSignals().test({
    foo: 'bar2'
  })
}

exports['should be able to remember async actions and run them in the right order'] = function (test) {
  var setsCount = 0
  var initialState = {
    foo: true
  }
  var state = initialState
  var Model = function () {
    return function (controller) {
      controller.on('reset', function () {
        state = initialState
      })
      return {
        mutators: {
          set: function (path, value) {
            setsCount++
            state[path.pop()] = value
          },
          merge: function (path, value) {
            state = {
              foo: true
            }
          }
        }
      }
    }
  }

  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })

  ctrl.addSignals({
    signalA: {
      chain: [
        function (arg) {
          arg.state.set(['foo'], false)
        }
      ],
      isSync: true
    },
    signalB: {
      chain: [
        [
          function (arg) { async(arg.output) }
        ],
        function (arg) {
          arg.state.set(['foo'], true)
        }
      ],
      isSync: true
    }
  })

  ctrl.getSignals().signalB()
  ctrl.getSignals().signalA()

  async(function () {
    async(function () {
      ctrl.getServices().store.remember(0)
      test.equals(setsCount, 4)
      test.deepEqual(state, {foo: true})
      test.done()
    })
  })
}

exports['should be able to run multiple async signals and store them correctly'] = function (test) {
  var setsCount = 0
  var initialState = {
    foo: true
  }
  var state = initialState
  var Model = function () {
    return function (controller) {
      controller.on('reset', function () {
        state = initialState
      })
      return {
        mutators: {
          set: function (path, value) {
            setsCount++
            state[path.pop()] = value
          },
          merge: function (path, value) {
            state = {
              foo: true
            }
          }
        }
      }
    }
  }

  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })

  ctrl.addSignals({
    signalB: {
      chain: [
        [
          function (arg) { async(arg.output) }
        ],
        function (arg) {
          arg.state.set(['foo'], arg.input.foo)
        }
      ],
      isSync: true
    }
  })

  ctrl.getSignals().signalB({
    foo: true
  })
  ctrl.getSignals().signalB({
    foo: false
  })

  async(function () {
    async(function () {
      test.equals(setsCount, 2)
      test.deepEqual(state, {foo: false})
      test.done()
    })
  })
}
