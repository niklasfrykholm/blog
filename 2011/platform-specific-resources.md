# Platform Specific Resources

I recently added a new feature to the BitSquid tool chain – support for source and destination platforms in the data compiler. What it means is that you can take the data for one platform (the source) and compile it to run on a different platform (the destination). So you can take the data for the mobile version of a game (with all its content optimizations) and compile it so that it runs on your development PC.

This is nice for two reasons. First, access to target hardware can be limited. In a perfect world, every artist would have a dev kit for every target platform. In practice, this might not be economically possible. It might not even be *electrically* possible (those main fuses can only take so much). Being able to preview and play console/handheld content on PC is better than nothing, in this less-than-perfect world.

Second, since all our editors use the engine for visualization, if we have specified a handheld device as our source platform, all the editors will automatically show the resources as they will appear on that device.

This new feature gives me a chance to talk a little bit about how we have implemented support for platform specific resources, something I haven’t touched on before in this blog.

The BitSquid Tech uses the regular file system for its source data. A resource is identified by its name and type, both of which are determined from the path to the source file:

![resource name](platform-specific-resources-1.png)

Note that even though the name is a path, it is not treated as one, but as a unique identifier. It is hashed to a 64-bit integer by the engine and to refer to a resource you must always specify its full name (and get the same hash result). In the compiled data, the raw names don’t even exist anymore, the files are stored in flat directories indexed by the hash values.

In addition to name and type a resource can also have a number of properties. Properties are dot-separated strings that appear before the type in the file name:

![properties](platform-specific-resources-2.png)

Properties are used to indicate different variants of the same resource. So all these files represent variants of the same resource:

```
buttons.texture
buttons.ps3.texture
buttons.en.x360.texture
buttons.fr.x360.texture
```

The two most important forms of properties are platforms and languages.

*Platform properties* (x360, ps3, android, win32, etc) are used to provide platform specific versions of resources. This can be used for platform optimized versions of units and levels. Another use is for controller and button images that differ from platform to platform. Since BitSquid is scripted in Lua and Lua files are just a resource like any other, this can also be used for platform specific gameplay code:

```
PlayerController.android.lua
```

*Language properties* (en, fr, jp, it, sv, etc) are used for localization. Since all resources have properties, all resources can be localized.

But the property system is not limited to platforms and languages. A developer can make up whatever properties she needs and use them to provide different variants of resources:

```
bullet_hit.noblood.particle_effect
foilage.withkittens.texture
```

Properties can be resolved either at data compile time or at runtime.

Platform properties are resolved at compile time. When we compile for PS3 and a resource has ps3 specific variants, only those variants are included in the compiled data. (If the resource doesn’t have any ps3 variants, we include all variants that do not have a specified platform.)

Language properties and other custom properties are resolved at runtime. All variants are compiled to the runtime data. When running, the game can specify what resource variants it wants with a *property preference order*. The property preference order specifies the variants it wants to use, in order of preference.

```
Application.set_property_preference_order {”withkittens”, ”noblood”, ”fr”}
```

This means that the game would prefer to get a resource that has lots of kittens, no blood and is in French. But if it can’t get all that, it will rather have something that is kitten-full than blood-free. And it prefers a bloodless English resource to a bloody French one.

In other words, if we requested the resource *buttons.texture* with these settings, the engine would look for variants in the order:

```
buttons.withkittens.noblood.fr.texture
buttons.withkittens.noblood.texture
buttons.withkittens.fr.texture
buttons.withkittens.texture
buttons.noblood.fr.texture
buttons.noblood.texture
buttons.fr.texture
buttons.texture
```

To add support for different source and destination platforms to this system all I had to do was to add a feature that lets the data compiler use one platform for resolving properties and a different platform as the format for the runtime files it produces.