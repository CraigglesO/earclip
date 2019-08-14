// @flow
let divisionCount = 4

type Point = Array<number>

export type Feature = {
  type: string,
  properties: Object,
  geometry: {
    coordinates: Array< Array<Point> >
  }
}

export type Vertices = Array<number> // [lon1, lat1, lon2, lat2, lon3, ...]

export type TriangularMesh = {
  vertices: Vertices,
  indices: Array<number>
}

export default function earclip (vertices: Vertices, divCount?: number = 4): TriangularMesh {
  divisionCount = divCount
  const verticesIndexLength = vertices.length / 2
  if (verticesIndexLength < 3) return { vertices, indices: [] }
  const indices = []
  let activeIndices = []
  let i1 = 0
  let i2 = 1
  let i3 = 2

  // first pass, create triangles as we create activeIndices
  do {
    activeIndices.push(i1)
    if (isConvex(vertices[i1 * 2], vertices[i1 * 2 + 1], vertices[i2 * 2], vertices[i2 * 2 + 1], vertices[i3 * 2], vertices[i3 * 2 + 1])) {
      indices.push(i1, i2, i3) // save the triangle
      i1 = i3
    } else { // concave, so we move the first index to the second and increment the others
      i1 = i2
    }
    i2 = i1 + 1
    i3 = i2 + 1
  } while (i3 < verticesIndexLength)
  // lastly save the current i1 as it is unused

  let ai1 = 0
  let ai2 = 1
  let ai3 = 2
  let ail = activeIndices.length
  while (ail >= 3) {
    i1 = activeIndices[ai1]
    i2 = activeIndices[ai2]
    i3 = activeIndices[ai3]
    if (isConvex(vertices[i1 * 2], vertices[i1 * 2 + 1], vertices[i2 * 2], vertices[i2 * 2 + 1], vertices[i3 * 2], vertices[i3 * 2 + 1])) {
      indices.push(i1, i2, i3) // save the triangle
      activeIndices.splice(ai2, 1) // remove the outer point of the triange
      ail--
    }
    ai1 = (ai1 + 1) % ail
    ai2 = (ai1 + 1) % ail
    ai3 = (ai2 + 1) % ail
  }

  return { vertices, indices }
}

// NOTE: This is designed specifically for counter-clockwise
export function isConvex (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): bool {
  let dx1 = x2 - x1
  let dy1 = y2 - y1
  let dx2 = x3 - x2
  let dy2 = y3 - y1

  return dx1 * dy2 - dy1 * dx2 > 0
}

export function flatten (feature: Feature) {
  const coords = feature.geometry.coordinates[0]

  // return [].concat.apply([], coords)
  return [].concat(...coords)
}
