/**
 * @description Stores a collection of buffers as a linked list.
 */
class BufferLinkedList {
  constructor() {
    this.reset();

    this._bufferFunction =
      typeof module !== "undefined" && module.exports
        ? (length) => Buffer.allocUnsafe(length)
        : (length) => new Uint8Array(length);
  }

  /**
   * @description Resets all internal state
   */
  reset() {
    this._head = new Node();
    this._tail = this._head;
    this._totalBytes = 0;
    this._currentLength = 0;
    this._buffers = 0;
  }

  /**
   * @type {number} Length of all stored data in bytes
   */
  get length() {
    return this._totalBytes;
  }

  /**
   * @type {Uint8Array} Returns all stored data
   */
  get readAll() {
    let current = this._head;
    let offset = 0;
    this._trimTail();
    const returnBuffer = this._newBuffer(this._totalBytes);

    do {
      returnBuffer.set(current.value, offset);
      offset += current.value.length;
      current = current.next;
    } while (current);

    return returnBuffer;
  }

  /**
   * @description Adds a new buffer using Buffer.allocUnsafe
   * @param {number} length Bytes to allocate for the buffer
   */
  addBuffer(length) {
    if (this._head.value) {
      this._trimTail();
      this._addNode();
    }
    this._tail.value = this._newBuffer(length);
  }

  /**
   * @description Appends data to the currently allocated buffer
   * @param {Uint8Array} data Data to append
   */
  append(data) {
    this._tail.value.set(data, this._currentLength);
    this._currentLength += data.length;
    this._totalBytes += data.length;
  }

  _addNode() {
    this._tail.next = new Node();
    this._tail = this._tail.next;
    this._currentLength = 0;
  }

  _trimTail() {
    this._tail.value = this._tail.value.subarray(0, this._currentLength);
  }

  _newBuffer(length) {
    return this._bufferFunction(length);
  }
}

class Node {
  get next() {
    return this._next;
  }

  set next(node) {
    this._next = node;
  }

  get value() {
    return this._value;
  }

  set value(value) {
    this._value = value;
  }
}

module.exports = BufferLinkedList;
