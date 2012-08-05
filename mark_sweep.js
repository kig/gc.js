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
    this.allocationIndex = {};
    this.allocationArray = [];
};

MarkSweep.prototype.allocate = function(size) {
    var ptr = this.findFreeSpace(size);
    if (ptr < 0) {
	this.expandHeapBy(size);
	ptr = this.findFreeSpace(size);
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
    this.allocationIndex = {};
    var off = 0;
    for (var i=0; i<this.allocationArray.length; i++) {
	var a = this.allocationArray[i];
	for (var j=0; j<a.length; j++) {
	    newHeap[off+j] = this.heap[a.start+j];
	}
	a.start = off;
	off += a.length;
	this.allocationIndex[a.start | 0x80000000] = a;
    }
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

MarkSweep.prototype.cmp = function(a,b) {
    return a.start - b.start;
};

MarkSweep.prototype.addAllocation = function(start, length) {
    var a = new Allocation(start, length);
    this.allocationArray.push(a);
    this.allocationArray.sort(this.cmp);
    this.allocationIndex[start | 0x80000000] = a;
    this.heapUsage += length;
    return a;
};

MarkSweep.prototype.deleteAllocation = function(a) {
    var idx = this.allocationArray.indexOf(a);
    if (idx == -1) {
	return;
    }
    this.allocationArray.splice(idx, 1);
    delete this.allocationIndex[a.start | 0x80000000];
    this.heapUsage -= a.length;
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
    var freed = [];
    for (i=0, l=all.length; i<l; i++) {
	a = all[i];
	if (!a.marked) {
	    freed.push(a);
	}
    }
    for (i=0, l=freed.length; i<l; i++) {
	this.deleteAllocation(freed[i]);
    }
};


