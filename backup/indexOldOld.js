// @flow
// const LAT = [-90, 90]
// const LON = [-180, 180]
// const LAT_DIV = 180 / divisionCount
// const LON_DIV = 360 / (divisionCount * 2)
let divisionCount = 4

type Point = Array<number>

type Feature = {
  type: string,
  properties: Object,
  geometry: {
    coordinates: Array< Array<Point> >
  }
}

export type TriangularMesh = {
  vertices: Array<Point>,
  indices: Point
}

type Section = Array< Array<Point> >

type Sections = {
  [string]: Section
}

export default function earclip (feature: Feature, divCount?: number = 4): any {
  divisionCount = divCount
  const coords = feature.geometry.coordinates[0]

  const sections: Sections = {}

  let currentLonSection = getLonSection(coords[0][0])
  let currentLatSection = getLatSection(coords[0][1])
  let section
  let currentSection = section = `${currentLonSection}_${currentLatSection}`
  let sectionCoords = [coords[0]]

  for (let i = 1, cl = coords.length; i < cl; i++) {
    const lonSection = getLonSection(coords[i][0])
    const latSection = getLatSection(coords[i][1])
    section = `${lonSection}_${latSection}`
    if (section === currentSection) { // we still in the same section, so just keep adding data
      sectionCoords.push(coords[i])
    } else { // crossed into a new section
      // create points at intersections (they may be the same point)
      const [firstIntersectionCoord, lastIntersectionCoord] = getIntersections(coords[i - 1], coords[i], sections)
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

function getLatSection (lat: number): number {
  return Math.floor(divisionCount / 180 * lat + (divisionCount / 2))
}

function getLonSection (lon: number): number {
  return Math.floor((divisionCount * 2) / 360 * lon + ((divisionCount * 2) / 2))
}

function getSectionLat (section: number): number {
  return -90 + 180 / divisionCount * section
}

function getSectionLon (section: number): number {
  return -180 + 360 / (divisionCount * 2) * section
}

function getSectionBounds (str: string): [number, number, number, number] {
  let sections: Array<number> = str.split('_').map(x => parseInt(x))

  return [
    getSectionLon(sections[0]),
    getSectionLat(sections[1]),
    getSectionLon(sections[0] + 1),
    getSectionLat(sections[1] + 1)
  ]
}

function lineIntersect (p1: Point, p2: Point, p3: Point, p4: Point): [number, number] {
  let denom = (p4[1] - p3[1]) * (p2[0] - p1[0]) - (p4[0] - p3[0]) * (p2[1] - p1[1])
  // if (denom === 0) { return [] } NOTE: This can not happen with our algorithm
  let ua = ((p4[0] - p3[0]) * (p1[1] - p3[1]) - (p4[1] - p3[1]) * (p1[0] - p3[0])) / denom

  return [p1[0] + ua * (p2[0] - p1[0]), p1[1] + ua * (p2[1] - p1[1])]
}

function getIntersections (p1: Point, p2: Point, sections: Sections) {
  // work our way from one sector the other, adding sections as we go
  let p1LonSection = getLonSection(p1[0])
  let p1LatSection = getLatSection(p1[1])
  let p2LonSection = getLonSection(p2[0])
  let p2LatSection = getLatSection(p2[1])

  let points = []

  // get the bounding box of sections
  let top, bottom, left, right
  if (p2LatSection > p1LatSection) {
    top = p2LatSection
    bottom = p1LatSection
  } else {
    top = p1LatSection
    bottom = p2LatSection
  }
  if (p2LonSection < p1LonSection) {
    left = p2LonSection
    right = p1LonSection
  } else {
    left = p1LonSection
    right = p2LonSection
  }

  // iterate through each section and find the intersection of that line
  // top to bottom
  for (let j = bottom + 1; j <= top; j++) {
    let sectionLat = getSectionLat(j)
    let intersect = lineIntersect(p1, p2, [-180, sectionLat], [180, sectionLat])
    points.push([intersect[0], sectionLat])
  }
  // left to right
  for (let i = left + 1; i <= right; i++) {
    let sectionLon = getSectionLon(i)
    let intersect = lineIntersect(p1, p2, [sectionLon, -90], [sectionLon, 90])
    points.push([sectionLon, intersect[1]])
  }

  // organize by closest to the initial point (to maintain counter-clockwise) TODO: improve
  points = points.sort((a, b) => {
    return Math.sqrt(Math.pow(p1[0] - a[0], 2) + Math.pow(p1[1] - a[1], 2)) - Math.sqrt(Math.pow(p1[0] - b[0], 2) + Math.pow(p1[1] - b[1], 2))
  })

  // create/add the middle sections
  for (let i = 0, pl = points.length - 1; i < pl; i++) {
    // We are interested in saving the line in the "lower" x or y section
    let section
    p1LonSection = getLonSection(points[i][0])
    p1LatSection = getLatSection(points[i][1])
    p2LonSection = getLonSection(points[i + 1][0])
    p2LatSection = getLatSection(points[i + 1][1])
    if (p1LonSection < p2LonSection) {
      section = `${p1LonSection}_`
    } else {
      section = `${p2LonSection}_`
    }
    if (p1LatSection < p2LatSection) {
      section += p1LatSection
    } else {
      section += p2LatSection
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
function findPointsInVector (startingPoints, lastPoint, wall) {
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

// NEXT: for each section go from last point to first point, following edge points counter-clockwise
function closeSections (sections) {
  for (let section in sections) {
    for (let s = 0; s < sections[section].length; s++) {
      let poly = sections[section][s]
      const first = poly[0]
      let last = poly[poly.length - 1]
      const sectionBounds = getSectionBounds(section)
      // Wall: left -> 0, bottom -> 1, right -> 2, and top -> 3 (coexists with section bounds)
      let wall = getWall(last, sectionBounds)

      // add all the starting points to check against
      let startPoints = [{ point: first, index: 0 }]
      for (let sp = 1, sl = sections[section].length; sp < sl; sp++) {
        startPoints.push({ point: sections[section][sp][0], index: sp })
      }
      // move to corners counter-clockwise until we hit the beginning of one the polys
      let beginEndSameLine = findPointsInVector(startPoints, last, wall)
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
        if (wall > 3) { wall = 0 }
        // check if the new corner point aligns with a starter point
        beginEndSameLine = findPointsInVector(startPoints, last, wall)
      }

      // sort by which points are closest to the endPoint and pick the first
      let endPoint = beginEndSameLine.sort((a, b) => {
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
function addInnerSquares (sections) {
  const sectionDepth = {}
  // organize the sections as lon->lat
  for (let section in sections) {
    let lonLat = section.split('_').map(x => parseInt(x))
    if (sectionDepth[lonLat[0]]) {
      sectionDepth[lonLat[0]].push(lonLat[1])
    } else {
      sectionDepth[lonLat[0]] = [lonLat[1]]
    }
  }
  for (let lon in sectionDepth) {
    let lats = sectionDepth[lon].sort((a, b) => { return a - b })
    for (let i = lats[0], ll = lats[lats.length - 1]; i < ll; i++) {
      if (!sections[`${lon}_${i}`]) {
        let bounds = getSectionBounds(`${lon}_${i}`)
        sections[`${lon}_${i}`] = [[
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
