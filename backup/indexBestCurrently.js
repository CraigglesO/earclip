// flow
import RBT from './rbTree'
import LinkedList from './linkedList'

export type Vertices = Array<number>

export type Indices = Array<number>

type Point = [number, number]

type Feature = {
  type: string,
  properties: Object,
  geometry: {
    coordinates: Array< Array<Point> >
  }
}

export type TriangularMesh = {
  vertices: Array<number>,
  indices: Array<number>
}

type NewVertices = { // keep track of the index of each new vertex pair
  [number]: number
}

type Pieces = {
  indices: LinkedList,
  yTree: RBT
}

type Sections = { // we keep track of pieces and which boundaries they fall under sections[section] = indexOfPieces
  [string]: Array<Pieces>
}

type Options = {
  divisionCount: number,
  getYSection: Function,
  getXSection: Function,
  getSectionY: Function,
  getSectionX: Function
}

export default class earclip {
  divisionCount: number = 4
  vertices: Vertices = []
  indices: Indices = []
  sections: Sections = {}
  newVertices: NewVertices = {}
  counter: number = 0
  constructor (options?: Options) {
    if (!options) options = {}
    if (options.divisionCount) { this.divisionCount = options.divisionCount }
    if (options.getYSection) { this.getYSection = options.getYSection }
    if (options.getXSection) { this.getXSection = options.getXSection }
    if (options.getSectionY) { this.getSectionY = options.getSectionY }
    if (options.getSectionY) { this.getSectionY = options.getSectionY }
  }

  clear () {
    this.vertices = []
    this.indices = []
    this.sections = {}
  }

  clip (): TriangularMesh {
    this._organizeVertices()
    this._createTriangles()

    return {
      vertices: this.vertices,
      indices: this.indices
    }
  }

  _organizeVertices () {
    let section
    let currentSection = section = this.getXSection(this.vertices[0]) + '_' + this.getYSection(this.vertices[1])
    let pieceIndices = new LinkedList(0)
    let pieceYTree = new RBT(this.vertices[1], [pieceIndices.start])

    for (let i = 1, cl = this.vertices.length / 2; i < cl; i++) {
      section = this.getXSection(this.vertices[i * 2]) + '_' + this.getYSection(this.vertices[i * 2 + 1])
      if (section === currentSection) { // we are still in the same section, so just keep adding data
        pieceIndices.push(i)
        pieceYTree.insert(this.vertices[i * 2 + 1], [pieceIndices.end])
      } else { // crossed into a new section
        // create points at intersections (they may be the same point)
        const [firstIntersectionIndex, lastIntersectionIndex] = this._createIntersections(i - 1, i)
        // add the point to end of the current section
        pieceIndices.push(firstIntersectionIndex)
        pieceYTree.insert(this.vertices[firstIntersectionIndex * 2 + 1], [pieceIndices.end])
        // sometimes we hit an edge and its considered an intersection, so don't add it
        let lastIndex = pieceIndices.end.index
        let secondToLastIndex = pieceIndices.start.next.index
        if (pieceIndices.length === 3 &&
          this.vertices[lastIndex * 2] === this.vertices[secondToLastIndex * 2] &&
          this.vertices[lastIndex * 2 + 1] === this.vertices[secondToLastIndex * 2 + 1]) {
        } else { // otherwise lets add the data
          if (this.sections[currentSection]) { // if currentSection already exists, join it.
            this.sections[currentSection].push({
              indices: pieceIndices,
              yTree: pieceYTree
            })
          } else { // completely new section data to store
            this.sections[currentSection] = [{
              indices: pieceIndices,
              yTree: pieceYTree
            }]
          }
        }
        // and now we start a new pieceIndices and be sure to add the intersection
        pieceIndices = new LinkedList([lastIntersectionIndex, i])
        pieceYTree = new RBT(this.vertices[lastIntersectionIndex * 2 + 1], [lastIntersectionIndex])
        pieceYTree.insert(this.vertices[i * 2 + 1], [i])
        currentSection = section
      }
    }

    if (pieceIndices.length) { // check if we have leftovers, we reconnect it to the beginning
      if (this.sections[section]) { // the area is large enough to encompass multiple sections so we are back at the beginning
        this.sections[section][0].indices = pieceIndices.join(this.sections[section][0].indices)
        this._closeSections()
        // this._addInnerSquares()
      } else { // small enough that this is the only data
        this.sections[section] = [{
          indices: pieceIndices,
          yTree: pieceYTree
        }]
      }
    }
  }

  _createIntersections (index1: number, index2: number): [number, number] {
    // work our way from one sector the other, adding sections as we go
    let p1 = [this.vertices[index1 * 2], this.vertices[index1 * 2 + 1]]
    let p2 = [this.vertices[index2 * 2], this.vertices[index2 * 2 + 1]]
    let p1XSection = this.getXSection(p1[0])
    let p1YSection = this.getYSection(p1[1])
    let p2XSection = this.getXSection(p2[0])
    let p2YSection = this.getYSection(p2[1])

    let points = []

    // get the bounding box of sections
    let top, bottom, left, right
    if (p2YSection > p1YSection) {
      top = p2YSection
      bottom = p1YSection
    } else {
      top = p1YSection
      bottom = p2YSection
    }
    if (p2XSection < p1XSection) {
      left = p2XSection
      right = p1XSection
    } else {
      left = p1XSection
      right = p2XSection
    }

    // iterate through each section and find the intersection of that line
    // top to bottom
    for (let j = bottom + 1; j <= top; j++) {
      let sectionY = this.getSectionY(j)
      let intersect = lineIntersect(p1, p2, [-180, sectionY], [180, sectionY])
      points.push([intersect[0], sectionY])
    }
    // left to right
    for (let i = left + 1; i <= right; i++) {
      let sectionX = this.getSectionX(i)
      let intersect = lineIntersect(p1, p2, [sectionX, -90], [sectionX, 90])
      points.push([sectionX, intersect[1]])
    }

    // organize by closest to the initial point (to maintain counter-clockwise) TODO: improve
    points = points.sort((a, b) => {
      return Math.sqrt(Math.pow(p1[0] - a[0], 2) + Math.pow(p1[1] - a[1], 2)) - Math.sqrt(Math.pow(p1[0] - b[0], 2) + Math.pow(p1[1] - b[1], 2))
    })

    // save the new vertices and convert track the point indices
    let pointsIndices = []
    let pl = points.length - 1
    for (let i = 0, pfl = pl + 1; i < pfl; i++) {
      let index = this._saveNewVertices(points[i])
      pointsIndices.push(index)
    }

    // create/add the middle sections
    for (let i = 0; i < pl; i++) {
      // We are interested in saving the line in the "lower" x or y section
      let section
      p1XSection = this.getXSection(points[i][0])
      p1YSection = this.getYSection(points[i][1])
      p2XSection = this.getXSection(points[i + 1][0])
      p2YSection = this.getYSection(points[i + 1][1])
      if (p1XSection < p2XSection) {
        section = p1XSection + '_'
      } else {
        section = p2XSection + '_'
      }
      if (p1YSection < p2YSection) {
        section += p1YSection
      } else {
        section += p2YSection
      }
      // save the points to the section
      let yTree = new RBT(points[i][1], [pointsIndices[i]])
      yTree.insert(points[i + 1][1], [pointsIndices[i + 1]])
      let piece = {
        indices: new LinkedList([pointsIndices[i], pointsIndices[i + 1]]),
        yTree
      }
      if (this.sections[section]) {
        this.sections[section].push(piece)
      } else {
        this.sections[section] = [piece]
      }
    }

    // return the first and last point
    return [pointsIndices[0], pointsIndices[pl]]
  }

  _saveNewVertices (point: Point): number { // return the index
    let index = this.vertices.length / 2 // the length is always 1 greater than the lookup
    this.vertices.push(point[0], point[1])
    return index
  }

  _closeSections () {
    for (let section in this.sections) {
      for (let s = 0; s < this.sections[section].length; s++) {
        let currentSection = this.sections[section]
        let piece = currentSection[s]
        let poly = piece.indices
        const first = [this.vertices[poly.start.index * 2], this.vertices[poly.start.index * 2 + 1]]
        let last = [this.vertices[poly.end.index * 2], this.vertices[poly.end.index * 2 + 1]]
        const sectionBounds = this.getSectionBounds(section)
        // Wall: left -> 0, bottom -> 1, right -> 2, and top -> 3 (coexists with section bounds)
        let wall = getWall(last, sectionBounds)

        // add all the starting points to check against
        let startPoints = [{ point: first, pieceIndex: 0 }]
        for (let sp = 1, sl = currentSection.length; sp < sl; sp++) {
          let index = currentSection[sp].indices.start.index
          startPoints.push({ point: [this.vertices[index * 2], this.vertices[index * 2 + 1]], pieceIndex: sp })
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
          let index = this._saveNewVertices(last)
          poly.push(index)
          piece.yTree.insert(last[1], [index])
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

        // if first, than we only need to close the poly and move on, otherwise, join the two pieces and cleanup
        if (endPoint.pieceIndex === 0) {
          // close loop
          poly.end.next = poly.start
          poly.start.prev = poly.end
        } else {
          let endSectionPiece = currentSection[endPoint.pieceIndex]
          poly.join(endSectionPiece.indices)
          // Merge the smaller tree with the bigger one
          if (piece.yTree.size >= endSectionPiece.yTree.size) {
            piece.yTree.mergeTree(endSectionPiece.yTree)
          } else {
            endSectionPiece.yTree.mergeTree(piece.yTree)
            piece.yTree = endSectionPiece.yTree
          }
          currentSection.splice(endPoint.pieceIndex, 1)
          s--
        }
      }
    }
  }

  _addInnerRectangles () {
    const sectionDepth = {}
    // organize the sections as lon->lat
    for (let section in this.sections) {
      let xY = section.split('_').map(x => parseInt(x))
      if (sectionDepth[xY[0]]) {
        sectionDepth[xY[0]].push(xY[1])
      } else {
        sectionDepth[xY[0]] = [xY[1]]
      }
    }
    for (let lon in sectionDepth) {
      let lats = sectionDepth[lon].sort((a, b) => { return a - b })
      for (let i = lats[0], ll = lats[lats.length - 1]; i < ll; i++) {
        let id = lon + '_' + i
        if (!this.sections[id]) {
          let bounds = this.getSectionBounds(id)
          let index = this._saveNewVertices([bounds[0], bounds[1]])
          let index2 = this._saveNewVertices([bounds[0], bounds[3]])
          let index3 = this._saveNewVertices([bounds[2], bounds[3]])
          let index4 = this._saveNewVertices([bounds[2], bounds[1]])
          let indices = new LinkedList([index, index2, index3, index4])
          indices.close()
          let yTree = new RBT(bounds[1], [index])
          yTree.insert(bounds[3], [index2])
          yTree.insert(bounds[3], [index3])
          yTree.insert(bounds[1], [index4])
          this.sections[id] = {
            indices,
            yTree
          }
        }
      }
    }
  }

  _createTriangles () {

  }

  getYSection (y: number): number { // default is degree
    return Math.floor(this.divisionCount / 180 * y + (this.divisionCount / 2))
  }

  getXSection (x: number): number { // default is degree
    return Math.floor((this.divisionCount * 2) / 360 * x + ((this.divisionCount * 2) / 2))
  }

  getSectionY (section: number): number { // default is degree
    return -90 + 180 / this.divisionCount * section
  }

  getSectionX (section: number): number { // default is degree
    return -180 + 360 / (this.divisionCount * 2) * section
  }

  getSectionBounds (input: string): [number, number, number, number] {
    let sections = input.split('_').map(x => parseInt(x))

    return [
      this.getSectionX(sections[0]),
      this.getSectionY(sections[1]),
      this.getSectionX(sections[0] + 1),
      this.getSectionY(sections[1] + 1)
    ]
  }

  addVertices (vertices: Array<number>) {
    this.vertices = vertices
  }

  addPolygonFeature (feature: Feature) {
    let coords = []
    let type = feature.geometry.type
    if (type === 'Polygon') {
      coords = feature.geometry.coordinates[0]
    }
    if (type === 'MultiPolygon') {
      feature.geometry.coordinates[0].forEach(poly => {
        coords = coords.concat(poly)
      })
    }

    this.vertices = [].concat(...coords)
  }
}

function lineIntersect (p1: Point, p2: Point, p3: Point, p4: Point): Point {
  let denom = (p4[1] - p3[1]) * (p2[0] - p1[0]) - (p4[0] - p3[0]) * (p2[1] - p1[1])
  // if (denom === 0) { return [] } NOTE: This can not happen with our algorithm
  let ua = ((p4[0] - p3[0]) * (p1[1] - p3[1]) - (p4[1] - p3[1]) * (p1[0] - p3[0])) / denom

  return [p1[0] + ua * (p2[0] - p1[0]), p1[1] + ua * (p2[1] - p1[1])]
}

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
