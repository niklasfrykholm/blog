# Building a Data-Oriented Entity System (Part 3: The Transform Component)

In the [last post](http://http://bitsquid.blogspot.se/2014/09/building-data-oriented-entity-system.html), I talked generally about the design of components. Today I will focus on a specific real-world component, the `TransformComponent`.

## The Transform Component

The purpose of the `TransformComponent` is to allow entities to be positioned in the world.

It handles positioning of entities in the world and child-parent linking. For example,  you may want to link a "wheel" entity to a "car" entity, so that the wheel follows the car around when it moves.

In that sense, the `TransformComponent` is what forms the scene graph of an engine world.

## Design Decisions

### Should every entity have a transform component?

In some engines, every entity has to have a transform component, even if it is just a purely "logical" entity that doesn't really have a position in the world.

To me it seems strange to force an entity to have a position when that has no real meaning. I also want entities to be as cheap as possible. So it seems better to have the transform component optional, just as any other component. An entity that doesn't have a transform component doesn't have any position in the world.

Actually, talking about *the world* is a bit of misnomer. The Bitsquid engine does not have a single *World* where everything has to live. Instead you can create multiple worlds, each populated with its own objects. So you might have one world for your "main game", one world for the "inventory screen", one world for the "loading screen", etc.

This is a lot better than having an "inventory room" at some secret hidden place in the main game world.

Each world has its own `TransformComponent` manager, and an entity can create transform components in several of these managers, if it so desires. So the same entity can exist and be positioned at different places in different game worlds. Since a `MeshComponent` manager also exists in each world, the entity can have different graphical representations in each world.

This is a bit esoteric, and I don't expect many entities to make use of this, but there are situations when it could be interesting. For example, a player's pickaxe could exist both in the "game world" and in the "inventory world" and still be managed as the same entity.

### Entity scene graphs and model scene graphs

In the entity system there are really two kinds of "scene graphs" that we need to deal with.

The first is the one we have already talked about, the graph formed by entities and their linked child entities.

The second is the graph of nodes *within* an entity. For example, a character entity may have a model with hundreds of bones that can be individually animated.

What should the relationship be between these two graphs?

In previous engine code, I have always treated these two graphs as parts of the same system. The model scene graphs were linked to nodes in the entity scene graphs and computed their transforms in world space. This creates an update order dependency. We can't compute the world positions in the model scene graph until we have computed the world position in the entity scene graph. This limits what kinds of things we can do in parallel.

For the entity system I've decided to decouple these two concepts. The model scene graph won't compute world space poses, instead it will compute poses relative to the entity pose. This means that we can evaluate the animations and compute the model pose without knowing anything about the entity pose. (Ignoring world space constraints, of course, but they will be handled in a later pass.)

Of course it also requires us to multiply the model node transforms with the entity transform to get the *actual* world position of the model nodes.

I have not completed the design of the model scene graph component yet, but maybe I'll get a chance to return to this in a future post.

### Immediate or deferred updates

In previous engines I have always used deferred updates of the world transforms. I.e., changing the local transform of a node would not immediately update its world transform (or the world transforms of its children). Instead it would simply set a "dirty" flag in the entity. Later, I would compute the world transforms of all the dirty nodes (and their children) as a single step.

This has the advantage that we never have to compute the world transform of a node more than once.

Consider the worst case scenario, a long chain of nodes:

```
[ node_1 ] ---> [ node_2 ] ---> [ node_3 ] ---> ... ---> [ node_n ]
```

With a deferred update, changing the local pose of every node will still just require `O(n)` computations to compute all the world transforms. With an immediate update, where we compute the world transforms of all children as soon as the parent transform changes, we will need `O(n^2)` computations.

On the other hand, there is a drawback to using deferred updates. Whenever we ask for an object's world position we won't get its *actual* world position, but its world position from the last frame (unless we ask after the world transform update). This can lead to a lot of confusion and subtle bugs. Solving them often requires ugly hacks, such as forcing graph updates at different times.

So what should we choose?

I think that with the decision to decouple the model scene graphs from the entity scene graphs the performance problems of immediate updates are a lot less serious. Long chains of nodes that are all moving can certainly exist in the *model* scene graph. (Consider an animation of a character swinging a whip.) But I would guess that long chains of objects that are all moving at once are a lot less common in the *entity* scene graph.

Note that the performance problems do not appear if it is just the root entity that is moving. In that case, both the immediate and the deferred update will be `O(n)`. It is only when the parent *and* the children are moving that the immediate update does worse.

I don't expect there to be very long chains of entities (`n <= 5 ???`) and I don't expect all of the objects in those chains to be moving simultaneously. So I have decided to go with *immediate* updates so that we always have accurate world transforms.

*Note: If we run into performance problems as a result of this, we can always create an API function that allows us to set multiple local transforms at once while doing a single world transform update, thus getting back the `O(n)` performance.*

### A side note on deferred updates

Note that if you want to do deferred updates, you want to keep the entity array sorted so that parents always appear before children. That way you can just walk the array from beginning to end and compute the transforms and be sure that the world transform of a parent has been computed before you compute the world transform of its children.

Also, you don't want to loop over the entire array to look for dirty objects:

```cpp
for (int i=0; i<n; ++i) {
    if (dirty[i])
        transform(i);
}
```

Typically, in a scene, only a small percentage of the objects are moving at any one time (maybe as little as 1 %). So looping over all objects, even just to check a flag, can waste a lot of time.

A better solution is to sort all the dirty objects to the end of the array, so we can loop over just them:

```cpp
for (int i=first_dirty; i<n; ++i)
    transform(i);
```

Since we only need a partial sorting of the array, we don't have to run an expensive `O(n log n)` sorting algorithm. (It would kind of defeat the purpose to run an `O(n log n)` sort to avoid an `O(n)` update.) Instead, we can achieve this by judicious swapping.

When a node becomes dirty we move it to the start of the dirty list by swapping it with the element before the dirty list and decreasing `first_dirty`:

```
                                 =============== dirty ==============
|   |   |   | D |   |   |   | X |   |   |   |   |   |   |   |   |   |

                             ================= dirty ================
|   |   |   | X |   |   |   | D |   |   |   |   |   |   |   |   |   |
```

We do the same for all children of the node and the children's children, etc.

As we process the items in the dirty array, whenever we find a child that has its parent at a later position in the array, we swap the child and the parent.

```
                             ================= dirty ================
|   |   |   |   |   |   |   |   |   |   | C |   |   | P |   |   |   |
                                          ^

                             ================= dirty ================
|   |   |   |   |   |   |   |   |   |   | P |   |   | C |   |   |   |
                                          ^
```

This guarantees that parents are always processed before their children.

We also need a way to move items off the dirty list, or it will continue to grow indefinitely. We could clear the list every frame, but that might lead to a lot of swapping as items are moved in and out of the list. A better approach might be to check if an item hasn't moved in five frames or so, and in that case we move it off the dirty list. This avoids swapping those items which are always moving.

When using the *immediate* update strategy, sorting the list is not as important, but we can employ similar swapping strategies to make sure that a parent node and its children are kept close together in the array, so that the immediate update is cache friendly.

## Implementation

With the design thought through, there is really not that much to the implementation.

Just as in the [last post](http://http://bitsquid.blogspot.se/2014/09/building-data-oriented-entity-system.html), we store the transform component data for all instances in a single big memory block:

```cpp
struct Instance {int i;};

/// Instance data.
struct InstanceData {
    unsigned size;              ///< Number of used entries in arrays
    unsigned capacity;          ///< Number of allocated entries in arrays
    void *buffer;               ///< Raw buffer for data.

    Entity *entity;             ///< The entity owning this instance.
    Matrix4x4 *local;           ///< Local transform with respect to parent.
    Matrix4x4 *world;           ///< World transform.
    Instance *parent;           ///< The parent instance of this instance.
    Instance *first_child;      ///< The first child of this instance.
    Instance *next_sibling;     ///< The next sibling of this instance.
    Instance *prev_sibling;     ///< The previous sibling of this instance.
};
```

The `parent`, `first_child`, `next_sibling` and `prev_sibling` arrays all store instance indexes. We can find all the children of a particular entity by following the `first_child` link and then the `next_sibling` links of that link.

We can use that to do the immediate transform update:

```cpp
void TransformComponent::set_local(Instance i, const Matrix4x4 &m)
{
    _data.local[i.i] = m;
    Instance parent = _data.parent[i.i];
    Matrix4x4 parent = is_valid(parent) ? _data.world[ parent.i ] :
        matrix4x4_identity();
    transform(parent, i);
}

void TransformComponent::transform(const Matix4x4 &parent, Instance i)
{
   _data.world[i.i] = _data.local[i.i] * p;

    Instance child = _data.first_child[i.i];
    while (is_valid(child)) {
       transform(_data.world[i.i], child);
    child = _data.next_sibling[child.i];
}
```

*Note:  I've written this as a recursive function for easier reading, but you might want to rewrite it as an iterative function for better performance.*

Note that when you swap two instances in the array (to do swap-erase or to sort the array as described above), in addition to swapping the entries in the array you also need to take care to keep all the `parent`, `first_child`, `next_sibling` and `prev_sibling` references intact. This can get a little hairy, especially when you are changing references and trying to walk those lists of references at the same time. My suggestion when you want to swap two instances `[A]` and `[B]` is to use the element at the end of the array `[size]` as a temporary storage slot and instead of trying to do everything at once, use three steps:

```
// Move element at A (and references to it) to size.
[size] <--- [A]

// Now nothing refers to A, so we can safely move element at B (and references
// to it) to A.
[A] <--- [B]

// And finally move the element at size to B.
[B] <-- [size]
```

In the next post I'll look at compiling entities into resource files.
