// @flow
import type { Index } from './linkedList'

class Node {
  key: number
  value: Array<Index>
  red: boolean = true
  left: Node
  right: Node
  p: Node // parent
  constructor (sentinel?: Node, key?: number, value?: Array<Index>) {
    if (key) this.key = key
    if (value) this.value = value
    if (sentinel) {
      this.left = sentinel
      this.right = sentinel
    }
  }
}

export default class RBT {
  root: Node
  sentinel: Node
  size: number = 0
  constructor (key?: number, value?: Array<Index>) {
    this.sentinel = new Node()
    this.sentinel.red = false
    if (key && value) this.insert(key, value)
  }
  // O(n) <- recursive
  inorderWalk (cb: Function) {
    this._inorderWalk(this.root, cb)
  }
  _inorderWalk (node: Node, cb: Function) {
    if (node && node !== this.sentinel) {
      cb(node)
      this._inorderWalk(node.left, cb)
      this._inorderWalk(node.right, cb)
    }
  }

  // O(log(n) * log(h)) worst case n <- number of stored nodes ; h <- tree height
  getValuesFromRange (lo: number, hi: number): Array<Index> {
    let res = []
    let node = this.find(lo)
    if (node) node = this.getSuccessor(node)
    while (node && node.key !== hi) {
      res = res.concat(node.value)
      node = this.getSuccessor(node)
    }

    return res
  }

  // O(log(n)) worst case n <- number of stored nodes
  find (key: number, node?: Node = this.root): null | Node {
    while (node && key !== node.key) {
      if (key < node.key) node = node.left
      else node = node.right
    }

    return node
  }

  // O(log(n)) worst case n <- number of stored nodes
  get (key: number, node?: Node = this.root): null | Array<Index> {
    while (node && key !== node.key) {
      if (key < node.key) node = node.left
      else node = node.right
    }

    return node.value
  }

  // O(h) worst case, h <- tree height
  getSuccessor (node: Node): null | Node {
    if (node.right.key) return this.getMinimum(node.right)

    let p = node.p
    while (p && node === p.right) {
      node = p
      p = p.p
    }

    return p
  }

  // O(h) worst case, h <- tree height
  getMinimum (node?: Node = this.root): Node {
    while (node.left !== this.sentinel) { node = node.left }
    return node
  }

  // O(n) n <- number of stored nodes
  mergeTree (tree: RBT) {
    const self = this
    tree.inorderWalk((node: Node) => {
      if (node.key) self.insert(node.key, node.value)
    })
  }

  // O(log n)
  insert (key: number, value: Array<Index>) {
    let node
    let y = this.sentinel
    let x = this.root
    while (x && x !== this.sentinel) {
      y = x
      if (key === y.key) break
      if (key < x.key) x = x.left
      else x = x.right
    }

    if (key === y.key) {
      node = y
      node.value = node.value.concat(value)
    } else {
      node = new Node(this.sentinel, key, value)
      node.p = y

      if (y === this.sentinel) this.root = node
      else if (key < y.key) y.left = node
      else y.right = node

      this._insertFixup(node)
    }
    this.size++

    return node
  }

  // O(1)
  _insertFixup (node: Node) {
    while (node.p && node.p.p && node.p.red) {
      if (node.p === node.p.p.left) {
        const uncle = node.p.p.right
        if (uncle.red) {
          node.p.red = false
          uncle.red = false
          node = node.p.p
          node.red = true
        } else {
          if (node === node.p.right) {
            node = node.p
            this._leftRotate(node)
          }
          node.p.red = false
          node.p.p.red = true
          this._rightRotate(node.p.p)
        }
      } else if (node.p === node.p.p.right) {
        const uncle = node.p.p.left
        if (uncle.red) {
          node.p.red = false
          uncle.red = false
          node = node.p.p
          node.red = true
        } else {
          if (node === node.p.left) {
            node = node.p
            this._rightRotate(node)
          }
          node.p.red = false
          node.p.p.red = true
          this._leftRotate(node.p.p)
        }
      }
      // this.root = node.p // make sure the parent is updated as well as we iterate
    }
    this.root.red = false
  }

  // O(1)
  _leftRotate (node: Node) {
    const y = node.right
    node.right = y.left
    if (y.left !== this.sentinel) y.left.p = node
    y.p = node.p
    if (node.p === this.sentinel) this.root = y // defining the parents new child. if no parent, x was the root
    else if (node === node.p.left) node.p.left = y // if x was the left child
    else node.p.right = y // else x was the right child
    y.left = node
    node.p = y
  }

  // O(1)
  _rightRotate (node: Node) {
    const y = node.left
    node.left = y.right
    if (y.right !== this.sentinel) y.right.p = node
    y.p = node.p
    if (node.p === this.sentinel) this.root = y // defining the parents new child. if no parent, x was the root
    else if (node === node.p.right) node.p.right = y // if x was the right child
    else node.p.left = y // else x was the right child
    y.right = node
    node.p = y
  }
}
