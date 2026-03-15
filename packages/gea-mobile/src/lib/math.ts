/**!
 * Adapted from Google Closure Library, math.js
 *
 *
 * Copyright 2006 The Closure Library Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const modulo = (a: number, b: number): number => {
  const r = a % b
  return r * b < 0 ? r + b : r
}

const lerp = (a: number, b: number, x: number): number => a + x * (b - a)

const nearlyEquals = (a: number, b: number, opt_tolerance?: number): boolean =>
  Math.abs(a - b) <= (opt_tolerance || 0.000001)

const standardAngle = (angle: number): number => modulo(angle, 360)

const toRadians = (angleDegrees: number): number => (angleDegrees * Math.PI) / 180

const toDegrees = (angleRadians: number): number => (angleRadians * 180) / Math.PI

const angleDx = (degrees: number, radius: number): number => radius * Math.cos(toRadians(degrees))

const angleDy = (degrees: number, radius: number): number => radius * Math.sin(toRadians(degrees))

const angle = (x1: number, y1: number, x2: number, y2: number): number => {
  const d = toDegrees(Math.atan2(y2 - y1, x2 - x1))
  return standardAngle(d)
}

const angleDifference = (startAngle: number, endAngle: number): number => {
  const d = standardAngle(endAngle) - standardAngle(startAngle)
  if (d > 180) {
    return d - 360
  } else if (d <= -180) {
    return 360 + d
  }
  return d
}

const sign = (x: number): number => {
  if (x > 0) {
    return 1
  } else if (x < 0) {
    return -1
  }
  return x
}

const longestCommonSubsequence = <T>(
  array1: T[],
  array2: T[],
  compareFn: (a: T, b: T) => boolean = (a, b) => a == b,
): number[][] => {
  const arr: number[][] = []
  const length1 = array1.length
  const length2 = array2.length
  for (let i = 0; i < length1 + 1; i++) {
    arr.push([])
    arr[i][0] = 0
  }
  for (let j = 0; j < length2; j++) {
    arr[0][j] = 0
  }
  for (let i = 0; i < length1; i++) {
    for (let j = 0; j < length2; j++) {
      if (compareFn(array1[i], array2[j])) {
        arr[i + 1][j + 1] = arr[i][j] + 1
      } else {
        arr[i + 1][j + 1] = Math.max(arr[i][j + 1], arr[i + 1][j])
      }
    }
  }

  return arr
}

const distance = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

export default {
  modulo,
  lerp,
  nearlyEquals,
  standardAngle,
  toRadians,
  toDegrees,
  angleDx,
  angleDy,
  angle,
  angleDifference,
  sign,
  longestCommonSubsequence,
  distance,
}
