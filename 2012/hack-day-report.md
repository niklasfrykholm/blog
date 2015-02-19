# Hack Day Report

Last Friday, we had our second *hack day* (aka *do-what-you-want day*, aka *google day*) at the office.

Different companies seem to take different approaches to hack days. At some places it just means that you can spend a certain percentage of your working week on your own projects. We wanted something that was a bit more focused and felt more like a special event, so we used the following approach:

* People were encouraged to pick tasks that could be completed, or taken to a "proof-of-concept" level in a single day. The goal was that at the end of the day you should have something interesting to *show/tell* your colleagues.

* It is ok to fail of course. Failure is often interesting. Trying crazy ideas with a significant risk of spectacular failure is part of the charm of a hack day.

* A couple of days before the event, everbody presented their projects. The idea was to get every to start thinking about the topics, so that we could help each other with ideas and suggestions.

* We ate breakfast together in the morning to start the discussions and get everybody in the spirit of the event. At the end of the day, we rounded off with a couple of beers.

* We avoided Skype, email and meetings during the day, so that wd could focus 100 % on the projects.

* A couple of days after the events we had a small show &amp; tell, where everybody could present what they had learned.

## Results

A number of interesting projects came out of this hack day:

* Tobias and Mats created an improved highlighting system for indicating selected objects in the level editor. (Highlighting the OOBB works well for small objects, but for big things like landscapes and sub-levels, it is just confusing.)

* Jim looked into a cross-platform solution for capturing screen shots and videos on target machines and transmitting them over the network.

* Andreas created a Lua profiling tool, that can dynamically enable and disable profiling for any Lua function by hot-patching the code with profiler calls.

* Finally, I rewrote the collision algorithm for our particle systems.

Being an egotistical bastard, I will focus on my own project.

Particle collision is one of those annoying things that it is difficult to find a good general solution to, for two reasons:

* It ties together two completely different systems (particles and physics), creating an ugly coupling between them. Since the solution must have decent performance, the coupling must be done at a fairly low level, which makes it even worse.

* Particles can have *very* different collision requirements. Some effects need a massive amount of particles (e. g. sparks), but doesn't care that much about collision quality. As long as *most* of them bounce *somewhat* accurately, it is OK. Other effects may have just a single particle (e. g. a bullet casing). Performance doesn't matter at all, but if it doesn't bounce right you will surely notice. Handling both effects in the same system is a challenge. Having different systems for different effects is another kind of challenge.

My previous attempts at implementing particle collision have all been based on first cutting out a slice of the physics world around the particle effect and then trying to find a fast representation of the collision shapes in that world slice.

The problem with this approach is that there are a lot of variables to tweak and tune:

* How big should the world slice be?
* How much detail should there be in the simplified representation? More detail is slower, but gives better collision results.
* What kind of representation should we use?
* How should we handle dynamic/moving objects? How often should the world slice be updated?

I've tried a lot of different representations: a triangle soup, a collection of half-spheres, a height field, but none of them has given completely satisfactory results. Often, parameters that work for one effect at one location fail for a different effect at a different location. Both performance and behavior are hard to predict.

The main idea for the new approach came from a Naughty Dog presentation at GDC. Instead of trying to create a shared collision model for all particles, we give each particle *its own* collision model, and we store it inside the particle itself, together with the other particle data.

Of course, it would be expensive to store a complicated collision model inside every particle, so we use the simplest model possible: a plane. We can represent that by a normal and an offset from origin. So with this approach, the data for a particle might look something like this:

```cpp
struct Particle {
	Vector3 position;
	Vector3 velocity;
	Color8 color;
	Vector3 collision_plane_normal;
	float collision_plane_offset;
};
```

(Side note: Our particle data doesn't actually look like this, we use a "structure-of-arrays" approach rather than an "array-of-structures" and we don't have a fixed set of fields, each effect has its own set.)

Note that we don't bother with any flag for indicating whether there is plane or not. If there is no collision, we just put the collision plane far enough below the origin.

With this approach the collision test is super fast -- just a dot product and a compare. It is also really easy to parallelize the test or run it off-CPU, since it just uses local particle data and doesn't need to access any share memory.

With this method we have divided the original collision problem into two simpler ones:

* Collision test against a plane. (Trivial.)
* Finding a suitable collision plane for each particle.

This means that if we want to, we can use different approaches for finding the collision planes for different effects. E.g., for static effects we could hard code the collision plane and avoid collision queries completely.

Generally, we can find a suitable collision plane for a particle by raycasting along its trajectory. If we didn't have any performance constraints, we could do a raycast for every particle every frame. That way we would always know what surface the particle would hit next, which means that we would get perfect collision behavior.

Of course, we can't *actually* do that. Raycasts are comparatively expensive and we want to be able to support large numbers of particles.

To control the performance, I exposed a parameter that lets the effect designer control how many raycasts per frame an effect is a allowed to make. A typical value of 1.0 means that every frame, one particle in the effect is picked at random, a raycast is performed along that particles trajectory and its collision plane is updated with the result.

Note that with this solution, the work is always evenly distributed over the duration of the effect. That is a lot nicer than what you typically get with the "world slice" approach where there is a big chunk of work in the beginning when you cut out the world slice and process it to something simpler. 

Astute readers will have noticed a fatal flaw with the design as it has been presented so far: it can't possibly work for very many particles. If we have an effect with 1 000 particles and do a raycast every frame, it will take 33 seconds before every particle has found its collision normal. By then, they will long since have fallen through the floor.

So, if we want to use this approach for large numbers of particles we must be able to somehow reuse the collision results. Typically, an effect will have bundles of particles traveling in approximately the same direction. When one such particle has done a raycast and found a collision, we want to be able to share the result with its neighbors somehow.

I wanted to find a solution to this without having to create a complicated collision representation, because that would bring back many of the problems I had with the "world slice" approach. Eventually, I decided that since what we want to do is to cache a collision query of the form:

```
(position, direction) -> collision_plane
```

The simplest possible thing would be to store the results in a hash. Hashes are nice, predictable data structures with well known performance characteristics.

To be able to hash on position and direction we must quantize them to integer values. We can quantize the position by dividing the world into cells of a certain width and height:

```cpp
const float cell_side = 0.5f;
const float cell_height = 2.0f;
int ix = position.x / cell_side;
int iy = position.y / cell_side;
int iz = position.z / cell_height;
uint64 key = HASH_3(ix, iy, iz);
```

In this example, I use a higher resolution along the xy-axes than along the z-axes, because typically that is where the more interesting features are. `HASH_3()` is a macro that performs the first three rounds of the *murmur_hash* algorithm.

To quantize the direction we can use a similar approach. I decided to quantize the direction to just six different values, depending on along which principal axis the particle is mostly traveling:

```cpp
unsigned id;
if (fabsf(dir.x) >= fabsf(dir.y) &amp;&amp; fabsf(dir.x) >= fabsf(dir.z))
	id = dir.x > 0 ? 0 : 1;
else if (fabsf(dir.y) >= fabsf(dir.z))
	id = dir.y > 0 ? 2 : 3;
else
	id = dir.z > 0 ? 4 : 5;
key = key ^ id;
```

Now that we have computed a quantized representation of *(position, direction)*, we can use that as lookup value into our hash, both for storing and fetching values:

```cpp
struct CollisionPlane {
	Vector3 normal;
	float offset;
};
HashMap&lt;uint64, CollisionPlane> _cache;
```

(Side note: Unless I'm worried about hash function collisions, I prefer to hash my keys *before* I insert them in the *HashMap* and just use a `HashMap&lt;uint64,T>` instead of `HashMap&lt;MyComplicatedKeyStruct,T>`. That way the hash map uses less memory and lookups can be done with a simple modulo operation.)

Whenever I do a particle raycast I store the result in the cache. When particles are spawned they lookup their collision plane in the cache. Particles also query the cache every time they bounce, since that typically means they will be traveling in a new direction.

I have a maximum size that the cache is allowed to use. When the cache reaches the maximum size, older entries are thrown out.

## Results

The system gives high quality results for effects with few particles (because you get lots of raycasts per particle) and is still able to handle massive amounts of particles. The performance load is evenly distributed and it doesn't need any special cases for dynamic objects.

There are some drawbacks. The cache requires some tweaking. Since it can only store one collision plane for each quantization cell it will miss important features if the cells are too big. On the other hand, if the cells are too small, we need lots of entries in the cache to represent the world, which means more memory and slower lookups.

Since we only have one collision normal per particle, there are some things that the particles just can't do. For example, they can never come to rest at the bottom of a V-shape, because they will always only be colliding with one of the planes in the V. Overall, they will behave pretty badly in corners, where several collision planes with different normals meet. Some of these issues could be fixed by storing more than one collision plane in the particle, but I don't think it is worth it. I prefer the simpler approach and having particles that in some tricky situations can fall through the ground.

Compared to the old collision code, the new code is simpler, runs faster and looks better.

All in all, I would say that the hack day was a success. We had great fun and produced some useful stuff. We will definitely do more days like this in the future.

Not too often though. I think it is important that these days feel like a special treat and that there is enough time to process the results. If they become too mundane, something important is lost. Once a month or so, would be ideal, I think.
