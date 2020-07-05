let capio = require('./capio.js')
let test = require('@atakama/qtest')
let assert = require('assert')


async function sleep(msecs) {
    return new Promise((res)=>{
        setTimeout(res, msecs)
    })
}

test('one-io', async () => {
    let io_a = capio.captureIo(async ()=>{
        console.error("##a 1")
        await sleep(100)
        console.error("##a 2")
    }, process.stderr)

    let ios = await io_a

    assert.deepEqual(ios, '##a 1\n##a 2\n')
})

test('two-io', async () => {
    let io_a = capio.captureIo(async ()=>{
        console.error("##a 1")
        capio.debugLog("##a 1")
        await sleep(200)
        console.error("##a 2")
        capio.debugLog("##a 2")
    }, [process.stderr])
    let io_b = capio.captureIo(async ()=>{
        console.error("##b 1")
        console.error("##b 2")
    }, [process.stderr])

    let ios = await Promise.all([io_a, io_b])

    assert.deepEqual(ios, [['##a 1\n##a 2\n' ], [ '##b 1\n##b 2\n' ] ])
})

test('two-log', async () => {
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
})

test('err-io', async () => {
    try {
        await capio.captureIo(async ()=>{
            console.error("##b 1")
            throw(Error("b has an error"))
        }, [process.stderr])
    } catch (e) {
        assert.deepEqual(e.capio, ["##b 1\n"])
    }
})

test('err-log', async () => {
    try {
        await capio.captureLog(async ()=>{
            console.log("##b 1")
            throw(Error("b has an error"))
        }, [process.stderr])
    } catch (e) {
        assert.deepEqual(e.capio, ["##b 1"])
    }
})




test.run()
