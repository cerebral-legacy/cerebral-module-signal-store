var Controller = require('cerebral')
var Store = require('../index')
var suite = {}
var async = function (cb) {
  setTimeout(cb, 0)
}
var Model = function (state) {
  state = state || {}
  return function () {
    return {
      accessors: {
        get: function (path) {
          return state[path[0]]
        }
      },
      mutators: {
        set: function (path, value) {
          state[path.pop()] = value
        }
      }
    }
  }
}

suite['should keep signals by default'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({ store: Store() })
  var signal = [
    function () {}
  ]

  ctrl.addSignals({
    'test': {
      chain: signal,
      immediate: true
    }
  })
  ctrl.getSignals().test()
  ctrl.getSignals().test()
  test.equals(ctrl.getServices().store.getSignals().length, 2)
  test.done()
}

suite['should add signalStoreRef to signals'] = function (test) {
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
  }, {
    immediate: true
  })
  ctrl.getSignals().async()
  ctrl.getSignals().sync()
  async(function () {
    test.ok(ctrl.getServices().store.getSignals()[0].signalStoreRef)
    test.ok(ctrl.getServices().store.getSignals()[0].branches[0][0].signals[0].signalStoreRef)
    test.done()
  })
}

suite['should indicate async actions'] = function (test) {
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

suite['should indicate when async actions are running'] = function (test) {
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

suite['should be able to remember previous signal'] = function (test) {
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

suite['should be able to remember async actions and run them synchronously when remembering'] = function (test) {
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

suite['should be able to remember async actions and run them in the right order'] = function (test) {
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
      immediate: true
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
      immediate: true
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

suite['should be able to run multiple async signals and store them correctly'] = function (test) {
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
      immediate: true
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

module.exports = suite
