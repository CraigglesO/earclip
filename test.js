// const earclip = require('./lib').default
//
// console.log(earclip([
//   3, 0,
//   3, 3,
//   1, 2,
//   0, 10,
//   -1, 1,
//   -2, 2,
//   -3, 0,
//   0, -2,
//   3, 0
// ]))

const fs = require('fs')
const { earclip } = require('./lib')
// const earcut = require('earcut')

const featureCollection = {
  type: 'FeatureCollection',
  features: []
}

// const squares = [
//   [
//     [0, 0],
//     [4096, 0],
//     [4096, 4096],
//     [0, 4096],
//     [0, 0]
//   ],
//   [
//     [1024, 1024],
//     [1024, 3072],
//     [3072, 3072],
//     [3072, 1024],
//     [1024, 1024]
//   ]
// ]

// const squares = [
//   [
//     [0, 0],
//     [4096, 0],
//     [4096, 4096],
//     [0, 4096],
//     [0, 0]
//   ],
//   [
//     [512, 512],
//     [512, 1536],
//     [1536, 1536],
//     [1536, 512],
//     [512, 512]
//   ],
//   [
//     [512, 2560],
//     [512, 2560 + 1024],
//     [512 + 1024, 2560 + 1024],
//     [512 + 1024, 2560],
//     [512, 2560]
//   ]
// ]

const input = JSON.parse(fs.readFileSync('./featureCollections/holesTest.json', 'utf8'))

const allCoords = [input.features[0].geometry.coordinates[8]]
// const allCoords = input.features[0].geometry.coordinates
// const allCoords = [[[
//   [0, 0],
//   [4096, 0],
//   [4096, 4096],
//   [0, 4096],
//   [0, 0]
// ]]]

const vertices = []
const indices = []

allCoords.forEach(coords => {
  const data = earclip(coords, 4096 / 16, vertices.length / 2)
  vertices.push(...data.vertices)
  indices.push(...data.indices)
})

for (let i = 0, il = indices.length; i < il; i += 3) {
  const feature = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [vertices[indices[i] * 2] / 4096, vertices[indices[i] * 2 + 1] / 4096],
        [vertices[indices[i + 1] * 2] / 4096, vertices[indices[i + 1] * 2 + 1] / 4096],
        [vertices[indices[i + 2] * 2] / 4096, vertices[indices[i + 2] * 2 + 1] / 4096],
        [vertices[indices[i] * 2] / 4096, vertices[indices[i] * 2 + 1] / 4096]
      ]]
    }
  }

  featureCollection.features.push(feature)
}

fs.writeFileSync('./out.json', JSON.stringify(featureCollection, null, 2))

// function getSsection (s) {
//   return Math.floor(16 / 4096 * s + (16 / 4096))
// }
