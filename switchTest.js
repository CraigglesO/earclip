const divisionCount = 16
const EXTENT = 4096

function getSsection (s) {
  return Math.floor(divisionCount / EXTENT * s)
}

function getSectionS (section) {
  return EXTENT / divisionCount * section
}

// POINT 189 [ 2181, 3071 ]
const section = getSsection(3071)
console.log(section)
console.log(getSectionS(section))


// function getSsection (s) {
//   return Math.floor(16 / 4096 * s + (16 / 4096))
// }
