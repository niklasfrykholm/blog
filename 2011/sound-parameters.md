# An Example in Data-Oriented Design: Sound Parameters

The BitSquid sound system allows arbitrary parameters to be set on playing sounds:

```
force = 35.3
material = "wood"
weapon = "axe"
```

In the sound editor the sound designer can setup curves and switches that depend on these parameters. So, for example, the designer can choose to play different wav files for a weapon impact, depending on the weapon that was used and the material it hit. In addition the volume and pitch of the sound can be controlled by a curve connected to the force of the impact.

To implement this behavior, we need a way of representing such parameter sets in the engine. Since there can potentially be lots of playing sounds, we need a representation that is as efficient as possible.

If you did a by-the-book C++ design of this problem, you might end up with an abomination like this:

```cpp
struct ParameterValue
{
 enum Type {STRING_TYPE, NUMERIC_TYPE};
 Type type;
 std::string string_value;
 float numeric_value;
};

typedef std::map<std::string, ParameterValue> Parameters;

struct SoundInstance
{
 // Other members...
 Parameters *parameters;
};

std::vector<SoundInstance> playing_sounds;
```

which would result in tons of pointer chasing, memory allocation and data copying.

So let’s fix it!

First, let’s get rid of the strings. Strings should almost only be used for text that is *displayed to the end user*. For everything else, they are usually a bad idea. In this case, since the only thing we need to do is match strings that are equal (find the parameter named ”material”, check if its is value ”wood”, etc) we can use a hash instead of the full string value:

```cpp
struct ParameterValue
{
 enum Type {STRING_TYPE, NUMERIC_TYPE};
 Type type;
 union {
  IdString32 string_value;
  float numeric_value;
 };
};

typedef std::map<IdString32, ParameterValue> Parameters;
```

*IdString32* is our type for representing hashed strings. It just stores a 4-byte string hash. Since it is a POD-type, we can put it in a union together with the numeric value. This takes the ParameterValue struct down to a manageable 8 bytes with no dynamic data allocation.

But we can actually make it even smaller, by just getting rid of the type:

```cpp
union ParameterValue {
 IdString32 string_value;
 float numeric_value;
};
```

We can do this because when we access the parameter we know which type we want. If we are evaluating a curve, we want a numeric value. If we want to compare it to a hash, we want a string value. Getting rid of the type means we can’t *assert()* on type errors (if someone has done something silly like setting the ”material” to 3.5 or the ”force” to ”banana”). But other than that everything will work as before.

Next, let’s attack the map:

```cpp
typedef std::map<IdString32, ParameterValue> Parameters;
```

Just like *std::string*, *std::map* should set off all kinds of warning bells in your head. *std::map* is almost never a good choice. Better alternatives are: linear search in a *std::vector* (for smallish maps), binary search in a sorted array (for larger, static maps) or *hash_map*.

In this case, we don’t expect there to be that many parameters set on a sound (<10 in the typical case), so linear search is fine:

```cpp
struct Parameter {

 IdString32 key;

 union {

  IdString32 string_value;

  float numeric_value;

 };

};



typedef std::vector<Parameter> Parameters;



struct SoundInstance

{

 // Other members...

 Parameters *parameters;

};



std::vector<SoundInstance> _playing_sounds;
```

A lot better than what we started with. But I’m still not 100 % satisfied.

I don’t like the fact that we have a vector of sound instances, and each of those contains a vector of parameters. Vectors-in-vectors raise performance warning flags for me. I like it when my data structures are just arrays of POD structs. Then I know that they are cache friendly and don’t put much strain on the memory system. 512 parameter vectors allocated on the heap for 512 playing sounds make me uneasy.

So what can we do? We could go to a fixed number of parameters:

```cpp
struct SoundInstance
{
 // Other members...
 unsigned num_parameters;
 Parameter parameters[MAX_INSTANCE_PARAMETERS];
};
```

Now the *SoundInstance* is a POD and all the data is just one big happy blob.

The drawback of this approach is that you might need to set *MAX_INSTANCE_PARAMETERS* pretty high to be able to handle the most complicated sounds. This would waste some memory for all the sounds that use just one or two parameters.

Say you have 512 sounds and MAX_INSTANCE_PARAMETERS = 32, with 8 bytes in the Parameter struct that then totals to 131 K. Not terrible, but not a tuppence either.

There should be some way of doing better. But if we can’t use a dynamic vector, nor a static array, what can we then possibly use?

A linked list!

Regular linked list have horrible cache behavior and are best stayed away from. But we can achieve the benefits of linked lists while still having decent cache performance by putting the list in an array:

```cpp
struct ParameterNode {
 IdString32 key;
 union {
  IdString32 string_value;
  float numeric_value;
 };
 ParameterNode *next;
};

ParameterNode nodes[MAX_PARAMETERS];

struct SoundInstance
{
 // Other members...
 ParameterNode *parameters;
};

std::vector<SoundInstance> playing_sounds;
```

Now we have all the parameters stored in a single memory blob. And instead of having a maximum number of parameters per sound, we have a total limit on the number of set parameters (which works much better when most sounds have few parameters). We could get rid of that limit as well if we needed to, by using a vector instead of an array to store the nodes and indices instead of pointers for the ”links”.

You can use many different strategies for allocating nodes from the array. My favorite method is to walk over the array until the next free node is found:

```cpp
unsigned last_allocated = MAX_PARAMETERS-1;

Node *allocate_node()
{
 while (true) {
  last_allocated = (last_allocated + 1) % MAX_PARAMETERS;
  if (nodes[last_allocated].key == 0)
   break;
 }
 return &nodes[last_allocated];
}
```

Here, an empty key is used to indicate free nodes.

The advantage of this method is that nodes that are allocated at the same time end up in adjacent array slots. This means that all the parameters of a particular sound (which tend to get set at the same time) get stored next to each other in memory, which means they can be accessed without cache misses.