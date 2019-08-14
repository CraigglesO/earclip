const fs = require('fs')

const australia = JSON.parse(fs.readFileSync('./featureCollections/australia.json', 'utf8'))

australia.features = australia.features.map(feature => {
  feature.geometry.coordinates[0] = feature.geometry.coordinates[0].map(point => {
    // console.log('POINT', point)
    while (point[0] > 180) { point[0] -= 360 }
    while (point[0] < -180) { point[0] += 360 }
    while (point[1] > 90) { point[1] -= 180 }
    while (point[1] < -90) { point[1] += 180 }

    return point
  })

  return feature
})

fs.writeFileSync('./australiaBetter.json', JSON.stringify(australia, null, 2))
