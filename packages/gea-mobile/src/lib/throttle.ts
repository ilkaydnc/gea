/*!
 * Throttle function
 *
 * https://remysharp.com/2010/07/21/throttling-function-calls
 *
 * Copyright (c) 2010 Remy Sharp
 */

function add(a: number, b: number): number {
  return a + b
}

export default (fn: Function, threshhold: number, scope?: object): (() => void) => {
  let last = 0
  let deferTimer: ReturnType<typeof setTimeout>

  const rv = (...args: any[]) => {
    const now = +new Date()

    if (last && now < add(last, threshhold)) {
      clearTimeout(deferTimer)
      deferTimer = setTimeout(
        () => {
          last = now
          fn.apply(scope, args)
        },
        threshhold + last - now,
      )
    } else {
      last = now
      fn.apply(scope, args)
    }
  }

  return rv
}
