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

const fs = require('fs')

class Capio extends Function {
    constructor (opts) {
        super('...args', 'return this._bound.add(...args)')
        this._bound = this.bind(this)
        const inst = this._bound
        inst._chain = new Map()
        inst._hooks = new Map()
        inst.opts = opts || {}
        inst._asyncHook = createHook({
            init: inst.onAsyncInit.bind(inst),
            before: inst.onAsyncBefore.bind(inst),
            after: inst.onAsyncBefore.bind(inst),
            destroy: inst.onAsyncDone.bind(inst),
            promiseResolve: inst.onAsyncDone.bind(inst)
        })
        return inst
    }

    debugLog(...args) {
        if (this.opts.debug) {
            fs.writeSync(1, args.map(arg => JSON.stringify(arg)).join(" ") + "\n")
        }
    }

    onAsyncInit(id, type, trigger) {
        if (type != "PROMISE") {
            return
        }
        this._chain[id]=trigger
        
        let hooks
        while (trigger && !hooks) {
            hooks = this._hooks[trigger]
            trigger = this._chain[trigger]
        }
        this._hooks[id] = hooks
        if (hooks) {
            this.debugLog("init", id, trigger)
        }
    }
    onAsyncBefore(id) {
        const hooks = this._hooks[id]
        if (hooks) {
            this.debugLog("before", id)
            hooks[0]()
        }
    }
    onAsyncAfter(id) {
        const hooks = this._hooks[id]
        if (hooks) {
            hooks[1]()
        }
    }
    onAsyncDone(id) {
        delete this._hooks[id]
        delete this._chain[id]
        const hooks = this._hooks[id]
        if (hooks) {
            hooks[1]()
        }
    }

    async capture(func, before, after) {
        const aid = executionAsyncId()
        this._caps += 1
        this._hooks[aid]=[before, after]
        this._asyncHook.enable()
        before()
        await func()
        after()
        this._caps -= 1
        delete this._hooks[aid]
        delete this._chain[aid]
        if (this._caps == 0) {
            this._asyncHook.disable()
        }
    }

    async captureIo(func, streams, spy) {
        return await Promise.all(streams.map( stream => this._captureIo(func, stream, spy)))
    }

    async _captureIo(func, stream, spy) {
        let original = stream.write
        let cap = ""
        let newWrite = (data, ...args) => {
            cap += data 
            if (spy) {
                original(data, ...args)
            }
        }
        await this.capture(async ()=>{
            await func()
        }, async ()=>{stream.write=newWrite}, ()=>{stream.write=original})
        
        return cap
    }
}


const manager = new Capio()

manager.Capio = Capio

module.exports = manager

async function sleep(msecs) {
    return new Promise((res)=>{
        setTimeout(res, msecs)
    })
}

async function main() {
    let io_a = manager.captureIo(async ()=>{
        console.error("##a 1")
        await sleep(200)
        console.error("##a 2")
    }, [process.stderr])
    let io_b = manager.captureIo(async ()=>{
        console.error("##b 1")
        console.error("##b 2")
    }, [process.stderr])

    let ios = Promise.all([io_a, io_b])

    console.log(await ios)
}


(async () => {
    await main()
})()
