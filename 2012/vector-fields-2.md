# A Data-Oriented, Data-Driven System for Vector Fields -- Part 2

In [Part 1](http://www.altdevblogaday.com/2012/09/17/a-data-oriented-data-driven-system-for-vector-fields-part-1/) we decided to represent a vector field as a superposition of individual effects:

```
G(p) = G_0(p) + G_1(p) + ... + G_n(p)
```

Here, each *G_i(p)* is a function that represents some effect, such as wind, an explosion or the updraft from an air vent.

The next step is to find a way of quickly evaluating the function *G(p)*, a general function that could be almost anything, for lots of different positions *p_i*. This is quite tricky to do well in C++.

Of course, evaluating *specific* functions is not hard. If we want to evaluate a specific function, such as:

```
Vector3(sin(p.x), sin(p.y), 0);
```

we can just type it up:

```
inline Vector3 f(const Vector3 &p)
{
	return vector3(sin(p.x), sin(p.y), 0);
}
```

But if we don't know beforehand what *G(p)* will be we don't have that option.

We could write our system so that it supported a limited set of specific effects, with hardcoded C++ implementations. For example, there could be an "explosion" effect with some parameters (radius, strength, etc), an "updraft" effect, a "whirl" effect, etc. Similarly we could have support for a variety of standard shapes, such as "sphere", "cylinder", "capsule", etc. And perhaps some different types of falloffs ("linear", "quadratic"). Perhaps also some temporal effects ("attack-sustain-release", "ease-in-ease-out").

But it is hard to know where to draw the limit with this approach. Exactly what effects and shapes and falloffs and time curves should the system support? The more things we add, the more cluttered the system becomes. And the system is still not completely general. No matter how much we add, there will still be some things that the user just *can't* do, without disturbing a programmer and get her to add a new effect to the system. This means that the system is not *truly* data-driven.

Whether this is a problem or not depends a lot on your development style. If you are a single artist-programmer working on a single game you may not even care. To you code and data is the same thing. Who cares if you have to add something to the code to make a special effect. That is what the code is for.

At Bitsquid, however, we are in a different position. We are making a general purpose engine to be used on multiple platforms for all kinds of tasks. We can't put game specific code in the engine or everything will end up a total mess. Sure, our licensees could modify their cloned copy of the source to add their own effects. But that is not an ideal solution. It forces them to learn our code, it makes it harder for us to reproduce their bugs, since our code bases have now diverged and it makes it harder for us to modify and optimize the source code without putting our licensees in merge hell.

So our aim is always to be completely data-driven.

But how can we represent a general function as data? There are really only two possibilities:

* As a piece of executable machine code.
* As a piece of *bytecode* that gets executed by a virtual machine.

The first approach is the fastest of course, but it has two drawbacks. First, machine code is platform dependent. Writing a system that can dynamically generate machine code for a lot of different targets is no small undertaking (though it could be simplified by using LLVM). Second, and more serious, many systems simply don't *allow* us execute dynamically generated machine code.

The inevitable conclusion is that we have to use bytecode (perhaps coupled with a machine code compiler on the platforms where that is feasible).

Unfortunately, as everybody who has used a dynamic language without a JIT compiler knows, bytecode is slow. Usually, at least a factor 10 slower than machine code. And remember that one of our design goals for this system was that it should be fast. We said in the beginning that it should be able to handle at least 10 000 queries per frame.

So what can we do?

## The Massively Vectorized Virtual Machine

At this point it makes sense to stop and think a bit about *why* bytecode is slow. If you look at the code of a virtual machine, it is essentially a tight loop that repeatedly does three things:

* Decode the next bytecode instruction into operation + arguments.
* Jump to the code that performs the operation.
* Execute the operation.

The third step is usually just as fast as handwritten machine code would be. Computing *a+b* is not more expensive because it was triggered by an *OP_ADD* bytecode instruction.

So all the overhead of bytecode, the thing that makes it "slow", is found in the first two steps.

Well then here is an idea: what if we could reuse the computations that we make in those two steps?

Remember that our goal is to compute *G(p)* for a lot of points *p_i*. We want to evaluate the same function, the same *bytecode* instructions, for a lot of different data points. In that case, why repeat the expensive operation of decoding the bytecode instructions again and again for each point? Why not just decode the instruction *once* and then execute it for *all* data points?

So, with that change, our virtual machine loop now becomes:

* Decode the next bytecode instruction.
* Jump to the code that executes it.
* Execute that single instruction for *all* the input data.

With this change, the cost of decoding the bytecode is now amortized over all the query points. The more query points we have, the less time (proportionally) we will spend on decoding bytecode. With enough points (>1024) that time should be nearly negligible . In other worlds, our bytecode should be able to run **at nearly the same speed as native machine code**.

In a quick test I made, the overhead of a bytecode implementation compared to native code was just 16 % -- a far cry from the 10x slowdown we have come to expect.

## Fleshing out the Details

Since we are computing a vector function on vector input and we want it to run as fast as possible, it makes sense to use SSE (or its equivalent on other platforms) and represent all our data as vector4 intrinsics.

Virtual machines can be stack-based or register-based. Stack-based machines produce more compact bytecode since the arguments are implicit. Register-based machines need fewer instructions to accomplish a task, since they don't have to juggle things around on the stack. In our case, compact bytecode doesn't buy us much, since our programs are short and the decoding cost is amortized. On the other hand, accomplishing the same thing with fewer instructions means less code to execute for *each* query point. So a register-based virtual machine seems to be a clear win.

Here is what the code for an explosion effect could look like in a made-up intermediate language for our virtual machine. The effect produces a wind of 50 m/s outwards from the center of a sphere of radius 5 m located at (2,4,0):

```
direction = sub position, (2,4,0,0)
lensqr = dot direction, direction
direction = normalize direction
direction = mul direction, (50,50,50,50)
direction = select_lt lensqr, (25,25,25,25), direction, (0,0,0,0)
output = add output, direction
```

Here *position* is the input query position and *output* is the output result of the function. *direction* and *lensqr* are temporary variables.

Note that the final operation adds the result to the *output* register instead of overwriting it. This allows us to merge multiple effects by simply concatenating their bytecode. So to evaluate *G(p)* for a large number of points, we can first intersect the AABB of the points with the AABB of each individual effect *G_i(p)*. Then we merge the bytecodes of each intersecting effect into a single bytecode function *G'(p)* that we finally evaluate for each point.

We can feed *position* and *output* to the virtual machine as arrays of intrinsics:

```
void evaluate(void *bytecode, unsigned n, Vector4I *positions, Vector4I *output)
```

Note that since we are running the bytecode one instruction at a time for all the data, the local variables (*direction* and *lensqr)* need to be arrays too, since we need to remember their value for each of the input positions.

We could allocate arrays for these local variables and pass them to *evaluate* just as we do for *positions* and *output*. But that seems a bit wasteful. A complicated function could have twenty global variables or more, meaning that with 10 000 particles we would need to allocate 3.2 MB of temporary memory. The amount needed will vary widely, depending on how complicated the function is, which is driven by the data. This makes it hard to do a memory budget for the system.

So let's use an alternative approach. We allocate all local variable buffers from a "scratch space" which is provided by the caller:

```
void evaluate(void *bytecode, unsigned n, Vector4I *positions, Vector4I *output, unsigned scratch_bytes, void *scratch_space)
```

Now the caller has complete control over the amount of temporary memory the system uses. It is predictable and can be made to fit any desired memory budget.

To make this work, we need to chop this scratch memory up into areas for each local variable. The size of those buffers then determine how many input positions we can process at a time.

For example, suppose we have 256 K of scratch memory and 8 local variables. Each local variable then gets 32 K of memory, which can hold 2 K Vector4I's. So this means that instead of processing all 10 000 particles at the same time when we execute an opcode, we process the particles in 5 chunks, handling 2 048 particles each time. The cost of decoding the bytecode gets amortized over 2 048 particles, instead of over 10 000, but it is still negligible.

The nice thing about this approach is that we always use a constant, predictable amount of scratch space, regardless of how many query points we process and how complicated the function is. Instead we scale down how many particles we process at a time.

Since both input data and local variables are now Vector4I buffers, the inner loop of the virtual machine is simple to write, it will look something like:

```
void run_vm(const void *bytecode, unsigned n, Vector4I **registers)
{
	const void *pc = bytecode;
	while (true) {
		unsigned op = DECODE_OP(pc);
		switch(op) {
			case OP_ADD:
				Vector4I *a = registers[DECODE_REGISTER(pc)];
				Vector4I *b = registers[DECODE_REGISTER(pc)];
				Vector4I *c = registers[DECODE_REGISTER(pc)];
				Vector4I *ae = a + n;
				while (a != ae) {
					*a++ = addi(*b++, *c++);
				}
				break;
			...
		}
	}
}
```

## An Example

Here is a [YouTube video](http://www.youtube.com/watch?v=HkYvvEUXhcw&feature=g-upl) that shows a vector field implemented using this method. Unfortunately, the YouTube compression is not very nice to a video that contains this much high-frequency information. But at least it gives some idea of the effect.

The video shows 20 000 particles being animated by the vector field at a query cost of about 0.4 ms on a single thread (of course, parallelization is trivial, so you can divide that by the number of available cores).
