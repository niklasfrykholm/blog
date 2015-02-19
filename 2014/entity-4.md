# Building a Data-Oriented Entity System (Part 4: Entity Resources)

In the [last post](http://bitsquid.blogspot.se/2014/10/building-data-oriented-entity-system.html), I talked about the design of the `TransformComponent`. Today we will look at how we can store entities as resources.

## Dynamic and Static Data

I'm a huge fan of compiling resources into big [blobs](http://bitsquid.blogspot.se/2010/02/blob-and-i.html) of binary data that can be read directly into memory and used as-is without any need for "deserialization" or "reference patching".

This requires two things:

* First, the data must be swapped to the right endianness when the data is generated.

* Second, internal references in the resource must use *offsets* instead of pointers, since we don't know where the loaded resource will end up in memory and we want to avoid pointer patching.

Initially, this approach can seem a bit complicated. But it is actually a lot simpler than messing around with deserialization and reference patching.

Note though, that this approach only works for static (read-only) data, such as meshes, textures, etc. If data needs to change for each *instance* of a resource, we must store it somewhere else. If an instance needs to change color, we can't store that color value in a memory area that is shared with other instances.

So what typically happens is that we split out the dynamic data as "instance data" and let that data refer to the static resource data. Many instances can make use of the same resource data, thus saving memory:

```
---------------                -----------------
|Instance of A| --------+----> |A resource data|
---------------         |      -----------------
                        |
---------------         |
|Instance of A| --------+
---------------

---------------                -----------------
|Instance of B| --------+----> |B resource data|
---------------         |      -----------------
                        |
---------------         |
|Instance of B|---------+
---------------
```

We typically hard-code what goes into the instance. For example, we know that the color is something that we want to modify so we add it to the instance data. The vertex and index buffers cannot be changed and thus go into the static data. When we create the instance we initialize the instance data with "default" values from an instance template in the resource data.

You could imagine doing this another way. Instead of hard-coding the data that can be modified per instance, you could say that *everything* can be modified per instance. In the instance data you would then use a flexible key-value store to store the delta between the instance and the resource data.

This is more flexible than hard-coding, because it allows you to override *everything* per instance, even texture or vertex data if you want that. It can also save memory, because the instance data will only contain the things  you *actually* override, not everything that *potentially* could be overridden. So if you have many instances that use the default values, you don't have to store any data for them.

On the other hand, there are drawbacks to this approach. Accessing value becomes a lot more complicated and expensive, because we always need to perform an extra query to find out if the instance has overridden the default value or not.

We currently don't use this approach anywhere in the engine. But I think there are circumstances where it would make sense.

Anyway, I'm getting sidetracked. Back to the entity system.

The thing is, the way I envision the entity system, it is very dynamic. Components can be added and removed at runtime, child entities linked in and properties changed. Components that handle static data, such as the `MeshComponent` do it by referencing a separate `MeshResource` that contains the mesh data. There is no mesh data stored in the component itself.

Since everything in the entity system is dynamic, there is *only* instance data. The only thing we have in the resource is the template for the instance data. Essentially, just a set of "instructions" for setting up an instance. There is no need for the instance to refer back to the resource after those instructions have been followed.

## Defining the Resource Format

So an entity resource should contain "instructions" for setting up an entity. What should it look like? Let's start by just writing up what needs to go in there:

```cpp
struct EntityResource
{
    unsigned num_components;
    ComponentData components[num_components];
    unsigned num_children;
    EntityResource children[num_children];
};
```

*Note: Of course the above is not legal C++ code. I'm using some kind of C-like pseudo-code that allows things like dynamically sized structs in order to describe the data layout. I've written about [the need for a language to describe data layouts](http://bitsquid.blogspot.se/2012/11/a-formal-language-for-data-definitions.html) before.*

The exact binary layout of the `ComponentData` is defined by each component type, but let's use a common wrapper format:

```cpp
struct ComponentData
{
    unsigned component_identifier;
    unsigned size;
    char data[size];
};
```

Now we have a common way of identifying the component type, so we know if we should create a `MeshComponent`, a `TransformComponent` or something else. We also know the size of the component data, so if we should encounter a component type that we don't understand, we can ignore it and skip over its data to get to the next component. (Another option would be to treat unknown component types as a fatal error.)

A quick fix to make this layout slightly better is to move all the fixed size fields to the start of the struct:

```cpp
struct EntityResource
{
    unsigned num_components;
    unsigned num_children;
    ComponentData components[num_components];
    EntityResource children[num_children];
};
```

Now we can access the `num_children` parameter without having to look at all the `components` and their `size`s to know how far we need to skip forward in the resource to get to the `num_children` field.

This may or may not matter in practice. Perhaps, we only need the value of `num_children` after we have processed all the component data, and at that point we already have a pointer into the resource that points to the right place. But I always put the fixed size data first as a force of habit, in case we *might* need it.

Sometimes, it makes sense to add offset tables to these kinds of resources, so that we can quickly lookup the offset of a particular component or child, without having to walk all of the memory and count up the `size`s:

```cpp
struct EntityResource
{
    unsigned num_components;
    unsigned num_children;
    unsigned offset_to_component_data[num_components];
    unsigned offset_to_child_data[num_children];
    ComponentData components[num_components];
    EntityResource children[num_children];
};
```

With this layout, we can get to the data for the i'th component and the j'th child as:

```cpp
struct EntityResourceHeader
{
    unsigned num_components;
    unsigned num_children;
};

const EntityResourceHeader *resource;
const unsigned *offset_to_component_data = (const unsigned *)(resource + 1);
ComponentData *data_i = (const ComponentData *)
    ((const char *)resource + offset_to_component_data[i]);

const unsigned *offset_to_child_data = (const unsigned *)
    (offset_to_component_data + num_components);
EntityResourceHeader *child_j = (const EntityResourceHeader *)
    ((const char *)resource + offset_to_child_data[j]);
```

The first time you encounter code like this it can seriously spin your head around with all the casting and pointer arithmetic. However, if you think about what happens and how the data is laid out in memory it is really pretty straight forward. Any mistakes you do will most likely cause huge crashes that are easy to find, not sneaky subtle bugs. And after a while you get used to these kinds of manipulations.

But, anyway, I'm drifting off on a tangent again, because actually for our purposes we don't need these lookup tables. We will just walk the memory from beginning to end, creating one component at a time. Since we don't need to jump around between different components, we don't need the lookup tables.

What we do need though is some way of storing more than one resource. Storing one entity is fine if we are dealing with a "prefab" type of resource, that contains a definition of a single entity. However, what about a level? It will probably contain a bunch of entities. So it would be nice to have a resource type that could store all those entities.

Ok, no biggie, we know how to do that:

```cpp
struct EntitiesResource
{
    unsigned num_entities;
    EntityResource entities[num_entities];
};
```

Done, yesno?

## Pivot!

Working for a while in this business you get an intuitive feel for when performance matters and when it doesn't. Of course, intuitions can be wrong, so don't forget to measure, measure, measure. But level spawning tends to be one of these areas where performance does matter.

A level can easily have 10 000 objects or more and sometimes you want to spawn them really fast, such as when the player restarts the level. So it seems worth it to spend a little bit of time to think about how we can spawn levels fast.

Looking at the resource layout, our spawn algorithm seems pretty straight forward:

* Create the first entity
    - Add its first component
    - Add its second component
    - ...
    - Create its child entities
* Create the second entity
    - Create its first component
    - Create its second component
    - ...
* ...

This is so simple and straight forward that it might seem impossible to improve on. We are walking the resource memory linearly as we step through components, so we are being cache friendly, aren't we?

Well, not really. We are violating one of the fundamental principles of data-oriented design: *Do similar things together*.

If we write out the operations we actually perform linearly instead of in an hierarchy and make things a bit more concrete, it's easier to see:

* Create entity A
* Create a `TransformComponent` for A
* Create a `MeshComponent` for A
* Create an `ActorComponent` for A
* Create entity B
* Create a `TransformComponent` for B
* Create a `MeshComponent` for B
* ...

Note how we are alternating between creating different kinds of components and entities. This not only messes with our instruction cache (because each component has its own code path), but with our data cache as well (because each component has its own data structures where the instances get inserted).

So let's rewrite this so that we keep common operations together:

* Create entity A
* Create entity B
* Create a `TransformComponent` for A
* Create a `TransformComponent` for B
* Create a `MeshComponent` for A
* Create a `MeshComponent` for B
* Create an `ActorComponent` for A

Much better. And we can go even further.

Instead of telling the `EntityManager` to *"create an entity"* one hundred times, let's just tell it to *"create 100 entities"*. That way, if there is any economy of scale to creating more than one entity, the `EntityManager` can take advantage of that. And let's do the same thing for the components:

* Create entities (A, B)
* Create `TransformComponent`s for (A,B)
* Create `MeshComponent`s for (A,B)
* Create an `ActorComponent` for A

Notice how we are encountering and making use of a whole bunch of data-oriented principles and guidelines here:

* Access memory linearly.
* Where there is one, there are many.
* Group similar objects and operations together.
* Perform operations on multiple objects at once, rather than one at a time.

Let's rewrite the data format to reflect all our newly won insight:

```cpp
struct EntityResource
{
    unsigned num_entities;
    unsigned num_component_types;
    ComponentTypeData component_types[num_component_types];
};

struct ComponentTypeData
{
    unsigned component_identifier;
    unsigned num_instances;
    unsigned size;
    unsigned entity_index[num_instances];
    char instance_data[size];
};
```

For each component, we store an identifier so we know if it's a `MeshComponent`, `TransformComponent`, etc. Then we store the number of instances of that component we are going to create and the size of the data for all those instances.

Note that now when we are walking the format, we can skip *all* instances of an unknown component type with a single jump, instead of having to ignore them one by one. This doesn't matter that much, but it is interesting to note that data-oriented reorganizations often make a lot of different kinds of operations more efficient, not just the one you initially targeted.

The `entity_index` is used to associate components with entities. Suppose we create five entities: A, B, C, D and E and two `ActorComponent`s. We need to know which entity each `ActorComponent` should belong to. We do that by simply storing the index of the entity in the `entity_index`. So if the entity index contained `{2,3}` the components would belong to C and D.

There is one thing we haven't handled in the new layout: *child entities*.

But child entities are not conceptually different from any other entities. We can just add them to `num_entities` and add their component instances to the `ComponentTypeData` just as we would do for any other entity.

The only additional thing we need is some way of storing the parent-child relationship. We could store that as part of the data for the `TransformComponent`, or we could just store an array that specified the index of each parent's entity (or `UINT_MAX` for root entities):

```cpp
struct EntityResource
{
    unsigned num_entities;
    unsigned num_component_types;
    unsigned parent_index[num_entities];
    ComponentTypeData component_types[num_component_types];
};
```

If `parent_index` was `{UINT_MAX, 0, 1, 1, 2}` in our A, B, C, D, E example, the hierarchy would be:

```
A --- B --- C --- E
      |
      + --- D
```

## Implementation Details

This post is too long already, so I'll just say something quickly about how the implementation of this is organized.

In the engine we have a class `EntityCompiler` for compiling entities and a similar class `EntitySpawner` for spawning entities.

A component that can compile data needs to register itself with the entity compiler, so that it can be called when component data of that kind is encountered by the compiler.

Ignoring some of the nitty-gritty details, like error handling, endian swapping and dependency tracking, this looks something like this:

```
typedef Buffer (*CompileFunction)(const JsonData &config, NittyGritty &ng);

void register_component_compiler(const char *name, CompileFunction f,
    int spawn_order);
```

The compile function takes some JSON configuration data that describes the component and returns a binary BLOB of resource data for insertion into the entity resource. Note that the compile function operates on a single component at a time, because we are not that concerned with compile time performance.

When registering the compiler we specify a name, such as `"mesh_component"`. If that name is found in the JSON data, the entity compiler will redirect the compile of the component data to this function. The name is also hashed into the `component_identifier` for the component.

The `spawn_order` is used to specify the compile order of the different component, and by extension, their spawn order as well. Some components make use of other components. For example, the `MeshComponent` wants to know where the enitty is, so it looks for a `TransformComponent` in the entity. Thus, the `TransformComponent` must be created before the `MeshComponent`.

A similar approach is used to register a component spawner:

```
typedef void (*SpawnFunction)(const Entity *entity_lookup,
    unsigned num_instances, const unsigned *entity_index, const char *data);

void register_component_spawner(const char *name, SpawnFunction f);
```

Here the `entity_lookup` allows us to look up an entity index in the resource data to a an actual `Entity` that is created in the first step of spawning the resource. `num_instances` is the number of component instances that should be created and `entity_index` is the entity index from the `ComponentTypeData` that lets us lookup which entity should own the component.

So `entity_lookup[entity_index[i]]` gives the `Entity` that should own the `i`th component instance.

The `data` finally is a pointer to the `instance_data` from the `ComponentTypeData`.

That's certainly enough for today. Next time, we'll look at a concrete example of this.
