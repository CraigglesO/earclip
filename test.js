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

// const featureCollection = {
//   type: 'FeatureCollection',
//   features: []
// }

const sea = JSON.parse(fs.readFileSync('./featureCollections/sea10m.json', 'utf8'))

const data = earclip(sea.geometry[0], 32)

// const { vertices, indices } = data

// for (let i = 0, il = indices.length; i < il; i += 3) {
//   const feature = {
//     type: 'Feature',
//     properties: {},
//     geometry: {
//       type: 'Polygon',
//       coordinates: [[
//         [vertices[indices[i] * 2] / 4096, vertices[indices[i] * 2 + 1] / 4096],
//         [vertices[indices[i + 1] * 2] / 4096, vertices[indices[i + 1] * 2 + 1] / 4096],
//         [vertices[indices[i + 2] * 2] / 4096, vertices[indices[i + 2] * 2 + 1] / 4096],
//         [vertices[indices[i] * 2] / 4096, vertices[indices[i] * 2 + 1] / 4096]
//       ]]
//     }
//   }

  // featureCollection.features.push(feature)
// }

// fs.writeFileSync('./out.json', JSON.stringify(featureCollection, null, 2))
