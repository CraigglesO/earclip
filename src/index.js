const { earcut } = require('./earcut')

let divisionCount = 0
let EXTENT = 4096

function earclip (coords, dC = 0, extent) { // dC -> divisionCount ; dT -> divisionType
  divisionCount = dC
  if (extent) EXTENT = extent

  const vertices = []
  const indices = []
  const sections = divideFeature(coords)

  let offset = 0

  for (const section in sections) {
    const subsection = sections[section]
    for (let s = 0, sl = subsection.length; s < sl; s++) {
      const data = flatten(subsection[s])
      const ind = earcut(data, null, offset)
      offset += data.length / 2
      vertices.push(...data)
      indices.push(...ind)
    }
  }

  return { vertices, indices }
}

function divideFeature (coords) {
  const sections = {}

  const currentLonSection = getSsection(coords[0][0])
  const currentLatSection = getSsection(coords[0][1])
  let currentSection = `${currentLonSection}_${currentLatSection}`
  let sectionCoords = [coords[0]]
  let section

  for (let i = 1, cl = coords.length; i < cl; i++) {
    const sSection = getSsection(coords[i][0])
    const tSection = getSsection(coords[i][1])
    section = `${sSection}_${tSection}`
    if (section === currentSection) { // we still in the same section, so just keep adding data
      sectionCoords.push(coords[i])
    } else { // crossed into a new section
      // create points at intersections (they may be the same point)
      const [firstIntersectionCoord, lastIntersectionCoord] = getIntersections(coords[i - 1], coords[i], sections)
      if (lastIntersectionCoord[0] === 3072 && lastIntersectionCoord[1] === 258.5) {
      }
      // add the point to end of the current section
      sectionCoords.push(firstIntersectionCoord)
      // sometimes we hit an edge and its considered an intersection, so don't add it
      if (sectionCoords.length === 3 && sectionCoords[2][0] === sectionCoords[1][0] && sectionCoords[2][1] === sectionCoords[1][1]) {
      } else { // otherwise lets add the data
        if (sections[currentSection]) { // if currentSection already exists, join it.
          sections[currentSection].push(sectionCoords)
        } else { // completely new section data to store
          sections[currentSection] = [sectionCoords]
        }
      }
      // and now we start a new sectionCoords and be sure to add the intersection
      sectionCoords = [lastIntersectionCoord, coords[i]]
      currentSection = section
    }
  }

  if (sectionCoords.length) { // check if we have leftovers, we reconnect it to the beginning
    if (sections[section]) { // the area is large enough to encompass multiple sections so we are back at the beginning
      sections[section][0] = sectionCoords.concat(sections[section][0])
      closeSections(sections)
      addInnerSquares(sections)
    } else { // small enough that this is the only data
      sections[section] = [sectionCoords]
    }
  }

  return sections
}

function getIntersections (p1, p2, sections) {
  // work our way from one sector the other, adding sections as we go
  let p1SSection = getSsection(p1[0])
  let p1TSection = getSsection(p1[1])
  let p2SSection = getSsection(p2[0])
  let p2TSection = getSsection(p2[1])

  let points = []

  // get the bounding box of sections
  let top, bottom, left, right
  if (p2TSection > p1TSection) {
    top = p2TSection
    bottom = p1TSection
  } else {
    top = p1TSection
    bottom = p2TSection
  }
  if (p2SSection < p1SSection) {
    left = p2SSection
    right = p1SSection
  } else {
    left = p1SSection
    right = p2SSection
  }

  // iterate through each section and find the intersection of that line
  // top to bottom
  for (let j = bottom + 1; j <= top; j++) {
    const sectionT = getSectionS(j)
    const intersect = lineIntersect(p1[0], p1[1], p2[0], p2[1], -2, sectionT, 2, sectionT)
    points.push([intersect[0], sectionT])
  }
  // left to right
  for (let i = left + 1; i <= right; i++) {
    const sectionS = getSectionS(i)
    const intersect = lineIntersect(p1[0], p1[1], p2[0], p2[1], sectionS, -2, sectionS, 2)
    points.push([sectionS, intersect[1]])
  }

  // organize by closest to the initial point (to maintain counter-clockwise) TODO: improve
  points = points.sort((a, b) => {
    return Math.sqrt(Math.pow(p1[0] - a[0], 2) + Math.pow(p1[1] - a[1], 2)) - Math.sqrt(Math.pow(p1[0] - b[0], 2) + Math.pow(p1[1] - b[1], 2))
  })

  // create/add the middle sections
  for (let i = 0, pl = points.length - 1; i < pl; i++) {
    // We are interested in saving the line in the "lower" x or y section
    let section
    p1SSection = getSsection(points[i][0])
    p1TSection = getSsection(points[i][1])
    p2SSection = getSsection(points[i + 1][0])
    p2TSection = getSsection(points[i + 1][1])
    if (p1SSection < p2SSection) {
      section = `${p1SSection}_`
    } else {
      section = `${p2SSection}_`
    }
    if (p1TSection < p2TSection) {
      section += p1TSection
    } else {
      section += p2TSection
    }
    // save appropriately
    if (sections[section]) {
      sections[section].push([points[i], points[i + 1]])
    } else {
      sections[section] = [[points[i], points[i + 1]]]
    }
  }

  // return the first and last point
  return [points[0], points[points.length - 1]]
}

// NEXT: for each section go from last point to first point, following edge points counter-clockwise
function closeSections (sections) {
  for (const section in sections) {
    for (let s = 0; s < sections[section].length; s++) {
      const poly = sections[section][s]
      const first = poly[0]
      let last = poly[poly.length - 1]
      const sectionBounds = getSectionBounds(section)
      // Wall: left -> 0, bottom -> 1, right -> 2, and top -> 3 (coexists with section bounds)
      let wall = getWall(last, sectionBounds)

      // add all the starting points to check against
      const startPoints = [{ point: first, index: 0 }]
      for (let sp = 1, sl = sections[section].length; sp < sl; sp++) {
        startPoints.push({ point: sections[section][sp][0], index: sp })
      }
      // move to corners counter-clockwise until we hit the beginning of one the polys
      let beginEndSameLine = findPointsAlongVector(startPoints, last, wall)
      while (!beginEndSameLine.length) {
        if (wall === 0) { // left wall -> bottom-left
          last = [sectionBounds[0], sectionBounds[1]]
        } else if (wall === 1) { // bottom wall -> bottom-right
          last = [sectionBounds[2], sectionBounds[1]]
        } else if (wall === 2) { // right wall -> top-right
          last = [sectionBounds[2], sectionBounds[3]]
        } else { // top wall -> top-left
          last = [sectionBounds[0], sectionBounds[3]]
        }
        // add the new corner point
        poly.push(last)
        // update the wall
        wall++
        if (wall > 3) wall = 0
        // check if the new corner point aligns with a starter point
        beginEndSameLine = findPointsAlongVector(startPoints, last, wall)
      }

      // sort by which points are closest to the endPoint and pick the first
      const endPoint = beginEndSameLine.sort((a, b) => {
        return Math.abs(a.point[0] + a.point[1] - last[0] - last[1]) - Math.abs(b.point[0] + b.point[1] - last[0] - last[1])
      })[0]

      // if first, than close the poly and move on
      if (endPoint.index === 0) {
        poly.push(first)
        sections[section][s] = poly
      } else {
        sections[section][s] = poly.concat(sections[section][endPoint.index])
        sections[section].splice(endPoint.index, 1)
        s--
      }
    }
  }
}

// LAST STEP: add the appropriate squares leftover
// COUNTRIES.features[616] -> TODO: Don't fill in the squares that aren't actually inside the polygon
function addInnerSquares (sections) {
  const sectionDepth = {}
  const sectionsPoly = []
  // organize the sections as s->t
  for (const section in sections) {
    const st = section.split('_').map(x => parseInt(x))
    sectionsPoly.push(st)
    if (sectionDepth[st[0]]) {
      sectionDepth[st[0]].push(st[1])
    } else {
      sectionDepth[st[0]] = [st[1]]
    }
  }
  for (const s in sectionDepth) {
    const ts = sectionDepth[s].sort((a, b) => { return a - b })
    for (let t = ts[0], ll = ts[ts.length - 1]; t < ll; t++) {
      if (!sections[`${s}_${t}`] && inside([s, t], sectionsPoly)) {
        const bounds = getSectionBounds(`${s}_${t}`)
        sections[`${s}_${t}`] = [[
          [bounds[0], bounds[1]],
          [bounds[0], bounds[3]],
          [bounds[2], bounds[3]],
          [bounds[2], bounds[1]],
          [bounds[0], bounds[1]]
        ]]
      }
    }
  }
}

function inside (point, vs) {
  const x = point[0]
  const y = point[1]

  let inside = false
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0]
    const yi = vs[i][1]
    const xj = vs[j][0]
    const yj = vs[j][1]

    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }

  return inside
}

// function getLatSection (lat) {
//   return Math.floor(divisionCount / 180 * lat + Math.floor(divisionCount / 2))
// }
//
// function getLonSection (lon) {
//   return Math.floor((divisionCount * 2) / 360 * lon + Math.floor((divisionCount * 2) / 2))
// }
//
// function getSectionLat (section) {
//   return -90 + 180 / divisionCount * section
// }
//
// function getSectionLon (section) {
//   return -180 + 360 / (divisionCount * 2) * section
// }

// function getUsection (u) {
//   return Math.floor(divisionCount / 2 * u + Math.floor(divisionCount / 2))
// }
//
// function getSectionU (section) {
//   return -1 + 2 / divisionCount * section
// }

function getSsection (s) {
  return Math.floor(divisionCount / EXTENT * s + Math.floor(divisionCount / EXTENT))
}

function getSectionS (section) {
  return EXTENT / divisionCount * section
}

function getSectionBounds (str) {
  const sections = str.split('_').map(x => parseInt(x))

  return [getSectionS(sections[0]), getSectionS(sections[1]), getSectionS(sections[0] + 1), getSectionS(sections[1] + 1)]
}

function lineIntersect (x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom

  return [x1 + ua * (x2 - x1), y1 + ua * (y2 - y1)]
}

// find the active wall to
function getWall (point, sectionBounds) {
  if (point[0] === sectionBounds[0] && point[1] === sectionBounds[3]) { // top-left corner
    return 0 // left wall
  } else if (point[0] === sectionBounds[0] && point[1] === sectionBounds[1]) { // bottom-left corner
    return 1 // bottom wall
  } else if (point[0] === sectionBounds[2] && point[1] === sectionBounds[1]) { // bottom-right corner
    return 2 // right wall
  } else if (point[0] === sectionBounds[2] && point[1] === sectionBounds[3]) { // top-right corner
    return 3
  } else if (point[0] === sectionBounds[0]) { // left wall
    return 0
  } else if (point[1] === sectionBounds[1]) { // bottom wall
    return 1
  } else if (point[0] === sectionBounds[2]) { // right wall
    return 2
  } else { // last possible scenerio, point is on the top wall
    return 3
  }
}

// given a wall (vector direction) check if lastPoint moves towards firstPoint
function findPointsAlongVector (startingPoints, lastPoint, wall) {
  return startingPoints.reduce((acc, currentValue) => {
    const startPoint = currentValue.point
    if (wall === 0 && startPoint[0] === lastPoint[0] && startPoint[1] <= lastPoint[1]) { // left wall
      acc.push(currentValue)
    } else if (wall === 1 && startPoint[1] === lastPoint[1] && startPoint[0] >= lastPoint[0]) { // bottom wall
      acc.push(currentValue)
    } else if (wall === 2 && startPoint[0] === lastPoint[0] && startPoint[1] >= lastPoint[1]) { // right wall
      acc.push(currentValue)
    } else if (wall === 3 && startPoint[1] === lastPoint[1] && startPoint[0] <= lastPoint[0]) { // top wall
      acc.push(currentValue)
    }

    return acc
  }, [])
}

function flatten (feature) {
  return [].concat(...feature)
}

exports.earclip = earclip
exports.flatten = flatten
