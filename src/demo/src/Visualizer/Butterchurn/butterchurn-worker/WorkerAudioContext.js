// implements the BaseAudioContext interfaces to mimic having AudioContext available in a web worker
/* eslint-disable */

export const fftData = new Map();

const references = new Map();
let referenceId = -1;

const addReference = (obj) => {
  references.set(++referenceId, obj);
  return referenceId;
};

class WorkerAudioNode {
  constructor() {}

  connect(destination) {
    self.postMessage({
      operation: "connect",
      thisRef: this.ref,
      argRef: destination.ref,
    });
  }
}

export class WorkerSourceNode extends WorkerAudioNode {
  constructor() {
    super();
    this.ref = addReference(this);
  }
}

class WorkerDelayNode extends WorkerAudioNode {
  constructor() {
    super();
    this.ref = addReference(this);
  }
}

class WorkerAnalyserNode extends WorkerAudioNode {
  constructor() {
    super();
    this.ref = addReference(this);
  }

  set fftSize(fftSize) {
    this._fftSize = fftSize;
    self.postMessage({
      operation: "fftSize",
      thisRef: this.ref,
      argSet: fftSize,
    });
  }

  set smoothingTimeConstant(smoothingTimeConstant) {
    self.postMessage({
      operation: "smoothingTimeConstant",
      thisRef: this.ref,
      argSet: smoothingTimeConstant,
    });
  }

  get fftSize() {
    return this._fftSize;
  }

  getByteTimeDomainData(uint8Array) {
    const previousData = fftData.get(this.ref);

    if (previousData) {
      uint8Array.set(previousData);
    }

    self.postMessage({
      operation: "getByteTimeDomainData",
      thisRef: this.ref,
      args: uint8Array.length,
    });
  }
}

class WorkerChannelSplitterNode extends WorkerAudioNode {
  constructor() {
    super();
    this.ref = addReference(this);
  }
}

export class WorkerAudioContext {
  constructor() {
    this.ref = addReference(this);
  }

  createDelay() {
    const delayNode = new WorkerDelayNode();

    self.postMessage({
      operation: "createDelay",
      thisRef: this.ref,
      thatRef: delayNode.ref,
      args: [],
    });
    return delayNode;
  }

  createAnalyser() {
    const analyser = new WorkerAnalyserNode();

    self.postMessage({
      operation: "createAnalyser",
      thisRef: this.ref,
      thatRef: analyser.ref,
      args: [],
    });
    return analyser;
  }

  createChannelSplitter(numberOfOutputs) {
    const channelSplitterNode = new WorkerChannelSplitterNode();

    self.postMessage({
      operation: "createChannelSplitter",
      args: [numberOfOutputs],
      thisRef: this.ref,
      thatRef: channelSplitterNode.ref,
    });
    return channelSplitterNode;
  }
}
