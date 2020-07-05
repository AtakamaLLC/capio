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

const { AsyncLocalStorage } = require('async_hooks');
const createDomain = require('domain').create;

const fs = require('fs')
const util = require('util')

class Capio extends Function {
    constructor (opts) {
        super('...args', 'return this._bound.add(...args)')
        this._bound = this.bind(this)
        const inst = this._bound
        inst.opts = opts || {}
        if (AsyncLocalStorage) {
            inst._asyncStore = new AsyncLocalStorage();
        }
        return inst
    }

    debugLog(...args) {
        if (this.opts.debug) {
            this.errLog(...args)
        }
    }
    
    errLog(...args) {
        fs.writeSync(1, util.format(...args) + "\n")
    }

    async hook(...args) {
        if (AsyncLocalStorage)
            await this.hookAsync(...args)
        else
            await this.hookDomain(...args)
    }

    async hookAsync(duringFunc, obj, methodName, newFunc) {
        const orig = obj[methodName]
        obj[methodName] = (...args) => {
            const call = this._asyncStore.getStore() || orig
            call(...args)
        }
        return await this._asyncStore.run(newFunc, () => {
            this._asyncStore.enterWith(newFunc);
            return duringFunc()
        })
    }
    
    async hookDomain(duringFunc, obj, methodName, newFunc) {
        const domain = createDomain();
        const orig = obj[methodName]

        obj[methodName] = (...args) => {
            const call = (process.domain && process.domain.hook) || orig
            return call(...args)
        }
        domain.hook = newFunc
        await domain.run(duringFunc)
    }

    async captureIo(func, streams, opts) {
        if (!Array.isArray(streams))
            return await this.captureWriteStream(func, streams, opts)

        // grab all results, even if they fail
        let needThrow = null
        const res = await Promise.all(streams.map( async (stream) => {
            try {
                return await this.captureWriteStream(func, stream, opts)
            } catch (e) {
                needThrow = e
                return e.capio
            }
        }))

        // throw an error with the first-to fail, and any other results if we have it
        if (needThrow) {
            needThrow.capio = res
            throw(needThrow)
        }
        return res
    }
    
    async captureWriteStream(func, stream, opts) {
        opts = opts || {}
        let original = stream.write
        let cap = ""
        let newWrite = (data, ...args) => {
            cap += data 
            if (opts.spy) {
                original(data, ...args)
            }
        }
        try {
            await this.hook(func, stream, "write", newWrite)
        } catch (e) {
            e.capio = cap
            throw(e)
        }

        return cap
    }

    async captureLog(func, opts) {
        opts = opts || {}
        let original = console.log
        let cap = []
        let newLog = (...args) => {
            cap.push(args)
            if (opts.spy) {
                original(...args)
            }
        }
        try {
            await this.hook(func, console, "log", newLog)
        } catch (e) {
            e.capio = cap
        }

        return cap
    }
}


const manager = new Capio()

manager.Capio = Capio

module.exports = manager
