let capio = require('./capio.js')
let test = require('@atakama/qtest')
let assert = require('assert')


async function sleep(msecs) {
    return new Promise((res)=>{
        setTimeout(res, msecs)
    })
}

test('one-io', async () => {
    let original = process.stderr.write

    let io_a = capio.captureIo(async ()=>{
        console.error("##a 1")
        await sleep(100)
        console.error("##a 2")
    }, [process.stderr])

    let ios = await io_a

    assert.deepEqual(ios, ['##a 1\n##a 2\n' ])
    assert.equal(process.stderr.write, original)
})

test('two-io', async () => {
    let original = process.stderr.write

    let io_a = capio.captureIo(async ()=>{
        console.error("##a 1")
        capio.debugLog("##a 1")
        await sleep(500)
        console.error("##a 2")
        capio.debugLog("##a 2")
    }, [process.stderr])
    let io_b = capio.captureIo(async ()=>{
        console.error("##b 1")
        console.error("##b 2")
    }, [process.stderr])

    let ios = await Promise.all([io_a, io_b])

    assert.deepEqual(ios, [['##a 1\n##a 2\n' ], [ '##b 1\n##b 2\n' ] ])
    assert.strictEqual(process.stderr.write, original)
})

test('simple log', async () => {
    let original = console.log
    try {
        let io_a = capio.captureLog(async ()=>{
            console.log("##a 1")
            await sleep(100)
            console.log("##a 2")
        })
        let io_b = capio.captureLog(async ()=>{
            console.log("##b 1")
            console.log("##b 2")
        })
        let logs = await Promise.all([io_a, io_b])
        assert.deepEqual(logs, [[["##a 1"],["##a 2"]],[["##b 1"],["##b 2"]]])
        assert.strictEqual(console.log, original)
    } catch (e) {
        console.log = original
        throw(e)
    }
})

test.run()
