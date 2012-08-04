HeapNode = function(size) {
    this.size = size;
    this.data = new Uint32Array(size);
    this.useCount = 0;
};

Allocation = function(start, length) {
    this.start = start;
    this.length = length;
    this.marked = false;
};

MarkSweep = function(heapSize, heapSegmentSize) {
    this.heapSegmentSize = heapSegmentSize || 262138;
    this.heap = [];
    this.heapSize = 0;
    this.expandHeapBy(heapSize || this.heapSegmentSize);
    this.allocationIndex = {};
    this.allocationArray = [];
};

MarkSweep.prototype.expandHeapBy = function(size) {
    while (size > 0) {
	this.heap.push(new HeapNode(this.heapSegmentSize));
	size -= this.heapSegmentSize;
	this.heapSize += this.heapSegmentSize;
    }
};

MarkSweep.prototype.findFreeSpace = function(size) {
    var all = this.allocationArray;
    var prevEnd = 0;
    for (var i=0; i<all.length; i++) {
	var a = all[i];
	if (a.start - prevEnd < size) {
	    return prevEnd;
	}
	prevEnd = a.start + a.length;
    }
    if (this.heapSize - prevEnd < size) {
	return prevEnd;
    }
    return -1;
};

MarkSweep.prototype.cmp = function(a,b) {
    return b.start - a.start;
};

MarkSweep.prototype.addAllocation = function(start, length) {
    var a = new Allocation(start, length);
    this.allocationArray.push(a);
    this.allocationArray.sort(this.cmp);
    this.allocationIndex[start] = a;
    this.modifyHeapNodeUseCount(a.start, a.length, +1);
};

MarkSweep.prototype.deleteAllocation = function(a) {
    this.allocationArray.splice(this.allocationArray.indexOf(a), 1);
    delete this.allocationIndex[a.start];
    this.modifyHeapNodeUseCount(a.start, a.length, -1);
};

MarkSweep.prototype.modifyHeapNodeUseCount = function(start, length, mod) {
    var first = 0 | (start/this.heapSegmentSize);
    var last = 0 | ((start+length)/this.heapSegmentSize);
    for (; first <= last; first++) {
	this.heapNodes[first].useCount += mod;
    }
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
    this.addAllocation(ptr, size);
    return ptr;
};

MarkSweep.prototype.mark = function() {
    var i,l,v,j,k,seg;
    this.unmarkAllocations();
    var heap = this.heap;
    for (i=0, l=heap.length; i<l; i++) {
	seg = heap[i];
	for (j=0, k=seg.length; j<k; j++) {
	    v = seg[i];
	    var a = this.allocationIndex[v];
	    if (a !== undefined) {
		a.marked = true;
	    }
	}
    }
};

MarkSweep.prototype.sweep = function() {
    var i, a, l;
    var all = this.allocationArray;
    var freed = [];
    for (i=0, l=all.length; i<l; i++) {
	a = all[i];
	if (a.marked) {
	    freed.push(a);
	}
    }
    for (i=0, l=freed.length; i<l; i++) {
	this.deleteAllocation(freed[i]);
    }
};

MarkSweep.prototype.compact = function() {
    for (var i=0; i<this.heap.length; i++) {
	if (this.heap[i].useCount == 0) {
	    this.heap.splice(i,1);
	    i--;
	}
    }
};

