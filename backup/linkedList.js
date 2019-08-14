// @flow

export type Index = {
  index: number,
  next?: Index,
  prev?: Index
}

export default class LinkedList {
  start: Index
  end: Index
  length: number = 0
  constructor (index: number | Array<number>) {
    const self = this
    if (Array.isArray(index)) {
      this.start = this.end = { index: index.shift() }
      index.forEach(i => { self.push(i) })
    } else {
      this.start = this.end = { index }
    }
    this.length++
  }

  push (index: number): Index {
    const newIndex = { index, prev: this.end }
    this.end.next = newIndex
    this.end = newIndex
    this.length++

    return this.end
  }

  join (ll: LinkedList): LinkedList {
    this.end.next = ll.start // join the end of the current linked list with the new one
    this.end = ll.end
    this.length += ll.length
    return this
  }

  close () {
    this.end.next = this.start
    this.start.prev = this.end
  }

  collapse (): Array<number> {
    let res = []
    let curr = this.start
    do {
      res.push(curr.index)
      curr = curr.next
    } while (curr && curr !== this.start)

    return res
  }
}
