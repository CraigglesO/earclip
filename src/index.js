const { earcut } = require('./earcut')

function earclip (polygon, offset = 0) {
  // Use earcut to build standard triangle set
  const { vertices, holeIndices } = flatten(polygon) // dim => dimensions
  const indices = earcut(vertices, holeIndices)

  return { vertices, indices: indices.map(index => index + offset) }
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
  return { vertices, holeIndices }
}

exports.earclip = earclip
exports.flatten = flatten
exports.earcut = earcut
