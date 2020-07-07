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

function padZero(num, pad) {
  return ('0'.repead(pad)+num).slice(-pad);
}

function timeFmt() {
  const t = new Date()
  const nn = padZero(t.getMinutes(), 2)
  const ss = padZero(t.getSeconds(), 2)
  const mmm = padZero(t.getMilliseconds(), 3)
  return nn + ":" + ss + "." + mmm 
}

function stackInfo() {
}

class Capio {
    constructor (opts) {
        this.opts = opts || {}
        if (AsyncLocalStorage) {
            this._asyncStore = new AsyncLocalStorage();
        }
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
            return await this.hookAsync(...args)
        else
            return await this.hookDomain(...args)
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
        return await domain.run(duringFunc)
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
        let cap = opts.into || []
        let newLog = (...args) => {
            if (opts.prefix === true) {
              let prefix = "[" + timeFmt(opts) + " " + stackInfo(opts) + "]"
              args.unshift(prefix)
            }
            cap.push(args)
            if (opts.spy) {
                original(...args)
            }
        }
        try {
            const res = await this.hook(func, console, "log", newLog)
            if (opts.into) {
              return res
            }
        } catch (e) {
            e.caplog = cap
            throw(e)
        }

        return cap
    }
}


const manager = new Capio()

module.exports.Capio = Capio
module.exports.errLog = manager.errLog
module.exports.captureIo = (...args) => manager.captureIo(...args)
module.exports.captureLog = (...args) => manager.captureLog(...args)
