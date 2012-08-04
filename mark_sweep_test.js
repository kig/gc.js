MSTest = function() {};

MSTest.prototype.run = function() {
    this.init();
    for (var n in this) {
	if (/^test/.test(n)) {
	    console.log(n);
	    this.setup();
	    this[n]();
	    this.teardown();
	}
    }
    this.end();
    console.log("Done");
};

MSTest.prototype.init = function() {};

MSTest.prototype.end = function() {};

MSTest.prototype.setup = function() {
    this.ms = new MarkSweep();
};

MSTest.prototype.teardown = function() {};

assertEqual = function(a, b, msg) {
    if (a != b) throw("assertEqual: "+a+" != "+b+". "+msg);
};

MSTest.prototype.test_allocation = function() {
    var ms = this.ms;
    var a = ms.allocate(1);
    assertEqual(a.length, 1);
    assertEqual(a.start, 0);
    var b = ms.allocate(1);
    assertEqual(b.length, 1);
    assertEqual(b.start, 1);
};

MSTest.prototype.test_gc = function() {
    var ms = this.ms;
    var a = ms.allocate(1);
    assertEqual(1, ms.heapUsage);
    assertEqual(a, ms.allocationArray[0]);
    ms.gc();
    assertEqual(0, ms.heapUsage);
    assertEqual(0, ms.allocationArray.length);
};

MSTest.prototype.test_gc_preserves_marked = function() {
    var ms = this.ms;
    var a = ms.allocate(1);
    var b = ms.allocate(1);
    assertEqual(2, ms.allocationArray.length);
    ms.setPtr(a.start, b.start);
    ms.gc();
    assertEqual(a.marked, false, 'a marked');
    assertEqual(b.marked, true, 'b marked');
    assertEqual(1, ms.allocationArray.length);
    assertEqual(b, ms.allocationArray[0]);
    ms.gc();
    assertEqual(0, ms.allocationArray.length);
};

MSTest.prototype.test_allocation_and_gc = function() {
    var ms = this.ms;
    var total = 0;
    var allocs = [];
    for (var i=0; i<200; i++) {
	allocs.push(ms.allocate(i+1));
	total += i+1;
    }
    assertEqual(allocs.reduce(function(s,i){ return s+i.length; }, 0), total);
    assertEqual(total, ms.heapUsage);
    ms.gc();
    assertEqual(0, ms.heapUsage);
};

MSTest.prototype.test_gc_keeps_refs = function() {
    var ms = this.ms;
    var a,i=0;
    var total = 101;
    var mtotal = total;
    var allocs = [];
    var ptrs = ms.allocate(101);
    ms.setPtr(ptrs.start, ptrs.start);
    for (i=0; i<200; i++) {
	allocs.push(ms.allocate(1));
	total++;
    }
    for (i=0; i<100; i++) {
	a = allocs[i];
	ms.setPtr(ptrs.start+i+1, a.start);
	ms.setPtr(a.start, allocs[i+100].start);
	mtotal++;
    }
    assertEqual(total, ms.heapUsage);
    ms.mark();
    assertEqual(ptrs.marked, true, 'root marked');
    for (i=0; i<allocs.length; i++) {
	assertEqual(ptrs.marked, true);
    }
    ms.gc();
    assertEqual(total, ms.heapUsage);
    for (i=0; i<100; i++) {
	a = allocs[i];
	ms.setWord(a.start, 0);
    }
    ms.gc();
    assertEqual(mtotal, ms.heapUsage);
    ms.setWord(ptrs.start, 0);
    ms.gc();
    ms.gc();
    assertEqual(0, ms.heapUsage);
};