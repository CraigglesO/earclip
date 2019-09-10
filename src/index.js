const { earcut } = require('./earcut')

let divisionCount = 0
let EXTENT = 4096

function earclip (rings, dC = 0, extent) { // dC -> divisionCount
  divisionCount = dC
  if (extent) EXTENT = extent

  const vertices = []
  const indices = []
  const sections = divideFeature(rings)

  let offset = 0

  for (const s in sections) {
    const section = sections[s]
    // corner case: if first ring of section is an inner ring, just add a box:
    if (!section[0].outer) section.unshift(createBox(s))
    for (let s = 0, sl = section.length; s < sl; s++) {
      const holeIndices = []
      const data = flatten(section[s])
      // for all following sections that have outer === false, add them
      // to data and track their indcies
      while (s + 1 < sl && !section[s + 1].outer) {
        s++
        const startHoleIndex = data.length / 2
        data.push(...flatten(section[s]))
        holeIndices.push(startHoleIndex)
      }
      const ind = earcut(data, holeIndices, offset)
      offset += data.length / 2
      vertices.push(...data)
      indices.push(...ind)
    }
  }

  return { vertices, indices }
}

function divideFeature (rings) {
  const sectionPoly = []
  const sections = {} // sections[sectionID] = Array< Array<[number, number]> > (array of lines)

  for (let r = 0, rl = rings.length; r < rl; r++) {
    const ring = rings[r]
    const sectionRing = []
    const ringSections = {}

    const currentSSection = getSsection(ring[0][0])
    const currentTSection = getSsection(ring[0][1])
    let currentSection = `${currentSSection}_${currentTSection}`
    let sectionCoords = [ring[0]]
    sectionRing.push([currentSSection, currentTSection])
    if (r === 0) sectionCoords.outer = true
    else sectionCoords.outer = false
    let section

    for (let i = 1, cl = ring.length; i < cl; i++) {
      const sSection = getSsection(ring[i][0])
      const tSection = getSsection(ring[i][1])
      section = `${sSection}_${tSection}`
      if (section === currentSection) { // we still in the same section, so just keep adding data
        sectionCoords.push(ring[i])
      } else { // crossed into a new section
        sectionRing.push([sSection, tSection])
        // create points at intersections (they may be the same point)
        const [firstIntersectionCoord, lastIntersectionCoord] = getIntersections(ring[i - 1], ring[i], sectionCoords.outer, ringSections)
        // add the point to end of the current section
        sectionCoords.push(firstIntersectionCoord)
        // sometimes we hit an edge and its considered an intersection, so don't add it
        if (sectionCoords.length === 3 && sectionCoords[2][0] === sectionCoords[1][0] && sectionCoords[2][1] === sectionCoords[1][1]) {
        } else { // otherwise lets add the data
          if (!sectionCoords.outer && (sectionCoords[0][0] !== sectionCoords[sectionCoords.length - 1][0] || sectionCoords[0][1] !== sectionCoords[sectionCoords.length - 1][1])) {
            sectionCoords.outer = true
          }
          if (ringSections[currentSection]) { // if currentSection already exists, join it.
            ringSections[currentSection].push(sectionCoords)
          } else { // completely new section data to store
            ringSections[currentSection] = [sectionCoords]
          }
        }
        // and now we start a new sectionCoords and be sure to add the intersection
        sectionCoords = [lastIntersectionCoord, ring[i]]
        if (r === 0) sectionCoords.outer = true
        else sectionCoords.outer = false
        currentSection = section
      }
    }

    if (sectionCoords.length) { // check if we have leftovers, we reconnect it to the beginning
      if (ringSections[section]) { // the area is large enough to encompass multiple ringSections so we are back at the beginning
        sectionCoords.pop() // remove the extra point (polys start and end on the same point)
        ringSections[section][0] = sectionCoords.concat(ringSections[section][0])
        ringSections[section][0].outer = true // since we know for a fact the ring leaves the bounding box, it must be true
      } else { // small enough that this is the only data
        ringSections[section] = [sectionCoords]
      }
    }

    // now put all the ring's sections into the main sections array
    for (const key in ringSections) {
      if (sections[key]) {
        // store all the rings, ensuring proper ordering
        for (let r = 0, rl = ringSections[key].length; r < rl; r++) {
          const ring = ringSections[key][r]
          if (ring.outer) sections[key].unshift(ring)
          else sections[key].push(ring)
        }
      } else sections[key] = ringSections[key]
    }

    // lastly store the sectionRing
    sectionPoly.push(sectionRing)
  }

  if (Object.keys(sections).length > 1) { // we have multiple sections, so we need to close the geometry
    closeSections(sections)
    addInnerSquares(sections, sectionPoly)
  }

  return sections
}

function getIntersections (p1, p2, outer, sections) {
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

  // organize by closest to the initial point (to maintain counter-clockwise)
  points = points.sort((a, b) => {
    return Math.sqrt(Math.pow(p1[0] - a[0], 2) + Math.pow(p1[1] - a[1], 2)) - Math.sqrt(Math.pow(p1[0] - b[0], 2) + Math.pow(p1[1] - b[1], 2))
  })

  // create/add the middle sections
  for (let i = 0, pl = points.length - 1; i < pl; i++) {
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
    const sectionCoords = [points[i], points[i + 1]]
    sectionCoords.outer = outer
    if (sections[section]) {
      sections[section].push(sectionCoords)
    } else {
      sections[section] = [sectionCoords]
    }
  }

  // return the first and last point
  return [points[0], points[points.length - 1]]
}

// for each section go from last point to first point, following edge points counter-clockwise
function closeSections (sections) {
  for (const section in sections) {
    for (let s = 0; s < sections[section].length; s++) {
      const poly = sections[section][s]
      const first = poly[0]
      let last = poly[poly.length - 1]
      // corner case, a line that already closes on itself (could be an inner ring [hole])
      if (first[0] === last[0] && first[1] === last[1]) continue
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
      let failSafety = 0
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
        // failSafety
        failSafety++
        if (failSafety > 6) {
          throw new Error('Earclip: Self intersecting features are not supported.')
        }
      }

      // sort by which points are closest to the endPoint and pick the first
      const endPoint = beginEndSameLine.sort((a, b) => {
        return Math.abs(a.point[0] + a.point[1] - last[0] - last[1]) - Math.abs(b.point[0] + b.point[1] - last[0] - last[1])
      })[0]

      // if first, than close the poly and move on
      if (endPoint.index === 0) {
        poly.push(first)
        sections[section][s] = poly
        sections[section][s].outer = true
      } else {
        sections[section][s] = poly.concat(sections[section][endPoint.index])
        sections[section][s].outer = true
        sections[section].splice(endPoint.index, 1)
        s--
      }
    }
  }
}

// add the appropriate squares leftover
function addInnerSquares (sections, sectionPoly) {
  const { minS, maxS, minT, maxT } = bbox(sectionPoly)

  for (let s = minS; s < maxS; s++) {
    for (let t = minT; t < maxT; t++) {
      const sectionID = `${s}_${t}`
      if (!sections[sectionID] && inside([s, t], sectionPoly)) {
        sections[sectionID] = [createBox(sectionID)]
      }
    }
  }
}

function createBox (section) {
  const bounds = getSectionBounds(section)
  const box = [
    [bounds[0], bounds[1]],
    [bounds[0], bounds[3]],
    [bounds[2], bounds[3]],
    [bounds[2], bounds[1]],
    [bounds[0], bounds[1]]
  ]

  box.outer = true

  return box
}

function bbox (poly) {
  let minS = Infinity
  let maxS = -Infinity
  let minT = Infinity
  let maxT = -Infinity
  for (let r = 0, pl = poly.length; r < pl; r++) {
    const ring = poly[r]
    for (let p = 0, rl = ring.length - 1; p < rl; p++) {
      const point = ring[p]
      if (point[0] < minS) minS = point[0]
      else if (point[0] > maxS) maxS = point[0]
      if (point[1] < minT) minT = point[1]
      else if (point[1] > maxT) maxT = point[1]
    }
  }

  return { minS, maxS, minT, maxT }
}

function inside (point, poly) {
  let insidePoly = false
  // check if it is in the outer ring first
  if (inRing(point, poly[0])) {
    const ringLength = poly.length
    let inHole = false
    let k = 1
    // check for the point in any of the holes
    while (k < ringLength && !inHole) {
      if (inRing(point, poly[k])) inHole = true
      k++
    }
    if (!inHole) insidePoly = true
  }
  return insidePoly
}

function inRing (point, ring) {
  let isInside = false
  if (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) {
    ring = ring.slice(0, ring.length - 1)
  }
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    // const onBoundary = (point[1] * (xi - xj) + yi * (xj - point[0]) + yj * (point[0] - xi) === 0) &&
    //   ((xi - point[0]) * (xj - point[0]) <= 0) && ((yi - point[1]) * (yj - point[1]) <= 0)
    // if (onBoundary) return true
    const intersect = ((yi > point[1]) !== (yj > point[1])) &&
      (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi)
    if (intersect) isInside = !isInside
  }
  return isInside
}

function getSsection (s) {
  return Math.floor(divisionCount / EXTENT * s)
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

function flatten (sectionPoints) { // convert Array<Point> to Array<number>
  return [].concat(...sectionPoints)
}

exports.earclip = earclip
exports.flatten = flatten

// SAVED FOR POSTERITY
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
