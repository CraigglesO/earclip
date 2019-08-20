// @flow
const fs = require('fs')
const earcut = require('earcut')
const earclip = require('./lib').default

const COUNTRIES = JSON.parse(fs.readFileSync('./featureCollections/countries.json', 'utf8'))
// const COUNTRIES = JSON.parse(fs.readFileSync('./featureCollections/australia.json', 'utf8'))

// const featureCollection = {
//   'type': 'FeatureCollection',
//   'features': []
// }

console.time('triangulation')
COUNTRIES.features.forEach((feature, i) => {
  // const data = earcut.flatten(feature.geometry.coordinates)
  // const indices = earcut(data.vertices, data.holes, data.dimensions)
  const sections = earclip(feature, 32)
  // console.log('sections', sections)

  // for (let section in sections) {
  //   for (let s = 0, sl = sections[section].pieces.length; s < sl; s++) {
  //     const feature = {
  //       'type': 'Feature',
  //       'properties': {
  //         section,
  //         index: i
  //       },
  //       'geometry': {
  //         'type': 'Polygon',
  //         'coordinates': [sections[section].pieces[s]]
  //       }
  //     }
  //     featureCollection.features.push(feature)
  //   }
  // }
})
console.timeEnd('triangulation')

// fs.writeFileSync('./out.json', JSON.stringify(featureCollection, null, 2))
