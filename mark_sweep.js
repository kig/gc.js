Allocation = function(start, length) {
    this.start = start;
    this.length = length;
    this.marked = false;
};

MarkSweep = function(heapSize, heapSegmentSize) {
    this.heapSize = heapSize || 262138;
    this.heap = new Int32Array(this.heapSize);
    this.heapSegmentSize = heapSegmentSize || 262138;
    this.heapUsage = 0;
    this.heapPtr = 0;
    this.allocationCount = 0;
    this.allocationIndex = {};
    this.allocationArray = [];
};

MarkSweep.prototype.allocate = function(size) {
    var ptr = this.heapPtr;
    this.heapPtr += size;
    if (this.heapPtr > this.heapSize) {
	this.expandHeapBy(size);
    }
    return this.addAllocation(ptr, size);
};

MarkSweep.prototype.isPointer = function(v) {
    return ((v & 0x80000000) != 0);
};

MarkSweep.prototype.expandHeapBy = function(size) {
    while (size > 0) {
	size -= this.heapSegmentSize;
	this.heapSize += this.heapSegmentSize;
    }
    var newHeap = new Int32Array(this.heapSize);
    newHeap.set(this.heap);
    this.heap = newHeap;
};

MarkSweep.prototype.compact = function() {
    var sz = this.heapSegmentSize * Math.ceil(this.heapUsage / this.heapSegmentSize);
    var newHeap = new Int32Array(sz);
    var ai = {};
    var off = 0;
    for (var i=0; i<this.allocationArray.length; i++) {
	var a = this.allocationArray[i];
	for (var j=0; j<a.length; j++) {
	    newHeap[off+j] = this.heap[a.start+j];
	}
	a.start = off;
	off += a.length;
	ai[a.start | 0x80000000] = a;
    }
    this.allocationIndex = ai;
    this.heapPtr = off;
    this.heap = newHeap;
    this.heapSize = sz;
};

MarkSweep.prototype.findFreeSpace = function(size) {
    var all = this.allocationArray;
    var prevEnd = 0;
    for (var i=0; i<all.length; i++) {
	var a = all[i];
	if (a.start - prevEnd >= size) {
	    return prevEnd;
	}
	prevEnd = a.start + a.length;
    }
    if (this.heapSize - prevEnd >= size) {
	return prevEnd;
    }
    return -1;
};

MarkSweep.prototype.addAllocation = function(start, length) {
    var a = new Allocation(start, length);
    this.allocationArray.push(a);
    this.allocationIndex[start | 0x80000000] = a;
    this.heapUsage += length;
    this.allocationCount++;
    return a;
};

MarkSweep.prototype.deleteAllocation = function(a) {
    delete this.allocationIndex[a.start | 0x80000000];
    this.allocationCount--;
    this.heapUsage -= a.length;
    a.length = 0;
};

MarkSweep.prototype.setPtr = function(offset, value) {
    this.heap[offset] = value | 0x80000000;
};

MarkSweep.prototype.setWord = function(offset, value) {
    this.heap[offset] = value;
};

MarkSweep.prototype.getWord = function(offset) {
    return this.heap[offset];
};

MarkSweep.prototype.markPointers = function(start, length, rootSet) {
    for (var last=start+length, i=start; i < last; i++) {
	var v = this.heap[i];
	if (this.isPointer(v) && v != (i | 0x80000000)) { // pointer but not to self
	    var a = this.allocationIndex[v];
	    if (a !== undefined && !a.marked) {
		rootSet.push(a);
		a.marked = true;
	    }
	}
    }
};

MarkSweep.prototype.unmarkAllocations = function() {
    for (var i=0, l=this.allocationArray.length; i<l; i++) {
	this.allocationArray[i].marked = false;
    }
};

MarkSweep.prototype.cleanUpAllocationArray = function() {
    var i, a, l;
    var all = this.allocationArray;
    var aa = [];
    for (i=0, l=all.length; i<l; i++) {
	a = all[i];
	if (a.length > 0) { // clean up deleted allocations
	    aa.push(a);
	}
    }
    this.allocationArray = aa;
};

MarkSweep.prototype.gc = function(rootSet) {
    this.mark(rootSet);
    this.sweep();
    if (this.heapUsage < this.heapSize/2 && (this.heapSize > this.heapSegmentSize || this.heapSize == 0)) {
	this.compact();
    }
};

MarkSweep.prototype.mark = function(rootSet) {
    var i,a;
    this.unmarkAllocations();
    for (i=0; i<rootSet.length; i++) {
	a = rootSet[i];
	a.marked = true;
    }
    for (i=0; i<rootSet.length; i++) {
	a = rootSet[i];
	this.markPointers(a.start, a.length, rootSet);
    }
};

MarkSweep.prototype.sweep = function() {
    var i, a, l;
    var all = this.allocationArray;
    for (i=0, l=all.length; i<l; i++) {
	a = all[i];
	if (!a.marked) {
	    this.deleteAllocation(a);
	}
    }
    if (this.allocationCount < this.allocationArray.length/2) {
	this.cleanUpAllocationArray();
    }
};


