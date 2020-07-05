# Capio - async log, io and generic global state capture

When writing unit test for complex async code it's somtimes difficult to isolate compoenent output.

Node's [async_hooks](https://nodejs.org/api/async_hooks.html) library provides enough information to allow
globals to be swapped in and out.

Alternately, the deprecated [domain](https://nodejs.org/api/domain.html) module can be used.

Capio wraps both of these libraries

### Console log capture:

Consider this:

```node
test1 = async ()=>{
    await thing1()
}

test2 = async ()=>{
    await thing2()
}
```

When run linearly, we can use the simple [capture_console](https://www.npmjs.com/package/capture-console) hook to capture output:

However, if we want to run `thing1` and `thing2` in parallel, the logs will get jumbled up.

Capio allows this to work:

```node
run1 = async (test) => {
    try {
        await capio.captureLog(test)
    } except (e) {
        console.log(e) 
        e.log.map(args => console.log(...args))
    }
}

Promise.all(tests.map(t=>run1(t)))
```

### I/O Spies

Capio can be used to 'spy' streams as well:

```node
spied = await capio.captureIo(test, [socket, process.stdout], {spy: true})

console.log("socket", spied[0])
console.log("stdout", spied[1])
```


### Low level tool for framework devs

This will call `swapIn` every time async execution contexts are run in the test, 
and will call `swapOut` evert time they are finished.

```
await capio.capture(test, swapIn, swapOut)
```
