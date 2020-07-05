/*
 * Async capture stdio/console and global context
 *
 * Overview:
 *
 * Test systems that capture console output need to be run linearly.
 * The node async_hooks facility can fix this, by installing and restoring 
 * stream capture during context swihchces.
 * 
 * Synopsis:
 *    capio = require('@atakama/capio')
 *
 *    res = await capio.captureIo(function, () => {
 *          // do something async
 *    }, [process.stdout])
 *
 */

const { createHook, executionAsyncId} = require('async_hooks');

const createDomain = require('domain').create;
const fs = require('fs')
const util = require('util')
const assert = require('assert')

class Capio extends Function {
    constructor (opts) {
        super('...args', 'return this._bound.add(...args)')
        this._bound = this.bind(this)
        const inst = this._bound
        inst._chain = new Map()
        inst._hooks = new Map()
        inst._restore = ()=>{}
        inst._caps = 0
        inst.opts = opts || {}
        inst._asyncHook = createHook({
            init: inst.onAsyncInit.bind(inst),
            before: inst.onAsyncBefore.bind(inst),
            after: inst.onAsyncAfter.bind(inst),
            destroy: inst.onAsyncDone.bind(inst),
            promiseResolve: inst.onAsyncDone.bind(inst)
        })
        return inst
    }

    debugLog(...args) {
        if (this.opts.debug) {
            this.errLog(...args)
        }
    }
    
    errLog(...args) {
        if (this.opts.debug) {
            fs.writeSync(1, util.format(...args) + "\n")
        }
    }

    onAsyncInit(id, type, trigger) {
        if (type != "PROMISE") {
            return
        }
        this._chain.set(id, trigger)
        let hooks = this._hooks.get(trigger)
        if (hooks) {
            this._hooks.set(id, hooks)
            this.debugLog("init", id, trigger)
        }
    }
    onAsyncBefore(id) {
        const hooks = this._hooks.get(id)
        if (hooks) {
            this.debugLog("before", id, hooks[2])
            hooks[0]()
        }
    }
    onAsyncAfter(id) {
        const hooks = this._hooks.get(id)
        if (hooks) {
            this.debugLog("after", id, hooks[2])
            hooks[1]()
        }
    }
    onAsyncDone(id) {
        if (this._hooks.get(id)) {
            this.debugLog("done", id)
        }
        this._hooks.delete(id)
        this._chain.delete(id)
        this._chain.forEach((v, k)=>{
            if (v === id) {
                this.onAsyncDone(k)
            }
        })
    }

    async capture(duringFunc, obj, methodName, newFunc) {
        const domain = createDomain();
        const orig = obj[methodName]

        obj[methodName] = (...args) => {
            if (process.domain && process.domain.hook) {
                process.domain.hook(...args)
            } else {
                return orig(...args)
            }
        }
        domain.hook = newFunc
        await domain.run(duringFunc)
    }

    async captureIo(func, streams, opts) {
        opts = opts || {}
        opts.id=Math.random()
        return await Promise.all(streams.map( stream => this.captureWriteStream(func, stream, opts)))
    }
    
    async captureWriteStream(func, stream) {
        let cap = ""
        let newWrite = (data) => {
            cap += data 
        }
        await this.capture(func, stream, "write", newWrite)

        return cap
    }

    async captureLog(func, stream, opts) {
        opts = opts || {}
        let original = console.log
        let cap = []
        let newLog = (...args) => {
            cap.push(args)
            if (opts.spy) {
                original(...args)
            }
        }
        await this.capture(async ()=>{
            await func()
        }, ()=>{console.log=newLog}, ()=>{console.log=original}, opts.id)
        
        return cap
    }
}


const manager = new Capio()

manager.Capio = Capio

module.exports = manager
