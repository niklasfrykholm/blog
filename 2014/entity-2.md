# Building a Data-Oriented Entity System (Part 2: Components)

In the [last post](http://bitsquid.blogspot.se/2014/08/building-data-oriented-entity-system.html), I talked about the design of the *Entity Manager* and how we handle creation and destruction of game entities.

In this post we will look at how components can be implemented.

A quick recap: Components in our system are not individual objects, instead all components of a particular type are handled by a *component manager* for that type. The component manager has full control over how the component data is stored internally and how updates are applied.

## A Component Example

To have something to talk about we will consider a fictitious component that handles point mass objects. For each component instance we want to store the following data:

```cpp
Entity entity;          ///< Entity owner
float mass;             ///< Mass of object
Vector3 position;       ///< Object's position
Vector3 velocity;       ///< Object's velocity
Vector3 acceleration;   ///< Object's acceleration
```

The component needs functions for accessing this data and simulating physics.

It is perhaps not self-evident why we want to store the entity that owns the component, but it will come in handy later.

*Note that this is not a real world example. We don't actually have a component like this in the engine, and perhaps it's not the best or most interesting design, but it gives us something to talk about.*

## Component Data Layout

When considering how we should layout the data in the component manager we have two goals:

* Given an entity we want to be able to quickly look up the component data for that entity.
* We want the component data to be packed tightly in memory for good cache performance.

Let's tackle the second question first.

Actual cache performance depends on how your CPU works and what the data access patterns in the code are. You can spend a lot of time trying to bend your mind around those things, but I would recommend going with a simple rule of thumb instead:

> Pack the data in arrays that you access sequentially.

Only get more fancy than that when you are trying to fix a diagnosed performance issue.

A generally good approach is to use a structure-of-arrays. I.e., each field is stored in an array in memory, with one entry for each component instance:

```
[entity_1]  [entity_2]  [entity_3] ...
[mass_1]    [mass_2]    [mass_3]   ...
[pos_1]     [pos_2]     [pos_3]    ...
[vel_1]     [vel_2]     [vel_3]    ...
[acc_1]     [acc_2]     [acc_3]    ...
```

The advantage of having each field stored separately is that code that only processes some of the fields don't have to waste precious cache space on the others.

You could go even further and put each *x*, *y* and *z* component of a `Vector3` into its own array. An advantage of that is that you can do more efficient SIMD calculations, if you want to go down that route. But for this example, let's keep things a bit simpler and store the `Vector3`s together. Since the layout of the data is entirely encapsulated in the `ComponentManager` class we can always go back and redesign that later if we need some extra performance.

The simplest way of implementing this data layout is to use an `Array` for each component:

```cpp
class PointMassComponentManager {
    struct InstanceData {
        Array<Entity> entity;
        Array<float> mass;
        Array<Vector3> position;
        Array<Vector3> velocity;
        Array<Vector3> acceleration;
    };
    InstanceData _data;
};
```

That works well enough, but it does mean that the data gets stored in five separately allocated memory buffers. So I use a different approach. I allocate the entire memory buffer as a single allocation and then just let `entity`, `mass`, etc, point to different parts of that buffer:

```cpp
struct InstanceData {
    unsigned n;          ///< Number of used instances.
    unsigned allocated;  ///< Number of allocated instances.
    void *buffer;        ///< Buffer with instance data.

    Entity *entity;
    float *mass;
    Vector3 *position;
    Vector3 *velocity;
    Vector3 *acceleration;
};
InstanceData _data;

void allocate(unsigned sz)
{
    assert(sz > _data.n);

    InstanceData new_data;
    const unsigned bytes = sz * (sizeof(Entity) + sizeof(float) +
        3 * sizeof(Vector3));
    new_data.buffer = _allocator.allocate(bytes);
    new_data.n = _data.n;
    new_data.allocated = sz;

    new_data.entity = (Entity *)(new_data.buffer);
    new_data.mass = (float *)(new_data.entity + sz);
    new_data.position = (Vector3 *)(new_data.mass + sz);
    new_data.velocity = new_data.position + sz;
    new_data.acceleration = new_data.velocity + sz;

    memcpy(new_data.entity, _data.entity, _data.n * sizeof(Entity));
    mempcy(new_data.mass, _data.mass, _data.n * sizeof(float));
    memcpy(new_data.position, _data.position, _data.n * sizeof(Vector3));
    memcpy(new_data.velocity, _data.velocity, _data.n * sizeof(Vector3));
    memcpy(new_data.acceleration, _data.acceleration,
        _data.n * sizeof(Vector3));

    _allocator.deallocate(_data.buffer);
    _data = new_data;
}
```

This avoids any hidden overheads that might exist in the `Array` class and we only have a single allocation to keep track of. This is better both for the cache and the memory allocation system.

*Side note: I'm tempted to write a memory system with a 4 K allocation granularity. I.e. there is no traditional heap allocator, just a page allocator and you have to design your systems so that they only work with large allocations.*

## Accessing Data

Let's consider the second issue, how we map from an entity to its component data. For the sake of simplicity, let's assume for now that we don't support multiple components per entity.

In the data layout, we refer to a particular component instance by its index in the `mass`, `position`, etc arrays. So what we need is a way to map from an entity to an index.

You may remember from the [previous post](http://bitsquid.blogspot.se/2014/08/building-data-oriented-entity-system.html), that `Entity` itself contains a unique index. So one alternative would be to just use this index.

This could be a good approach if almost every entity in the game had this component. But if that is not the case our arrays will contain a lot of "holes" corresponding to entities that lack the component. This will waste memory, but also performance, because we will fill our caches with unused data.

We can improve this somewhat by using a level of indirection:

```cpp
Array<unsigned> _map;
```

Here, the `_map` allows us to look up a component index based on the entity index. This is a lot better, because now it is just the `_map` array that has holes, not the `_data` array, which means that the holes are fewer and smaller.

Still, I would only use this if I was certain that the component was almost universal and that lookups where performance critical. In most cases, I think a hash index is a better approach:

```cpp
HashMap<Entity, unsigned> _map;
```

This uses less memory and lookups are still pretty fast.

Since the lookup from `Entity` to instance index involves an extra step we want to reflect that in the API and not force the user to do multiple lookups when she wants to access different fields of the same component. Something like this:

```cpp
/// Handle to a component instance.
struct Instance {int i;};

/// Create an instance from an index to the data arrays.
Instance make_instance(int i) {Instance inst = {i}; return inst;}

/// Returns the component instance for the specified entity or a nil instance
/// if the entity doesn't have the component.
Instance lookup(Entity e) {return make_instance(_map.get(e, 0));}

float mass(Instance i) {return _data.mass[i.i];}
void set_mass(Instance i, float mass) {_data.mass[i.i] = mass;}
Vector3 position(Instance i) {return _data.position[i.i];}
...
```

To support multiple component instance per entity, you can add a `next_instance` field to the component data that allows you to traverse a linked list of component instances belonging to the same entity. This is left as an exercise to the reader.

## Component Updates

Since the component data is laid out sequentially in memory, writing a function that simulates physics for all entities is simple:

```cpp
void simulate(float dt)
{
    for (unsigned i=0; i<_data.n; ++i) {
        _data.velocity[i] += _data.acceleration[i] * dt;
        _data.position[i] += _data.velocity[i] * dt;
    }
}
```

This function traverses memory in-order which gives us good cache performance. It's also easy to profile, vectorize and parallelize, should the need arise.

*Side rant: I'm somewhat allergic to methods being called `update()`. That is a bad remain from bad inheritance-based designs. If you take a second to think about it you can almost always come up with better, more informative names than `update()`.*

## Destroying Components

When destroying components, we want to make sure that we keep the `_data` array tightly packed. We can achieve that by moving the last element to the position of the component we want to remove. We must also update the `_map` entry for the corresponding entity.

```cpp
void destroy(unsigned i)
{
    unsigned last = _data.n - 1;
    Entity e = _data.entity[i];
    Entity last_e = _data.entity[last];

    _data.entity[i] = _data.entity[last];
    _data.mass[i] = _data.mass[last];
    _data.position[i] = _data.position[last];
    _data.velocity[i] = _data.velocity[last];
    _data.acceleration[i] = _data.acceleration[last];

    _map[last_e] =  i;
    _map.erase(e);

    --_n;
}
```

Another question is how we handle destruction of components when an entity is destroyed. As you may recall, the entity does not have an explicit list of components that it owns. Also, it seems onerous to require of the user of the API to manually destroy the right components when the entity dies.

Instead, we use one of two approaches.

Components that need to be destroyed immediately (perhaps because they hold external resources) can register a destruction callback with the `EntityManager` and that callback will be called when the entity is destroyed.

However, for simpler components, like the *point mass* component, there is nothing that require components to be destroyed at exactly the same time as the entity. We can take advantage of that and use garbage collection to lazily destroy components instead of spending memory and effort on storing callback lists:

```cpp
void gc(const EntityManager &em)
{
    unsigned alive_in_row = 0;
    while (_data.n > 0 && alive_in_row < 4) {
        unsigned i = random_in_range(0, _data.n - 1);
        if (em.alive(_data.entity[i])) {
            ++alive_in_row;
            continue;
        }
        alive_in_row = 0;
        destroy(i);
    }
}
```

Here, we pick random component indices and destroy them if the corresponding entity has been destroyed. We do this until we hit four living entities in a row.

The nice thing about this code is that it cost almost nothing if there are no destroyed entities (just four passes of the loop). But when there are a lot of destroyed entities the components will be quickly destroyed.

In the next post, we will look at the *Transform Component* that handles links between parent and child entities.
