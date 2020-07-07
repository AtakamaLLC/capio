let capio = require('./capio.js')
let test = require('@atakama/qtest')
let assert = require('assert')
let { captureIo } = require('./capio.js')


async function sleep(msecs) {
    return new Promise((res)=>{
        setTimeout(res, msecs)
    })
}

test('one-io', async () => {
    let io_a = capio.captureIo(async ()=>{
        console.error("##a 1")
        await sleep(20)
        console.error("##a 2")
    }, process.stderr)

    let ios = await io_a

    assert.deepStrictEqual(ios, '##a 1\n##a 2\n')
})

test('unbound', async () => {
    let io_a = captureIo(async ()=>{
        console.error("##a 1")
    }, process.stderr)

    let ios = await io_a

    assert.deepStrictEqual(ios,'##a 1\n')
})

test('two-io', async () => {
    let io_a = capio.captureIo(async ()=>{
        console.error("##a 1")
        capio.errLog("##a 1")
        await sleep(100)
        console.error("##a 2")
        capio.errLog("##a 2")
    }, [process.stderr])
    let io_b = capio.captureIo(async ()=>{
        console.error("##b 1")
        console.error("##b 2")
    }, [process.stderr])

    let ios = await Promise.all([io_a, io_b])

    assert.deepStrictEqual(ios, [['##a 1\n##a 2\n' ], [ '##b 1\n##b 2\n' ] ])
})

test('into-log', async () => {
    const into = []
    const res = await capio.captureLog(async ()=>{
        console.log("##a 1")
        console.log("##a 2", "yo")
        return 44
    }, {into})
    assert.strictEqual(res, 44)
    assert.deepStrictEqual(into, [["##a 1"], ["##a 2", "yo"]])
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
    assert.deepStrictEqual(logs, [[["##a 1"],["##a 2"]],[["##b 1"],["##b 2"]]])
})

test('err-io', async () => {
    try {
        await capio.captureIo(async ()=>{
            console.error("##b 1")
            throw(Error("b has an error"))
        }, [process.stderr])
    } catch (e) {
        assert.deepStrictEqual(e.capio, ["##b 1\n"])
    }
})

test('err-log', async () => {
    try {
        await capio.captureLog(async ()=>{
            console.log("##b 1")
            throw(Error("b has an error"))
        })
    } catch (e) {
        assert.deepStrictEqual(e.caplog, [["##b 1"]])
    }
})

test('nested', async() => {
    let inner
    let outer = await capio.captureLog(async ()=>{
      console.log("before")
      await sleep(10)
      inner = await capio.captureLog(async ()=>{
          await sleep(10)
          console.log("inner")
      })
      await sleep(10)
      console.log("after")
    })

    console.log("you should see this though")
    assert.deepStrictEqual(inner, [['inner']])
    assert.deepStrictEqual(outer, [['before'], ['after']])
})



test.run()
