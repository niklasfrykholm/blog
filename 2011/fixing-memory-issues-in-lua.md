# Fixing memory issues in Lua

Garbage collection can be both a blessing and a curse. On the one hand, it frees you from manually managing memory. This saves development time, reduces bugs, and avoids tricky decisions about objects' ownerships and lifetimes.

On the other hand, when you do run into memory issues (and you most likely will), they can be a lot harder to diagnose and fix, because you don't have detailed control over how memory is allocated and freed.

In this post I'll show some techniques that you can use to address memory issues in Lua (and by extension, in other garbage collected languages).

All Lua memory issues essentially boil down to one of two things:

**Lua uses too much memory**

> On consoles memory is a precious resource and sometimes Lua is just using too much of it. The root cause can either be memory leaks or badly constructed/bloated data structures.

**Garbage collection is taking too long**

> Too much garbage collection is (not surprisingly) caused by having too much garbage. The code must be rewritten so that it generates less garbage.

Let's look at each issue in turn and see how we can address it.

## Lua uses too much memory

The first step towards plugging leaks and reducing memory use is to find out where the memory is going. Once we know that, the problems are usually quite easy to fix.

So how do we find out where the memory is going? One way would be to add tracing code to the `lua_Alloc()` function, but actually there is a much simpler method that doesn't require any C code and is more in line with Lua's dynamic nature. We can just use Lua to count all the objects in the runtime image:

```lua
function count_all(f)
	local seen = {}
	local count_table
	count_table = function(t)
		if seen[t] then return end
		f(t)
		seen[t] = true
		for k,v in pairs(t) do
			if type(v) == "table" then
				count_table(v)
			elseif type(v) == "userdata" then
				f(v)
			end
		end
	end
	count_table(_G)
end
```

Here we just start with the global table *_G* and recursively enumerate all subtables and userdata. For each object that we haven't seen before, we call the enumeration function *f*. This will enumerate all the objects in the Lua runtime that can be reached from *_G*. Depending on how you use Lua you may also want to add some code for enumerating objects stored in the registry, and recurse over metatables and function upvalues to make sure that you really count all the objects in the runtime.

Once you have a function for enumerating all your Lua objects, there are lots of useful things you can do. When it comes to plugging leaks and reducing memory usage I find one of the most useful things is to count the number of objects of each type:

```lua
function type_count()
	local counts = {}
	local enumerate = function (o)
		local t = type_name(o)
		counts[t] = (counts[t] or 0) + 1
	end
	count_all(enumerate)
	return counts
end
```

Here `type_name()` is a function that returns the name of an object's type. This function will depend on what kind of class/object system you use in your Lua runtime. One common approach is to have global class objects that also act as metatables for objects:

```lua
-- A class
Car = {}
Car.__index = Car

-- A method
function Car.honk(self)
	print "toot"
end

-- An object
local my_car = {}
setmetatable(my_car, Car)
```

In this case, the `type_name()` function could look something like this:

```
global_type_table = nil
function type_name(o)
	if global_type_table == nil then
		global_type_table = {}
		for k,v in pairs(_G) do
			global_type_table[v] = k
		end
		global_type_table[0] = "table"
	end
	return global_type_table[getmetatable(o) or 0] or "Unknown"
end
```

The object count usually gives you a good idea of where your memory problems lie. For example, if the number of *AiPathNode* objects constantly rises, you can conclude that you are somehow leaking those objects. If you have 200 000 *GridCell* objects you should write a smarter grid implementation.

You can also use this enumeration technique to pinpoint problems further if necessary. For example, if you are hunting for leaks, you can rewrite the count_all() function so that it keeps track of the sub keys where an object were found. In this way, you might see that the *AiPathNode* objects can be accessed through paths like:

```lua
_G.managers.ai_managers.active_paths[2027]
```

Then you know that the source of the leak is that paths never get removed from the active_paths table.

## Garbage collection is taking too long

Garbage collection is a very cache unfriendly task that can have a significant performance impact. This is especially frustrating since garbage collection doesn't really do anything. Well, it lets your gameplay programmers work faster and with fewer bugs, but when you have reached the optimization phase you tend to forget about that and just swear at the slow collector.

Lua's default garbage collection scheme is not adapted for realtime software and if you just run it straight up you will get lots of disturbing frame rate hitches. As has already been mentioned in previous #AltDevBlogADay articles, it is better to use a step size of 0 and just run the garbage collector for a certain number of milliseconds every frame:

```cpp
OpaqueTimeValue start = time();
while (milliseconds_elapsed_since(start) < milliseconds_to_run)
	lua_gc(L, LUA_GCSTEP, 0);
```

Note that you can run this garbage collection on any thread, as long as Lua is not running at the same time, so you might be able to offset some of the cost by running the garbage collection on a background thread while your main thread is doing something non-Lua related.

How much time should you spend on garbage collection? A tricky question. If you spend too little, the garbage will grow and you will eventually run out of memory. If you spend too much, you are wasting precious milliseconds.

My preferred solution is to use a feedback mechanism. I dynamically adjust the garbage collection time so that the amount of garbage always stays below 10 % of the total Lua memory. If the garbage goes above that, I increase the collection time. If the garbage goes below, I decrease the collection time. As with all feedback mechanisms is a good idea to plot the curves for memory use and garbage collection time as you tweak the feedback parameters. That way you can verify that the system behaves nicely and that the curves settle down in a stable state rather than going into oscillation.

Choosing the figure 10 % is a balance between memory use and performance. If you choose a higher value, your program will use more memory (because of the increased amount of garbage). On the other hand, you can give the garbage collection a smaller time slice. I've chosen a pretty low number, because on consoles, memory is always precious. If you are targeting a platform with more memory, you can go higher.

Let's compute how much time we need to spend on garbage collection to stay below a certain fraction 0 <= a <= 1 of garbage. Assume that we complete a full garbage collection cycle (scan all Lua memory) in time t. The amount of garbage generated in that time will be:

> t g

Where *g* is the garbage/s created by the program. To make sure that we stay below a fraction a we must have (where m is the total memory used by the program, including the garbage):

> t g <= a m

Assume that we sweep *s* bytes/s. Then the time t required to sweep the entire memory m will be:

> t = m / s

Combining the two equations we get:

> s <= g / a

So the amount of garbage collection work we need to do per frame is directly proportional to the amount of garbage / s generated by the program and inversely proportional to the fraction of garbage we are willing to accept. (Note that interestingly, *m* cancels out of the equation.)

So, if we are willing to spend more memory, we can address garbage collection problems by increasing *a*. But since *a* can never be higher than 1, there are limits to what we can achieve in this way. A better option, that doesn't cost any memory, is to reduce *g* -- the amount of garbage generated.

In my experience, most garbage generation problems are "easy mistakes" from sloppy and thoughtless programming. Once you know where the problems are, it is usually not hard to rewrite the code so that garbage generation is avoided. Some useful refactoring techniques are:

* Update the fields in an existing table instead of creating a new one.

* Return a reference to an object member rather than a copy. Copy only when needed.

* Write functions so that they take and return values rather than tables to avoid temporary tables. I. e., `make_point(2,3)` rather than `make_point({2,3})`.

* * If you need temporary objects, find a way of reusing them so you don't need to create so many of them.

* Avoid excessive string concatenation.

Of course a key requirement for this to work is that your Lua-to-C bindings are written so that they don't generate garbage. Otherwise your poor gameplay programmer has no chance. In my opinion, it should be possible to call any C function in a "garbage free" way (though you may choose to also have a more convenient path that does generate garbage). For tips on how to write garbage free bindings, see my previous posts on [Lightweight Lua Bindings](http://altdevblogaday.com/2011/06/26/lightweight-lua-bindings/).

To reduce garbage generation, you need to be able to pinpoint where in the program the garbage is being generated. Luckily, that is not difficult.

Once the game has reached a stable state (total Lua memory doesn't grow or shrink) any allocation made can be considered garbage, because it will soon be freed again (otherwise the Lua memory would keep growing). So to find the garbage all you have to do is to add some tracing code to `lua_Alloc` that you can trigger when you have reached a stable state.

You can use `lua_getstack()` to get the current Lua stack trace from inside lua_Alloc and use a HashMap to count the number of allocations associated with each stack trace. If you then sort this data by the number of allocations it is easy to identify the "hotspots" that are generating the most garbage. A gameplay programmer can go through this list and reduce the amount of garbage generation using the tips above.

The code may look something like this:

```cpp
struct TraceEntry {
	TraceEntry() : alloc_count(0), alloc_bytes(0) {}
	String trace;
	unsigned alloc_count;
	unsigned alloc_bytes;
};
HashMap<uint64, TraceEntry> _traces;

if (_tracing_allocs) {
	lua_Debug stack[5] = {0};
	int count = lua_debugger::stack_dump(L, stack, 5);
	uint64 hash = murmur_hash_64(&stack[0], sizeof(lua_Debug)*count);
	TraceEntry &te = _traces[hash];
	te.alloc_count += 1;
	te.alloc_bytes += (new_size - old_size);
	if (te.trace.empty())
		lua_debugger::stack_dump_to_string(L, te.trace);
}
```

In my experience, spending a few hours on fixing the worst hot spots indicated by the trace can reduce the garbage collection time by an order of magnitude.