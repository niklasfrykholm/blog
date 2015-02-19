# Building a Data-Oriented Entity System (Part 5: Prefabs)

In the last post I talked about how to compile and spawn entity resources, but I didn't actually say anything about what an entity resource looked like *before* compilation. It is not that complicated:

```json
components = {
    "<<GUID>>" = {
        type = "<<Component type>>"
        // Type specific data
    }
    ...
}

children = {
    "<<GUID>>" = {
        // Entity definition
    }
    ...
}
```

As for all other resources in the engine, we use a simplified JSON format (we call it SJSON) for our input data. SJSON is a backwards-compatible extension of JSON that makes it a bit easier for humans to read and write:

* `{}` is optional for the root object
* `=` can be used instead of `:`
* Commas are optional
* Quotes around string keys are optional
* C and C++ style comments are supported
* Triple-quoted "literal" strings are supported

The entity definition is just a list of components and children. Each component and each child is identified by a GUID.

A `type` field identifies the type of the component and the rest of the component data is type-specific. The *transform* component, for instance, looks like this:

```json
"c80f6004-427f-4662-a705-b89fef7abae7" = {
    type = "transform"
    pos = [0 0 0]
   
}
```

The children of an entity are themselves entities, so they use the same definition that we use for the root entity (`components` and a `children` tables). This applies recursively for childrens' children, etc.

Here is a concrete example of an entity with *mesh* and *transform* components and no children:

```json
components = {
    "c80f6004-427f-4662-a705-b89fef7abae7" = {
        type = "transform"
        pos = [0 0 0]
       
    }
    "86cbf596-8a55-492e-a03b-5761b5e80000" = {
        type = "mesh"
        scene = "scenes/box"
        mesh = "g_box"
        shadow_caster = true
        material_map = {
            default = {
                resource = "scenes/box"
            }
        }
    }
    
}
```

Our data compiler compiles this to an efficient binary resource using the methods described in the previous article.

Note that we use objects indexed by GUIDs rather than arrays for the lists. The reason is that changes to objects are easy to merge (changes to one key made by one person can be easily merged with changes to another key made by another person). This is good for soruce control, collaboration and other things as well. We try to design our JSON formats so that arrays are always treated as "blobs",

In the current design, a level file contains a list of entities:

```json
entities = {
    <<GUID> = {
        // Entity defintiion
    }
    ...
}
```

In a future iteration, we will probably get rid of the level format completely and just make the level an entity. The entities in the level will be children of the level entity.

# Prefabs

In addition to this, we also want some way of defining shared, reusable entities. I.e., we want to be able to make a tree that we can place at a bunch of places in a lot of different levels and then change all those instances of the tree, just by changing the definition of the tree.

In other words, we want prefabs.

In the Bitsquid engine, a prefab is just an entity resource, just like any other. To use a prefab for an entity we specify a prefab field in the entity resource that points to the prefab resource:

Here is a level that contains three boxes:

```json
entities = {
    <<GUID>> = {prefab = "entities/box"}
    <<GUID>> = {prefab = "entities/box"}
    <<GUID>> = {prefab = "entities/box"}
}
```

Note that if you loaded this level, you wouldn't actually *see* three boxes, because all the boxes have a *TransformComponent* that places them at `[0 0 0]`, so there would just be three boxes in exactly the same place.

For prefabs to be useful, an entity that uses a prefab must be able to make local modifications to the components in the prefab. Modifications that only affect that particular entity. For instance to change the transform position.

What else in the prefab do we want be able to override in the entity. Preferably anything. Breaking the link between an entity and its prefab will disrupt the user's workflow, so we should never do that unless explicitly asked. The user should be able to make all kinds of possible modifications without breaking that link:

* Modifying any field in the prefab's components
* Adding new components
* Deleting components from the prefab
* Modifying any of the prefab's child objects
* Adding new child objects
* Deleting child objects

This gives us the following layout for the entity resource:

```json
prefab = "<<prefab resource>>"

components = {
    <<GUID>> = {
        type = "<<type>>"
        // component data
    }
    ...
}

modified_components = {
    <<GUID>> = {
        // component overrides
    }
    ...
}

deleted_components = {
    <<GUID>> = {}
    ...
}

children = {...}
modified_children = {...}
deleted_children = {...}
```

`prefab` specifies the prefab resource. The entity will by default get all the components and children from the prefab. This applies recursively, the prefab resource may in turn define its own prefab, etc.

`components` contains new components added to the entity, in addition to those that were found in the prefab.

`modified_components` changes components in the prefab by overriding their data fields. The GUID should match the GUID of a component in the prefab (or the prefab's prefab). Any field specified will override the value of that field from the prefab.

`deleted_components` specifies components from the prefab that should not exist for this entity.

`children`, `modified_children` and `deleted_children` work in the same way. Again, changes are applied recursively, so if you wanted to change a component of a child you would put a `modified_components` section inside the `modified_children` section for that child.

So overriding the transform position in the box entity to place it at a different location would look like this

```json
prefab = "entities/box"

modified_components = {
    "c80f6004-427f-4662-a705-b89fef7abae7" = {
        pos = [0 0 0]
    }
}
```

Note that we don't have to specify the `type` field for the modified component, because that is already known from the prefab.

# Compiling entities with prefabs

To compile an entity with prefabs we want to produce a "merged" view of the entity. I.e., a view that includes all the components and the children from the entire chain of prefabs, taking into account any modifications done in the `modified_components` section, deletes done in the `deleted_components` section, etc.

The simplest way of thinking about this is as a series of operations being performed on an in-memory representation of a JSON object.

To get the JSON representation of an entity, we would then first get the JSON representation of its prefab, then we would add the components defined in `components`, delete the components from `deleted_components` and apply the modifications from `modified_components` and to the same thing for the children.

Of course the process would apply recursively, so if the prefab had a prefab of its own, we would use the same procedure to get the "flattened" JSON representation of the prefab.

Note that if you use this approach, you definitely want to use some kind of memoization scheme so that you don't end up opening and parsing the same prefab files again and again for thousands of entities in a level.
