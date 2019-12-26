const { earcut } = require('./earcut')

function earclip (polygon, maxLength = Infinity, offset = 0) {
  // Use earcut to build standard triangle set
  const { vertices, holeIndices, dim } = flatten(polygon) // dim => dimensions
  const indices = earcut(vertices, holeIndices, dim, offset)

  // for each triangle, ensure the length of all three sides are no greater than maxLength
  if (maxLength !== Infinity) {
    let A, B, C
    for (let i = 0; i < indices.length; i += 3) {
      // run through each triangle set, everytime the length of even one side is
      // larger than maxLength, we split it in half using the largest side of greater
      // than max length against the opposite point
      // step 1: grab a triangle set
      A = vertices.slice(indices[i] * dim, (indices[i] * dim) + dim)
      B = vertices.slice(indices[i + 1] * dim, (indices[i + 1] * dim) + dim)
      C = vertices.slice(indices[i + 2] * dim, (indices[i + 2] * dim) + dim)
      // check if any of the lines are longer than allowable length
      if (Math.max(length(A, B, dim), length(B, C, dim), length(A, C, dim)) > maxLength) {
        // get midpoints for each line
        const [F, E, D] = midpoint(A, B, C, dim)
        // th result will create FOUR new triangles, but only require creating 3 new index sets and 3 new vertices
        // add the triangles middle point
        vertices.push(...F, ...E, ...D)
        // get vertex index of the new point
        const FIndex = vertices.length / dim - 3
        const EIndex = vertices.length / dim - 2
        const DIndex = vertices.length / dim - 1
        // store A-F-D
        indices.push(indices[i], FIndex, DIndex)
        // store F-B-E
        indices.push(FIndex, indices[i + 1], EIndex)
        // store E-C-D
        indices.push(EIndex, indices[i + 2], DIndex)
        // finally edit current triangle to the middle "inner" triangle to F-E-D
        indices[i] = FIndex
        indices[i + 1] = EIndex
        indices[i + 2] = DIndex
        // back track to make sure the new triangle created is not also too large
        i -= 3
      }
    }
  }
  return { vertices, indices }
}

function length (p1, p2, dim) {
  let acc = 0
  for (let i = 0; i < dim; i++) acc += Math.pow(p2[i] - p1[i], 2)
  return Math.sqrt(acc)
}

function midpoint (A, B, C, dim) {
  const F = []
  const E = []
  const D = []
  // get the midpoints of each line from A->B, A->C, B->C
  for (let i = 0; i < dim; i++) F.push((A[i] + B[i]) / 2)
  for (let i = 0; i < dim; i++) E.push((B[i] + C[i]) / 2)
  for (let i = 0; i < dim; i++) D.push((C[i] + A[i]) / 2)
  return [F, E, D]
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
