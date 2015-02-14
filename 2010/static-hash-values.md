# Static Hash Values

We use 32-bit string hashes instead of strings in many places to save memory and improve performance. (When there is a risk for collision we use 64-bit hashes instead.)

At a number of places in the code we want to check these hashes against predefined values. For example, we may want to check if a certain object is the "root_point". With a straight forward implementation, you get code that looks like this:

```cpp
const char *root_point_str = "root_point";
static unsigned root_point_id = murmur_hash(root_point_str,
    strlen(root_point_str), 0);
if (object.name() == root_point_id)
    ...
```

We use a static variable to avoid having to hash the string more than once, but this is still pretty inefficient. There is the extra application data, the computation of the hash the first time the function is run. On subsequent invocations there is still the check to see if the static variable has been initialized.

It would be a lot more efficient if we could precompute the hashes somehow to avoid that cost in the runtime. I can see three ways:

* We could run a code generation pass in a pre-build step that generates the hash values and patches the code with them.

* We could use the preprocessor to generate the values.

* We could compute the values offline and hard-code them in the code.

I'm not too found of code generation. It is nice in theory, but to me it always seems kind of messy the way it interacts with the build system, the debugger, etc.

Rewriting the murmur hash algorithm in the preprocessor requires me to bring out some serious preprocessor-fu. But it is fun. It is almost like functional programming: With these lovely macros in place, we can now write:

```cpp
if (object.name() == HASH_STR_10('r','o','o','t','_','p','o','i','n','t'))
    ...
```

Having completed this task I feel a bit empty. That is certainly a lot of macro code for an end result that still is kind of meh.

I disregarded hard coding the values to begin with because no one wants to look at code like this:

```cpp
if (object.name() == 0x5e43bd96)
    ...
```

Even dressed up in comments, it is still kind of scary:

```cpp
unsigned root_point_id = 0x5e43bd96; // hash of "root_point"
if (object.name() == root_point_id)
    ...
```

What if someone types in the wrong value? What if we decide to change hash algorithm at some later point? Scary. But maybe we can ameliorate those fears:

```cpp
#ifdef _DEBUG
    inline unsigned static_hash(const char *s, unsigned value) {
        assert( murmur_hash(s, strlen(s), 0) == value );
        return value;
    }
#else
    #define static_hash(s,v) (v)
#end

...

if (object.name() == static_hash("root_point", 0x5e43bd96)
    ...
```

That looks better and is completely safe. If something goes wrong, the assert will trigger in the debug builds.

I think I like this better than the preprocessor solution. It will make the debug builds run a bit slower, but that's what debug builds are for, right?