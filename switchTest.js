const divisionCount = 16
const EXTENT = 4096

function getSsection (s) {
  return Math.floor(divisionCount / EXTENT * s + (divisionCount / EXTENT))
}

function getSectionS (section) {
  return EXTENT / divisionCount * section
}


let section = getSectionS(-4)
console.log(section)
console.log(getSsection(section))
