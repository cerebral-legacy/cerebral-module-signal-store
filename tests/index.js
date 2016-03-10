var Controller = require('cerebral')
var SignalStore = require('../index.js')

// trick to load devtools module with signalStore
global.window = {
  addEventListener: function () {},
  dispatchEvent: function () {}
}
global.CustomEvent = function () {}
var suite = {}

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

suite['should keep signals by default'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: function () {},
    store: SignalStore()
  })
  var signal = [
    function () {}
  ]

  ctrl.addSignals({
    'test': signal,
    'done': [
      function (args) {
        async(function () {
          test.equals(args.services.store.getSignals().length, 3)
          test.done()
        })
      }
    ]
  })
  ctrl.getSignals().test()
  ctrl.getSignals().test()
  ctrl.getSignals().done()
}

suite['should store details about signal'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: function () {},
    store: SignalStore()
  })
  var signal = [
    function ActionA () {}
  ]

  ctrl.addSignals({
    'test': signal,
    'done': [
      function (args) {
        async(function () {
          var signal = args.services.store.getSignals()[0]
          test.equal(signal.name, 'test')
          test.deepEqual(signal.input, {foo: true})
          test.equal(signal.branches.length, 1)
          test.done()
        })
      }
    ]
  })
  ctrl.getSignals().test({
    foo: true
  })
  ctrl.getSignals().done()
}

suite['should not store default args'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: function () {},
    store: SignalStore()
  })
  var signal = [
    function ActionA () {}
  ]

  ctrl.addServices({
    utils: function () {

    }
  })
  ctrl.addSignals({
    'test': signal,
    'done': [
      function (args) {
        async(function () {
          var signal = args.services.store.getSignals()[0]
          test.equal(signal.name, 'test')
          test.deepEqual(signal.input, {foo: true})
          test.equal(signal.branches.length, 1)
          test.done()
        })
      }
    ]
  })
  ctrl.getSignals().test({
    foo: true
  })
  ctrl.getSignals().done()
}

suite['should store details about actions'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: function () {},
    store: SignalStore()
  })
  var signal = [
    function ActionA () {}
  ]

  ctrl.addSignals({
    'test': signal,
    'done': [
      function (args) {
        async(function () {
          var action = args.services.store.getSignals()[0].branches[0]
          test.equal(action.name, 'ActionA')
          test.equal(action.mutations.length, 0)
          test.done()
        })
      }
    ]
  })
  ctrl.getSignals().test({
    foo: true
  })
  ctrl.getSignals().done()
}

suite['should store details about mutations'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: function () {},
    store: SignalStore()
  })
  var signal = [
    function ActionA (args) {
      args.state.set('foo', 'bar')
    }
  ]

  ctrl.addSignals({
    'test': signal,
    'done': [
      function (args) {
        async(function () {
          var action = args.services.store.getSignals()[0].branches[0]
          test.deepEqual(action.mutations[0], {
            name: 'set',
            path: ['foo'],
            args: ['bar']
          })
          test.done()
        })
      }
    ]
  })
  ctrl.getSignals().test()
  ctrl.getSignals().done()
}

suite['should store details about mutations correctly across sync and async signals'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: function () {},
    store: SignalStore()
  })
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
        var actionAsync = args.services.store.getSignals()[0].branches[1]
        test.deepEqual(actionAsync.mutations[0], {
          name: 'set',
          path: ['foo'],
          args: ['bar']
        })

        var action = args.services.store.getSignals()[0].branches[0][0].signals[0].branches[0]
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

suite['should indicate async actions'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: function () {},
    store: SignalStore()
  })
  var signal = [
    [
      function ActionA (args) { args.output() }
    ], function (args) {
      async(function () {
        test.ok(args.services.store.getSignals()[0].branches[0][0].isAsync)
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
  ctrl.addModules({
    devtools: function () {},
    store: SignalStore()
  })
  var signal = [
    function (args) {
      test.ok(!args.services.store.isExecutingAsync())
    },
    [
      function (args) {
        test.ok(args.services.store.isExecutingAsync())
        ctrl.once('actionEnd', function () {
          test.ok(!args.services.store.isExecutingAsync())
        })
        args.output()
      }
    ],
    function (args) {
      test.ok(!args.services.store.isExecutingAsync())
      async(function () {
        test.ok(!args.services.store.isExecutingAsync())
        test.done()
      })
    }
  ]

  ctrl.addSignals({
    'test': signal
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
  ctrl.addModules({
    devtools: function () {},
    store: SignalStore()
  })
  var signal = [
    function (args) {
      args.state.set('foo', args.input.foo)
    }
  ]

  ctrl.addSignals({
    'test': signal,
    'done': [
      function (args) {
        async(function () {
          args.services.store.remember(0)
          test.deepEqual(state, {foo: 'bar'})
          test.done()
        })
      }
    ]
  })
  ctrl.getSignals().test({
    foo: 'bar'
  })
  ctrl.getSignals().test({
    foo: 'bar2'
  })
  ctrl.getSignals().done()
}

suite['should be able to remember async actions and run them synchronously when remembering'] = function (test) {
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
  ctrl.addModules({
    devtools: function () {},
    store: SignalStore()
  })
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
    'test': signal,
    'done': [
      function (args) {
        async(function () {
          args.services.store.remember(0)
          test.deepEqual(state, {foo: 'bar'})
          test.done()
        })
      }
    ]
  })
  ctrl.getSignals().test({
    foo: 'bar'
  })
  ctrl.getSignals().test({
    foo: 'bar2'
  })
  ctrl.getSignals().done()
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
  ctrl.addModules({
    devtools: function () {},
    store: SignalStore()
  })

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
        },
        function done (args) {
          async(function () {
            args.services.store.remember(0)
            test.equals(setsCount, 4)
            test.deepEqual(state, {foo: true})
            test.done()
          })
        }
      ],
      immediate: true
    }
  })

  ctrl.getSignals().signalB()
  ctrl.getSignals().signalA()
}

suite['should be able to run multiple async signals and store them correctly'] = function (test) {
  var setsCount = 0
  var endsCalled = 0
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
  ctrl.addModules({
    devtools: function () {},
    store: SignalStore()
  })

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
    },
    done: [
      function done (args) {
        async(function () {
          test.equals(setsCount, 2)
          test.deepEqual(state, {foo: false})
          test.done()
        })
      }
    ]
  })
  ctrl.on('signalEnd', function () {
    endsCalled++
    if (endsCalled === 2) {
      ctrl.getSignals().done()
    }
  })
  ctrl.getSignals().signalB({
    foo: true
  })
  ctrl.getSignals().signalB({
    foo: false
  })
}

module.exports = { store: suite }
