# Strings Redux

Simpler programs are better programs. Today's target: strings. In this post I will show you three ways of improving your code by simplifying your strings.

## Use UTF-8 everywhere

When I issue programming tests I always have some question about different string encodings. It is a good way of testing if a candidate can distinguish what data represents from how it is represented. But when I write code I just use UTF-8 everywhere, both in memory and on disk. Why? UTF-8 has many advantages and no serious disadvantages.

Advantages:

* Using the same encoding everywhere means there is never any confusion about what encoding a certain string or file should be in. If it is not in UTF-8, then it is wrong. Period.

* UTF-8 uses the standard C data types for strings: `char *` and `char []`.

* ASCII strings look like ASCII strings and all functions, parsers, etc that operate on ASCII strings work on UTF-8 strings without modification.

The most common disadvantages claimed for UTF-8 are:

* UTF-8 can waste memory.

* Finding the i’th glyph in a UTF-8 string is expensive (O(n) rather than O(1)).

There is some truth to the first point. Yes, if your text is in Japanese, UTF-8 probably uses more memory than Shift-JIS. But I don’t think that is a major issue. First, while UTF-8 is worse than other encodings for some languages, it does pretty well on average. Second, strings aren’t a big part of a game’s memory usage anyway (if they are, you are most likely doing something wrong). And third, if you care that much about string memory usage you should probably compress your string data.

Compression will pretty much nullify any differences in memory usage caused by using different encodings, since the entropy of the underlying data is the same regardless of how it is encoded. (At least in theory, it would be interesting to see someone test it in practice.)

The second point is true but also moot, since accessing glyphs at random indices in a string is a much rarer operation than you might think. For most string operations: concatenation, parsing, etc you never have to access individual glyphs. You can just use the same implementation as you would use for an ASCII-string and it will work without modification.

In the few cases where you do need to convert to glyphs (for example for rendering) you typically do that *sequentially*, from the start to the end. This is still a fast operation, it is only *random access* of glyphs that is significantly slower with UTF-8 than with UTF-32. Another interesting thing to note is that since all continuation bytes in UTF-8 follow the pattern 10xxxxxx you can quickly find the start and end of the next or previous glyph given a *char \** to anywhere within a UTF-8 string.

In fact I can't think of any string operation that requires fast random access to glyphs other than completely contrived examples (given 10000 long strings, find the 1000th glyph in each). I urge my readers to try to come up with something.

## You do not need a string class

String classes are highly overrated.

Generally speaking, code that deals with strings can be divided into two categories: code that looks at static strings (parsers, data compilers, script callbacks, etc) and code that builds dynamic strings (template formatters, debug logging, etc). In a typical game project there is a lot more of the first than the latter. Ironically, string classes don’t do a very good job with *either*!

For code that deals with static strings you should always use `const char *` rather than `const string &`. The former is more flexible. It allows the caller to store her strings however she likes rather than adhering to some memory model imposed by the string class. It also means that if you call the function with a static string it doesn’t get pointlessly converted to a *string* object.

But string classes aren’t very good for dynamic strings either, as anyone who has written something like this can attest to:

```cpp
string a;
for (i = 0; i<10000; ++i)
    a += "xxx";
```

Depending on how your string class is implemented this can be horribly inefficient, reallocating and copying the string memory for every iteration of the loop. There are various ways of addressing this: reserving memory for the string up front or using some kind of "rope" or "stringstream" class.

The simpler approach is to just use:

```cpp
vector<char> a;
for (i=0; i<10000; ++i)
 string::append(a, "xxx");
```

We represent the string as a vector of chars and provide a library of functions for performing "common string operations" on that representation.

The advantage of this over using a regular string class is that it provides a clear distinction between strings that can grow (`vector<char>`) and strings that can't (`char *`) and emphasizes what the cost of growing is (amortized linear time). Do you know the cost of growing in your *string* class?

## You should almost never use strings in your runtime

The variable length nature of strings make them slow, memory consuming and unwieldy (memory for them must be allocated and freed). If you use fixed length strings you will either use even more memory or annoy the content creators because they can't make their resource names as descriptive as they would like too.

For these reasons I think that strings in the runtime should be reserved for two purposes:

* User interface text
* Debugging

 In particular, you shouldn't use strings for object/resource/parameter names in the runtime. Instead use string hashes. This lets you use user friendly names (strings) in your tools and fast ints in your runtime. It is also a lot easier to use than enums. Enums require global cooperation to avoid collisions. String hashes just require that you hash into a large enough key space.

We hash names during our data compile stage into either 32-bit or 64-bit ints depending on the risk of collision. If it is a global object name (such as the name of a texture) we use 64-bit ints. If it is a local name (such as the name of a bone in a character) we use 32-bit ints. Hash collision is considered a compile error. (It hasn't happened yet.)

Since user interface text should always be localized, all user interface strings are managed by the localizer. The localized text is fetched from the localizer with a string lookup key, such as "menu_file_open" (hashed to a 64-bit int of course).

This only leaves debugging. We use formatted strings for informative assert messages when something goes wrong. Our profiler and monitoring tools use [interned strings](http://altdevblogaday.org/2011/05/26/monitoring-your-game/) to identify data. Our game programmers use debug-prints to root out problems. Of course, non of this affects the end user, since the debugging strings are only used in debug builds.

Hashes can be problematic when debugging. If there is an error in the resource 0x3e728af10245bc71 it is not immediately obvious that it is the object *vegetation/trees/larch_3.mesh* that is at fault.

We handle this with a lookup table. When we compile our data we also create a reverse lookup table that converts from a hash value back to the original string that generated it. This table is not loaded by the runtime, but it can be accessed by our tools. So our game console, for instance, uses this table to automatically translate any hash IDs that are printed by the game.

However, recently I've started to also add small fixed-size debug strings to the resources themselves. Something like this:

```cpp
HashMap<IdString64, MeshResource *> _meshes;

struct MeshResource
{
 char debug_name[32];
 …
};
```

As you can see, all the lookup tables etc, still use the 64-bit hash to identify the resource. But inside the resource is a 32-byte human friendly name (typically, the last 32 characters of the resource name), which is only used for debugging. This doesn't add much to the resource size (most resources are a lot bigger than 32 bytes) but it allows us to quickly identify a resource in the debugger or in a raw memory dump without having to open up a tool to convert hashes back to strings. I think the time saved by this is worth those extra bytes.