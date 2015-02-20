# A Data-Oriented, Data-Driven System for Vector Fields -- Part 3

In this post, I'll finish my series on [vector fields](http://en.wikipedia.org/wiki/Vector_field) (see [part 1](http://www.altdevblogaday.com/2012/09/17/a-data-oriented-data-driven-system-for-vector-fields-part-1/) and [part 2](http://www.altdevblogaday.com/2012/10/02/a-data-oriented-data-driven-system-for-vector-fields-part-2/)) by tying up some loose ends.

Quick recap of what has happened so far:

* I've decided to represent my vector fields in functional form, as a superposition of individual effect functions *G_i(p)*.

* I represent these functions in bytecode format, as a piece of bytecode that given an input position *p* computes a vector field strength *F_i*.

* By running each step of the virtual machine over a thousands of input points, the cost of decoding and interpreting the bytecode instructions is amortized over all those points.

* This means that we get the bytecode decoding "for free" -- the bytecode can run at nearly native speed.

## Bytecode format

In the last article I didn't say much about what format I used for the bytecode. Generally speaking, designing a bytecode format can be tricky, because you have to balance the *compactness* (keeping programs short) against the *decoding cost* (keeping bytecode fast).

Lucky for us, we don't care about either of these things. *Compactness* doesn't matter, because our programs will be very short anyway (just a few instructions). *Decoding cost* doesn't matter (much), because it is amortized.

When it doesn't really matter I always pick the simplest thing I can think of. In this case it is something like:

```
(instruction) (result) (argument-1) (argument-2)
```

Here, *instruction* is a 4-byte instruction identifier. *result* is a 4-byte channel identifier that tells us which channel the result should be written to. *argument-1* and *argument-2* are either channel identifiers or Vector4's with constant arguments. (Instructions of higher arity would have more arguments.)

Note that using 4 bytes for instructions and registers is beyond overkill, but it is the simplest option.

One annoyance with this representation is that I need different instructions depending on whether *argument-1* or *argument-2* is constant. For a 2-arity instruction, I need four variants to cover all cases. For a 4-arity instruction (such as *select)*, I would need 16 variants.

There are two ways of dealing with this. First, I could make the code that executes each instruction a bit more complex, so that it can handle both constant and register arguments. Second, I could make all instructions operate only on registers and have a single instruction for loading constants into registers.

Unfortunately, both of these option results in significantly slower bytecode. In the first case, the extra logic in each bytecode executor makes it slower. In the second case, we need extra instructions for loading constants, which increases the execution time.

So at least for two argument functions, the best option seems to be to have separate code for handling each argument combination. For four argument functions, it might be better to use one of the other options.

Just to give you some example of how the bytecode works, here is some raw byte code and the corresponding disassembled bytecode instructions:

```
05000000 02000000 00000000 00000000000020410000000000000000
r2 = sub          r0       (0,10,0,0)

16000000 03000000 00000000000000000000803f00000000 02000000
r3 = cross        (0,0,1,0)                        r2

0a000000 04000000 00002041000020410000204100002041 03000000
r4 = mul          (10,10,10,10)                    r3

10000000 03000000 02000000 02000000
r3 = dot          r2       r2

0c000000 05000000 04000000 03000000
r5 = div          r4       r3

09000000 03000000 05000000 0000a0400000a0400000a0400000a040
r3 = mul          r5       (5,5,5,5)

00000000  01000000  01000000  03000000
r1 = add            r1        r3
```

## High-level language

You can't really expect people to author their effects in raw bytecode, or even in our "bytecode assembly language". Effect authors will be a lot more productive if they can use a more comfortable language.

I decided to create such a language and model it after [HLSL](http://en.wikipedia.org/wiki/High_Level_Shader_Language), since it serves a similar purpose (fast processing of vectorized data). Programmers interested in writing vector field effects are probably already used to working with HLSL. Plus, if at some point we want to move some of this work to the GPU we can reuse the code.

To show what the high level language looks like, here is an implementation of a whirl effect:

```
const float4 center = float4(0,10,0,0);
const float4 up = float4(0,0,1,0);
const float4 speed = float4(10,10,10,10);
const float4 radius = float4(5,5,5,5);

struct vf_in
{
    float4 position : CHANNEL0;
    float4 wind : CHANNEL1;
};

struct vf_out
{
    float4 wind : CHANNEL1;
};

void whirl(in vf_in in, out vf_out out)
{
    float4 r = in.position - center;
    out.wind = in.wind + speed * cross(up, r) / dot(r,r) * radius;
}
```

If you squint, you may notice that this high level code exactly corresponds to the low level bytecode in the previous
example.

Just as with HLSL, although this *looks* like C it actually *isn't* C. Things that work in C may not work in this language and vice versa. I'm quite strict when I parse this. I figure it is better to be start by being strict rather than permissive. This gives you more leeway to extend or modify the language later while keeping backwards compatibility. A strict syntax can always be loosened later, but if you design the language with a too permissive syntax you can paint yourself in a corner (case in point: Ruby).

I usually don't bother with [Lex](http://en.wikipedia.org/wiki/Lex_(software)) or [Yacc](http://en.wikipedia.org/wiki/Yacc) when I write a parser. They are OK tools, I guess, but if I can get by without them I prefer not to have the extra precompile step and to have code that is a bit more straightforward to read and debug.

Instead I tend to use a [recursive descent parser](http://en.wikipedia.org/wiki/Recursive_descent_parser) (a predictive variant, with no backtracking) or some variation of [Dijkstra's shunting yard algorithm](http://en.wikipedia.org/wiki/Shunting-yard_algorithm). Or sometimes a combination of both.

For this language I parse the overall structure with recursive descent, and then use Dijkstra's algorithm to process each statement in the function body.

I generate the bytecode directly from the shunting yard algorithm. When I pop an operator from the operator stack I generate the bytecode for computing that operator and storing the result in a temporary register. I then push that register to the value stack so that the result can be used in other computations. Temporary channels are recycled after they are popped of the value stack to minimize the channel count.

## Constant patching

Constants in the bytecode can be changed when an effect is played. I do this by directly patching the bytecode with the new constant values.

When I generate the bytecode I keep track of where in the bytecode different global constants can be found. This *patch* list is a simple array of entries like:

```
(hashed constant name) (offset in bytecode)
```

When playing a vector field effect, the gameplay programmer specifies the constant values with a table:

```
VectorField.add(vf, "whirl", {radius = 10})
```

I look through the patch list, find all the offsets of constants named "radius" and replace them with the value(s) supplied by the gameplay programmer.

Since globals can be patched later, I can't do constant folding when I generate the bytecode. (Without global patching, I could just check if both arguments were constants when I popped an operator, and in that case, compute the constant result and push that directly to the value stack, instead of generating a bytecode instruction.)

I could reduce the instruction count somewhat and improve performance by doing a constant folding pass on the bytecode *after* the globals have been patched, but I haven't implemented that yet.

## Physics integration

In my physics system I maintain a list of all awake (non-sleeping) actors. I apply wind from a vector field with an explicit call:

```cpp
void apply_wind(const VectorField &field, const CollisionFilter &filter);
```

This extracts the position of every awake actor that matches the collision filter and sends that list to the vector field for evaluation. It then does a second loop through the actors to apply wind forces from the returned wind velocities.

I've chosen to have an explicit step for applying wind, so that you don't have to pay anything for the wind support unless you actually use it. Having an explicit step also opens up the possibility to have other types of vector fields. For example, there could be a vector field representing gravity forces and a corresponding function:

```cpp
void apply_acceleration(const VectorField &field, const CollisionFilter &filter);
```

The fact that the wind is only applied to *awake* actors is important. Without that check, the wind forces would keep every actor in the world awake all the time, which would be really expensive for the physics engine. Just as with gravity, we want physics objects to come to rest and go to "sleep" when the wind forces are in balance with other forces on the actor.

This of course creates a problem when the wind forces are varying. An actor may be in balance now, but a change in the wind direction could change that. A leaf that is resting on the ground may be lifted by a sudden updraft. Since we don't apply the wind forces to sleeping object we can't get that behavior. Once a leaf has come to rest, it will stay put.

This problem is most noticeable when you have drastic effects like explosions in the vector field. It looks really strange when actors are completely immobile and "sleep through" a big explosion.

I deal with this by having a function for explicitly waking actors in an AABB:

```cpp
wake_actors(const Vector3 &min, const Vector3 &max, const CollisionFilter &filter)
```

If you want to play a drastic wind effect (like an explosion), you should first wake the nearby actors with a call to *wake_actors()*. This ensures that all nearby actors will get the wind forces from the explosion (since they are now awake).

I apply the wind force with the standard formula:

```
F = 1/2 r v^2 C A
```

Where *r* is the density of air, *v* is the relative velocity of the air with respect to the object (so *v = v_wind - v_object*, where *v_wind* is the wind speed and *v_object* is the object's speed). *C* is a drag coefficient that depends on the object's shape and *A* is the object's reference area.

For *C* and *A*, I actually loop through all the physics shapes in the actor and estimate *C* and *A* based on those shapes. This is by no means a perfect approach. There are many situations where *C* might be really different from what such an estimation gives. For example, an object that is heavily perforated would receive much less wind force.

However, I want to have something in place that gives decent behavior in *most* cases, so that it only very rarely has to be changed. The less artists have to mess around with physical parameters, the smaller is the chance that anything gets messed up.

Note that the wind force is just air resistance with a velocity for the air. So by implementing wind you get the "air resistance" behavior "for free".

## Rotation

If you compute the drag force using the formula above and apply it to a physics actor, it won't add any rotation to the actor. This is actually correct. The drag force, as we compute it here, has no rotational component.

Yet it feels counter-intuitive. We expect objects to rotate when they are blown about by the wind. Leafs and papers certainly swirl around a lot when the wind blows.

What happens in that case is actually a second order effect. When the wind blows around an object you get zones of high and low pressure as well as turbulence, and it is the forces from these interactions that affects the object's rotation.

These interactions are  tricky to model accurately and they depend a lot on the object's shape. Right now, I'm not even trying. Instead I use a much simpler approach: I apply the drag force a bit above the object's actual center of mass so that it produces a torque and makes the object rotate. This is a complete hack that has no basis at all in physical reality, but it does add some rotation. At least it looks a lot better than applying the wind force without any rotation.

It should be possible to do better -- to make some kind of estimate of what rotational forces wind induces when it blows against typical physics shapes: boxes, spheres, capsules, etc. Just give my a couple of days in a wind tunnel and I'll try to come up with something.
