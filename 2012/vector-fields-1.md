# A Data-Oriented, Data-Driven System for Vector Fields - Part 1

A *vector field* is a function that assigns a vector value to each point in 3D space. Vector fields can be used to represent things like *wind* (the vector field specifies the wind velocity at each point in space), water, magnetism, etc.

To me, wind is the most interesting use case. I want a system that can be used for physics (trees, tumble weed, paper cups), particles (leaves, sparks, smoke) and graphics (grass). I also want the system to be capable of handling both global effects (wind blowing through the entire level) and local effects (explosions, air vents, landing helicopters, rising hot air from fires, etc). But I don't want to limit the system to *only* handling wind. I imagine that once the system is in place, it could be put to other interesting uses as well.

There are a number of things that make this an interesting non-trivial design challenge:

* Vector fields represent a global shared state. All systems (particles, physics, etc) should react to the same wind. This can create strong couplings between unrelated systems, which we want to avoid.

* The system must be fast. We want to be able to make large particle effects that are affected by wind. As a design goal, let's say that it should be able to handle at least 10 000 queries / frame.

* As stated above, the system must be flexible enough to handle both global wind and a large variety of different local effects (air vents, fans, etc).

I'll outline the system in a series of articles. Let's start by thinking a bit about how we can represent the vector field in a way that allows for fast queries.

## 1. Use a functional representation

Storing the vector value for every point in 3D space at a decent resolution would require huge amounts of memory. It would also be very expensive to update. If we wanted to change the global wind direction, we would have to loop over all those points and change the value.

So, instead, we will use a functional representation. We will express the field as some closed function *F(p, t)* that gives us the field vector at point *p* in space at the time *t*.

For example, we could express a global wind that oscillates in the x-direction as:

```
F(p, t) = Vector3(sin(t), 0, 0)
```

The closed function form allows us to evaluate the vector field at any point in space and time.

Note that even with a functional form as the main representation, we can still interact with grid based representations. For example, we can render some section of the *F(p, t)* function to a texture for use on a GPU. Similarly, if we have some grid based wind data that we want to add to the simulation, we could use that as part of the *F(p, t)* expression:

```
F(p, t) = Vector3(sin(t), 0, 0) + sample_grid(grid, p)
```

## 2. Ignore the time coordinate

The vector field function *F(p, t)* is a function of both space *and* time. The wind varies throughout the level and if we look at any one point, the wind at that point varies over time.

But in practice, we treat the *p* and *t* coordinates very differently. We start at some time *t_0* and then evaluate *F(p, t_0)* for thousands of different *p* values. Then we move on to *t_1* and do the same thing.

We can make use of the fact that *t* remains constant for a large number of evaluations to simplify the function. For example at *t=0.5* the function:

```
F(p, t) = sin(p.x) * sin(p.y) * cos(t)
```

simplifies to:

```
G(p) = sin(p.x) * sin(p.y) * 0.8776
```

which is cheaper to evaluate.

Taking this approach a step further, it makes sense to split our system in two parts -- a high level system that knows about time and every frame produces a new *G(p)* for the current time, and a low level system that ignores time completely and just computes *G(p)*. Since the high level system only runs once per frame it can afford to do all kinds of complicated but interesting stuff, like constant folding, optimization, etc.

For the low level system we have reduced the problem to evaluating *G(p)*.

## 3. Express the field as a superposition of individual effects

To make it possible for the field to contain both global effects (world wind) and local effects (air vents, explosions) we express it as a superposition of individual effect functions:

```
G(p) = G_1(p) + G_2(p) + ... + G_n(p)
```

Here *G_i(p)* represents each individual effect. A base wind could be expressed as just a constant:

```
G_0(p) = Vector3(2.1, 1.4, 0)
```

A turbulence function could add a random component

```
G_1(p) = turbulence(seed, p, 4)
```

An explosion effect could create a wind with a speed of 100 m/s outwards from the center of the explosion in a sphere with radius 4.0 meter around the explosion center:

```
G_2(p) = sphere(p,c,4) * normalize(p-c) * 100
```

Here *sphere(p,c,4)* is a spherical support function that defines the range of the effect. It is *1* if *||p - c|| <= 4.0* and *0* otherwise.

Note again that we have stripped out the time component. At the higher level, this might be an expanding sphere with decreasing wind speeds, but at the low level we only care what it looks like at this instance.

Similar functions can be added for other local effects.

## 4. Use the AABB to cull local fields

If we have a lot of local effects (explosions, etc), evaluating *G(p)* will be pretty expensive.

We can reduce the cost by only evaluating the local effects that are close enough to our particle system to matter.

I.e., instead of evaluating *G(p)* for all particles, we first intersect the AABB of each *G_i(p)*'s support with the AABB of our particle system.

That gives us a simpler function *G'(p)* that we can then evaluate for each particle.

If we wanted to, we could use the wavelength of the field for further simplifications. If the scale at which a field effect changes is much larger than our AABB, we can replace that effect with a Taylor series expansion. Similarly, if an effect oscillates at a scale much smaller than the size of our particles, we can replace it with its average value.

### Next time

Next time I will look at how we can efficiently evaluate arbitrary functions, such as:

```
G(p) = Vector3(1,1,0) + turbulence(seed, p, 2) + sphere(p, c, 4)
```

for a huge number of particle positions *p*.
