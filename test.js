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
const earclip = require('./lib').default

const featureCollection = {
  'type': 'FeatureCollection',
  'features': []
}

let australia = JSON.parse(fs.readFileSync('./featureCollections/countries.json', 'utf8'))
// australia.features = [australia.features[29]]

console.time('total')
australia.features.forEach((feature, i) => {
  // console.log('i', i)
  if (feature.geometry.coordinates[0].length > 1000) {
    console.log(i, ' - ', feature.geometry.coordinates[0].length)
  }
  // console.log(feature.geometry.coordinates[0].length)
  // console.time('earclip')
  const data = earclip(feature.geometry.coordinates[0], 32)
  // console.log('data', data)
  // console.timeEnd('earclip')

  // console.time('earcut')
  // const data2 = earcut.flatten(feature.geometry.coordinates)
  // const indices = earcut(data2.vertices, data2.holes, data2.dimensions)
  // console.timeEnd('earcut')

  // console.log()
  // const { vertices, indices } = data
  //
  // for (let i = 0, il = indices.length; i < il; i += 3) {
  //   const feature = {
  //     type: 'Feature',
  //     properties: {},
  //     geometry: {
  //       type: 'Polygon',
  //       coordinates: [[
  //         [vertices[indices[i] * 2], vertices[indices[i] * 2 + 1]],
  //         [vertices[indices[i + 1] * 2], vertices[indices[i + 1] * 2 + 1]],
  //         [vertices[indices[i + 2] * 2], vertices[indices[i + 2] * 2 + 1]],
  //         [vertices[indices[i] * 2], vertices[indices[i] * 2 + 1]]
  //       ]]
  //     }
  //   }
  //
  //   featureCollection.features.push(feature)
  // }
})
console.timeEnd('total')

fs.writeFileSync('./out.json', JSON.stringify(featureCollection, null, 2))
