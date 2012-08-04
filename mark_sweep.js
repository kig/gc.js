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

MarkSweep.prototype.expandHeapBy = function(size) {
    while (size > 0) {
	size -= this.heapSegmentSize;
	this.heapSize += this.heapSegmentSize;
    }
    var newHeap = new Int32Array(this.heapSize);
    newHeap.set(this.heap);
    this.heap = newHeap;
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

MarkSweep.prototype.markPointers = function(start, length) {
    for (var last=start+length; start < last; start++) {
	var v = this.heap[start];
	if (this.isPointer(v)) {
	    var a = this.allocationIndex[v];
	    if (a !== undefined) {
		a.marked = true;
	    }
	}
    }
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

MarkSweep.prototype.unmarkAllocations = function() {
    for (var i=0, l=this.allocationArray.length; i<l; i++) {
	this.allocationArray[i].marked = false;
    }
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

MarkSweep.prototype.gc = function() {
    this.mark();
    this.sweep();
};

MarkSweep.prototype.mark = function() {
    var i,l,v,j,k,seg,a;
    this.unmarkAllocations();
    var all = this.allocationArray;
    for (i=0, l=all.length; i<l; i++) {
	a = all[i];
	this.markPointers(a.start, a.length);
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


