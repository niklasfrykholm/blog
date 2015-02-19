## Building a Data-Oriented Entity System (part 1)

We have recently started to look into adding an entity/component system to the Bitsquid engine.

You may be surprised to learn that the Bitsquid engine isn't already component based. But actually there has never been a great need for that. Since the gameplay code is usually written in Lua rather than C++, we don't run into the common problems with deep and convoluted inheritance structures that prompt people to move to component based designs. Instead, inheritance is used very sparingly in the engine.

But as we are expanding our [plugin system](http://bitsquid.blogspot.se/2014/04/building-engine-plugin-system.html), we need a way for C++ plugins to bestow game objects with new functionalities and capabilities. This makes a component architecture a very natural fit.

### Entities and Components

In the Bitsquid engine, we always strive to keep systems decoupled and data-oriented and we want to use the same approach for the component architecture. So, in our system, entities are not heap allocated objects. Instead, an entity is just an integer, a unique ID identifying a particular entity:

```cpp
struct Entity
{
	unsigned id;
};
```

A special class, the *EntityManager* keeps track of the entities that are alive.

A component is not an object either. Instead, a component is something that is handled by a *ComponentManager*. The task of a *ComponentManager* is to associate entities with components. For example, the *DebugNameComponentManager* can be used to associate debug names with entities:

```cpp
class DebugNameComponentManager
{
public:
	void set_debug_name(Entity e, const char *name);
	const char *debug_name(Entity e) const;
};
```

Two things are interesting to note about this decoupled design.

First, there is no *DebugNameComponent* class for handling individual debug name components in this design. That is not needed, because all component data is managed internally by the *DebugNameComponentManager*. The manager *could* decide to use heap allocated *DebugNameComponent* objects internally. But it is not forced to. And usually it is much more efficient to lay out the data differently. For example, as a structure of arrays in a single continuous buffer. In a future post, I'll show some examples of this.

Second, there is no place where we keep a list of all the components that an entity has. It is only the *DebugNameComponentManager* that knows whether an entity has a debug name component or not, and if you want to talk about that component you have to do it through the *DebugNameComponentManager*. There is no such thing as an "abstract" component.

So what components an entity has is only defined by what has been registered with the different component managers in the game. And plugins may extend the system with new component managers.

It is up to the component manager to decide if it makes sense for an entity to have multiple components of its type. For example, the *DebugNameComponentManager* only allows a single debug name to be associated with an entity. But the *MeshComponentManager* allows an entity to have multiple meshes.

The manager is responsible for performing any computations necessary to update the components. Updates are done one component manager at a time, not one entity at a time, and when a component manager is updated it updates all its components in one go. This means that common calculations can be shared and that all the data is hot in the caches. It also makes the update easier to profile, multithread or offload to an external processor. All this translates to huge performance benefits.

### The EntityManager

We want to be able to use the entity ID as a weak reference. I.e., given an entity ID we want to be able to tell if it refers to a living entity or not.

Having a weak reference system is important, because if we only have strong references then if the entity dies we must notify everybody that might possibly hold a reference to the entity so that they can delete it. This is both costly and complicated. Especially since references might be held by other threads or by Lua code.

To enable weak referencing, we use the *EntityManager* class to keep track of all live entities. The simplest way of doing that would be to just use a set:

```cpp
class EntityManager
{
	HashSet&lt;Entity> _entities;
	Entity _next;

public:
	Entity create()
	{
		while (alive(_next))
			++_next.id;
		_entities.insert(_next);
		return _next;
	}

	bool alive(Entity e)
	{
		return _entities.has(e);
	}

	void destroy(Entity e)
	{
		_entities.erase(e);
	}
};
```

This is pretty good, but since we expect the *alive()* function to be a central piece of code that gets called a lot, we want something that runs even faster than a set.

We can change this to a simple array lookup by splitting the entity ID into an *index* and a *generation* part:

```cpp
const unsigned ENTITY_INDEX_BITS = 22;
const unsigned ENTITY_INDEX_MASK = (1&lt;&lt;ENTITY_INDEX_BITS)-1;

const unsigned ENTITY_GENERATION_BITS = 8;
const unsigned ENTITY_GENERATION_MASK = (1&lt;&lt;ENTITY_GENERATION_BITS)-1;

struct Entity
{
	unsigned id;

	unsigned index() const {return id &amp; ENTITY_INDEX_MASK;}
	unsigned generation() const {return (id >> ENTITY_INDEX_BITS) &amp; ENTITY_GENERATION_MASK;}
};
```

The idea here is that the *index* part directly gives us the index of the entity in a lookup array. The *generation* part is used to distinguish entities created at the same index slot. As we create and destroy entities we will at some point have to reuse an index in the array. By changing the generation value when that happens we ensure that we still get a unique ID.

In our system we are restricted to using 30 bits for the entity ID. The reason for this is that we need to fit it in a 32 bit pointer in order to be able to use a Lua *light userdata* to store it. We also need to steal two bits from this pointer in order to distinguish it from other types of *light userdata* that we use in the engine.

If you didn't have this restriction, or if you only targeted 64-bit platforms it would probably be a good idea to use some more bits for the ID.

We've split up our 30 bits into 22 bits for the index and 8 bits for the generation. This means that we support a maximum of 4 million simultaneous entities. It also means that we can only distinguish between 256 different entities created at the same index slot. If more than 256 entities are created at the same index slot, the *generation* value will wrap around and our new entity will get the same ID as an old entity.

To prevent that from happening too often we need to make sure that we don't reuse the same index slot too often. There are various possible ways of doing that. Our solution is to put recycled indices in a queue and only reuse values from that queue when it contains at least *MINIMUM_FREE_INDICES = 1024* items. Since we have 256 generations, an ID will never reappear until its index has run 256 laps through the queue. So this means that you must create and destroy at least 256 * 1024 entities until an ID can reappear. This seems reasonably safe, but if you want you can play with the numbers to get different margins. For example, if you don't need 4 M entities, you can steal some bits from *index* and give to *generation*.

A nice thing about only having 8 bits in *generation* is that we just need 8 bits per entity in our lookup array. This saves memory, but also gives us better performance, since we will fit more in the cache. With this solution, the code for the *EntityManager* becomes:

```cpp
class EntityManager
{
	Array&lt;unsigned char> _generation;
	Deque&lt;unsigned> _free_indices;

public:
	Entity create()
	{
		unsigned idx;
		if (_free_indices.size() > MINIMUM_FREE_INDICES) {
			idx = _free_indices.front();
			_free_indices.pop_front();
		} else {
			_generation.push_back(0);
			idx = _generation.size() - 1;
			XENSURE(idx &lt; (1 &lt;&lt; ENTITY_INDEX_BITS));
		}
		return make_entity(idx, _generation[idx]);
	}

	bool alive(Entity e) const
	{
		return _generation[e.index()] == e.generation();
	}

	void destroy(Entity e)
	{
		const unsigned idx = e.index();
		++_generation[idx];
		_free_indices.push_back(idx);
	}
};
```

In the next post, we will take a look at the design of the component classes.
