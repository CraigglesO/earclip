const { earcut } = require('./earcut')

function earclip (polygon, maxLength = Infinity, offset = 0) {
  // Use earcut to build standard triangle set
  const { vertices, holeIndices, dim } = flatten(polygon) // dim => dimensions
  const indices = earcut(vertices, holeIndices, dim)

  // for each triangle, ensure the length of all three sides are no greater than maxLength
  if (maxLength !== Infinity) {
    let A, B, C, BC, AC, p1, p2, p3, len, zig, vec1, vec2, ccw
    let len1 = 0
    let len2 = 0
    for (let i = 0; i < indices.length; i += 3) {
      // run through each triangle set, everytime the length of even one side is
      // larger than maxLength, we split it in half using the largest side of greater
      // than max length against the opposite point
      // step 1: grab a triangle set
      A = indices[i]
      B = indices[i + 1]
      C = indices[i + 2]
      // step 2: Get largest and second largest line
      // set AB to start
      len1 = length(vertices, A, B, dim)
      p1 = C
      // Place BC
      BC = length(vertices, B, C, dim)
      if (BC > len1) {
        len2 = len1
        len1 = BC
        p2 = p1
        p1 = A
      } else {
        len2 = BC
        p2 = A
      }
      // Place AC
      AC = length(vertices, A, C, dim)
      if (AC > len1) {
        len2 = len1
        len1 = AC
        p3 = p2
        p2 = p1
        p1 = B
      } else if (AC > len2) {
        len2 = AC
        p3 = p2
        p2 = B
      } else {
        p3 = B
      }
      // Step 3: check if the largest line is longer than allowable length (maxLength)
      // if so, we shrink the geometry.
      if (len1 > maxLength + 0.01) {
        // prep our zig-zag, first line, and orientation of said line; if linear orientation, we move on
        zig = true
        len = len1
        ccw = orientation(vertices, p1, p2, p3, dim)
        if (ccw === 0) continue // linear geometry, ignore
        else if (ccw === 1) ccw = false
        else ccw = true
        // find the vectors for each line for quick computations
        vec1 = getVector(vertices, p1, p3, dim)
        vec2 = getVector(vertices, p2, p3, dim)
        // Presented with a triange that needs to be reduced in area, use a zig-zag pattern
        // starting at the opposite point of the longest line (max) and second point
        // the second longest (secondMax), we work inward creating new vertices maxLength distance
        // from each starting point (p1 & p2)
        while (len > maxLength) {
          // find and store the point maxLength distance from p1 using vec
          if (zig) { // zig
            vertices.push(...pointOnLine(vertices, p2, vec2, dim, maxLength))
            len1 -= maxLength
            len = len2
          } else { // zag
            vertices.push(...pointOnLine(vertices, p2, vec1, dim, maxLength))
            len2 -= maxLength
            len = len1
          }
          // get new vertex index
          const newVertexIndex = vertices.length / dim - 1
          // store
          if (ccw) indices.push(p1, p2, newVertexIndex)
          else indices.push(p1, newVertexIndex, p2)
          // move indices foward
          p2 = p1
          p1 = newVertexIndex // this is not the opposite of the longest line
          // if we have already zigged, than we zag; use our current state to reduce length
          zig = !zig
          // update orientation
          ccw = !ccw
        }
        // now we store the final triangle that links us back to the most acute angle (p3)
        ccw = orientation(vertices, p1, p2, p3, dim)
        if (ccw === 2) {
          indices[i] = p1
          indices[i + 1] = p2
          indices[i + 2] = p3
        } else {
          indices[i] = p1
          indices[i + 1] = p3
          indices[i + 2] = p2
        }
        // no matter what decrement to where we started incase all 3 sides are greater than maxLength
        i -= 3
      }
    }
  }
  return { vertices, indices: indices.map(index => index + offset) }
}

// https://www.geeksforgeeks.org/orientation-3-ordered-points/
function orientation (vertices, p1, p2, p3, dim) {
  let val
  if (dim === 2) {
    val = (vertices[p2 * 2 + 1] - vertices[p1 * 2 + 1]) * (vertices[p3 * 2] - vertices[p2 * 2]) -
      (vertices[p2 * 2] - vertices[p1 * 2]) * (vertices[p3 * 2 + 1] - vertices[p2 * 2 + 1])
  } else {}
  if (val === 0) return 0
  return (val > 0) ? 1 : 2
}

function getVector (vertices, p1, p2, dim) {
  const res = []
  const len = length(vertices, p1, p2, dim)
  // create slope
  for (let i = 0; i < dim; i++) res.push(vertices[p2 * dim + i] - vertices[p1 * dim + i])
  // divide each by length
  for (let i = 0; i < dim; i++) res[i] /= len
  return res
}

function pointOnLine (vertices, index, vec, dim, maxLength) {
  const res = []
  for (let i = 0; i < dim; i++) res.push(vertices[index * dim + i] + vec[i] * maxLength)
  return res
}

function length (vertices, p1, p2, dim) {
  let acc = 0
  for (let i = 0; i < dim; i++) acc += Math.pow(vertices[p2 * dim + i] - vertices[p1 * dim + i], 2)
  return Math.sqrt(acc)
}

function flatten (data) {
  let holeIndex = 0
  const vertices = []
  const holeIndices = []

  for (let i = 0, pl = data.length; i < pl; i++) {
    for (let j = 0, ll = data[i].length; j < ll; j++) vertices.push(...data[i][j])
    if (i > 0) {
      holeIndex += data[i - 1].length
      holeIndices.push(holeIndex)
    }
  }
  return { vertices, holeIndices, dim: data[0][0].length }
}

exports.earclip = earclip
exports.flatten = flatten
exports.earcut = earcut
